import { describe, expect, it } from 'vitest'
import { useRodScene } from '~/composables/useRodScene'
import { createArrayGoalAdapter, createBarGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import { validateLevelDocument, type LevelDocumentAdapter, type LevelDocumentV1 } from '~/components/playground/files/level-document'
import { partSchema } from '~/components/playground/files/level-document.schema'
import { partFootprint, trainFootprints } from './part-footprint'
import {
  partSignedValue,
  trainMagnitude,
  trainSignKind,
  trainSignedTotal,
} from './rod-arithmetic'
import { signedAddendPairs } from './addend-groupings'
import { copyScene } from './scene-snapshot'
import { validateSnapshot } from './validate-snapshot'
import type { RodTrain, ScenePolicy, TrainPart } from './rod.scene.types'

const signedPolicy: ScenePolicy = {
  columns: 48, rows: 24, spawnRows: [0, 1, 2, 3],
  editable: () => true, allowOrientation: true, allowFactors: true, allowNegativeRods: true,
}
const positivePolicy: ScenePolicy = { ...signedPolicy, allowNegativeRods: undefined }

const part = (value: TrainPart['value'], x: number, sign?: -1 | 1): TrainPart => ({
  value, offset: { x, y: 0 }, orientation: 'horizontal', ...(sign ? { sign } : {}),
})
const train = (id: string, parts: TrainPart[], anchor = { x: 0, y: 0 }): RodTrain => ({ id, anchor, parts })

/** Snapshot of everything a failed action must leave untouched. */
const state = (scene: ReturnType<typeof useRodScene>) => JSON.stringify({
  trains: scene.trains.value, selection: [...scene.selection.value],
})

describe('signed arithmetic', () => {
  it('treats a missing sign as positive', () => {
    expect(partSignedValue(part(4, 0))).toBe(4)
    expect(trainSignKind(train('t', [part(4, 0)]))).toBe('positive')
  })

  it('gives either sign identical geometry', () => {
    expect(partFootprint(part(10, 0, -1))).toEqual(partFootprint(part(10, 0)))
    for (const orientation of ['horizontal', 'vertical', 'tower'] as const) {
      const negative = { ...part(7, 0, -1), orientation }
      expect(partFootprint(negative)).toEqual(partFootprint({ ...part(7, 0), orientation }))
    }
  })

  it.each([
    [[part(10, 0), part(4, 10)], 14, 14, 'positive'],
    [[part(10, 0, -1), part(4, 10, -1)], 14, -14, 'negative'],
    [[part(10, 0), part(4, 10, -1)], 14, 6, 'mixed'],
    [[part(10, 0), part(10, 10, -1)], 20, 0, 'mixed'],
  ] as const)('separates span from signed total: %#', (parts, span, total, kind) => {
    const value = train('t', [...parts])
    expect(trainMagnitude(value)).toBe(span)
    expect(trainSignedTotal(value)).toBe(total)
    expect(trainSignKind(value)).toBe(kind)
  })

  it('offers only same-sign addend splits for a negative total', () => {
    const pairs = signedAddendPairs(-24)
    expect(pairs).toHaveLength(23)
    expect(pairs[0]).toEqual([-1, -23])
    expect(pairs.every(([a, b]) => a < 0 && b < 0 && a + b === -24)).toBe(true)
  })
})

describe('signed scene operations', () => {
  it('creates a negative ten with the same footprint as a positive ten', () => {
    const scene = useRodScene(signedPolicy)
    const negative = scene.apply([], { type: 'create', value: 10, sign: -1 })
    const positive = scene.apply([], { type: 'create', value: 10 })
    expect(negative.allowed && positive.allowed).toBe(true)
    const [a, b] = scene.trains.value
    expect(a!.parts[0]!.sign).toBe(-1)
    expect('sign' in b!.parts[0]!).toBe(false)
    expect(trainFootprints(a!)[0]!.width).toBe(trainFootprints(b!)[0]!.width)
  })

  it('keeps sign through move, orientation, clone, join and release', () => {
    const scene = useRodScene(signedPolicy)
    scene.replace([train('a', [part(10, 0, -1)]), train('b', [part(4, 0, -1)], { x: 12, y: 0 })])
    expect(scene.apply(['a'], { type: 'move', delta: { x: 0, y: 2 } }).allowed).toBe(true)
    expect(scene.apply(['a'], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(true)
    expect(scene.apply(['a'], { type: 'set-orientation', orientation: 'tower' }).allowed).toBe(true)
    expect(scene.apply(['a'], { type: 'set-orientation', orientation: 'horizontal' }).allowed).toBe(true)
    expect(scene.apply(['a'], { type: 'clone' }).allowed).toBe(true)
    expect(scene.trains.value.flatMap(item => item.parts).every(item => item.sign === -1)).toBe(true)

    const joined = scene.apply(['a', 'b'], { type: 'make-train' })
    expect(joined.allowed).toBe(true)
    const id = joined.allowed ? joined.createdIds[0]! : ''
    const made = scene.trains.value.find(item => item.id === id)!
    expect(trainSignedTotal(made)).toBe(-14)

    expect(scene.apply([id], { type: 'ungroup' }).allowed).toBe(true)
    expect(scene.trains.value.flatMap(item => item.parts).every(item => item.sign === -1)).toBe(true)
  })

  it('regroups -14 into fourteen negative ones', () => {
    const scene = useRodScene(signedPolicy)
    scene.replace([train('t', [part(10, 0, -1), part(4, 10, -1)])])
    expect(scene.apply(['t'], { type: 'regroup-ones' }).allowed).toBe(true)
    const parts = scene.trains.value[0]!.parts
    expect(parts).toHaveLength(14)
    expect(parts.every(item => item.value === 1 && item.sign === -1)).toBe(true)
  })

  it('splits -24 into two independent -12 trains with local offsets and new IDs', () => {
    const scene = useRodScene(signedPolicy)
    scene.replace([train('t', [part(10, 0, -1), part(10, 10, -1), part(4, 20, -1)], { x: 2, y: 1 })])
    expect(scene.getAddendChoices('t').map(choice => choice.pair)).toContainEqual([-12, -12])
    const result = scene.apply(['t'], { type: 'regroup-addends', pair: [-12, -12] })
    expect(result.allowed && result.createdIds).toHaveLength(2)
    const [first, second] = scene.trains.value
    for (const item of [first!, second!]) {
      expect(item.parts.map(p => [p.value, p.sign, p.offset.x])).toEqual([[10, -1, 0], [2, -1, 10]])
      expect(trainSignedTotal(item)).toBe(-12)
    }
    expect(first!.anchor).toEqual({ x: 2, y: 1 })
    expect(second!.anchor).toEqual({ x: 14, y: 1 })
    expect(new Set(scene.trains.value.map(item => item.id)).has('t')).toBe(false)
  })

  it('rejects a positive pair for a negative train', () => {
    const scene = useRodScene(signedPolicy)
    scene.replace([train('t', [part(10, 0, -1), part(4, 10, -1)])])
    const before = state(scene)
    expect(scene.apply(['t'], { type: 'regroup-addends', pair: [7, 7] }).allowed).toBe(false)
    expect(state(scene)).toBe(before)
  })

  it('arranges a negative train as factor rows that keep their sign', () => {
    const scene = useRodScene(signedPolicy)
    scene.replace([train('t', [part(10, 0, -1), part(4, 10, -1)])])
    expect(scene.getFactorChoices('t').map(choice => choice.shape)).toContainEqual({ rows: 2, columns: 7 })
    expect(scene.apply(['t'], { type: 'regroup-factors', shape: { rows: 2, columns: 7 } }).allowed).toBe(true)
    const value = scene.trains.value[0]!
    expect(value.parts.every(item => item.value === 7 && item.sign === -1)).toBe(true)
    expect(trainSignedTotal(value)).toBe(-14)
  })

  it('lets mixed trains join and release but refuses mathematical regrouping', () => {
    const scene = useRodScene(signedPolicy)
    scene.replace([train('a', [part(10, 0)]), train('b', [part(4, 0, -1)], { x: 12, y: 0 })])
    const joined = scene.apply(['a', 'b'], { type: 'make-train' })
    expect(joined.allowed).toBe(true)
    const id = joined.allowed ? joined.createdIds[0]! : ''
    // +10 and -4: the train keeps all 14 cells; it does not collapse to +6.
    expect(trainMagnitude(scene.trains.value[0]!)).toBe(14)
    expect(trainSignedTotal(scene.trains.value[0]!)).toBe(6)

    const before = state(scene)
    for (const action of [
      { type: 'regroup-ones' },
      { type: 'regroup-addends' },
      { type: 'regroup-factors' },
    ] as const) {
      const result = scene.check([id], action)
      expect(result.allowed).toBe(false)
      expect(!result.allowed && result.reason).toMatch(/mixes positive and negative/)
      expect(scene.apply([id], action).allowed).toBe(false)
    }
    expect(scene.getAddendChoices(id)).toEqual([])
    expect(scene.getFactorChoices(id)).toEqual([])
    expect(state(scene)).toBe(before)
    expect(scene.apply([id], { type: 'clone' }).allowed).toBe(true)
    expect(scene.apply([id], { type: 'ungroup' }).allowed).toBe(true)
  })
})

describe('capability and atomicity', () => {
  it.each([0, 2, -2, 0.5, '1', null])('rejects the creation sign %j without changing the scene', sign => {
    const scene = useRodScene(signedPolicy)
    scene.apply([], { type: 'create', value: 3 })
    scene.select([scene.trains.value[0]!.id])
    const before = state(scene)
    // Untrusted input reaches the action at runtime; the type cannot stop it.
    const action = JSON.parse(JSON.stringify({ type: 'create', value: 3, sign }))
    expect(scene.apply([], action).allowed).toBe(false)
    expect(state(scene)).toBe(before)
    // ID allocation is untouched: the next rod gets the next ID.
    const next = scene.apply([], { type: 'create', value: 1 })
    expect(next.allowed && next.createdIds).toEqual(['train-2'])
  })

  it('refuses negative rods on a positive-only board, live and on replace', () => {
    const scene = useRodScene(positivePolicy)
    expect(scene.apply([], { type: 'create', value: 3, sign: -1 })).toEqual({
      allowed: false, reason: 'This board accepts positive rods only.',
    })
    const replaced = scene.replace([train('t', [part(3, 0, -1)])])
    expect(replaced.allowed).toBe(false)
    expect(!replaced.allowed && replaced.reason).toMatch(/positive rods only/)
    expect(scene.trains.value).toEqual([])
  })

  it('rejects malformed snapshot signs', () => {
    for (const sign of [0, 2, null, '1']) {
      const source = JSON.parse(JSON.stringify([train('t', [{ ...part(3, 0), sign } as unknown as TrainPart])]))
      expect(validateSnapshot(source, signedPolicy)).toEqual({ allowed: false, reason: 'Rod signs must be 1 or -1.' })
    }
  })

  it('copies sign through a snapshot and leaves positive parts unsigned', () => {
    const copied = copyScene([train('t', [part(3, 0, -1), part(2, 3)])])
    expect(copied[0]!.parts[0]!.sign).toBe(-1)
    expect('sign' in copied[0]!.parts[1]!).toBe(false)
  })
})

describe('signed level files', () => {
  const arrayAdapter = (policy: ScenePolicy): LevelDocumentAdapter => ({
    board: { kind: 'array', config: { columns: 24, rows: 12 } },
    goals: createArrayGoalAdapter({ columns: 24, rows: 12 }),
    validateSnapshot: scene => validateSnapshot(scene, { ...policy, columns: 24, rows: 12 }),
  })
  const document = (parts: TrainPart[], goalValue = -14): LevelDocumentV1 => ({
    version: 1, board: { kind: 'array', config: { columns: 24, rows: 12 } },
    steps: [
      { id: 's1', title: '', prompt: '', trains: [], goal: null },
      {
        id: 's2', title: '', prompt: '', trains: [train('t', parts)],
        goal: { type: 'all', conditions: [{ type: 'region-total', regionId: 'array', value: goalValue }] },
      },
    ],
  })

  it('parses the optional sign and rejects any other value', () => {
    expect(partSchema.safeParse(part(3, 0, -1)).success).toBe(true)
    expect(partSchema.safeParse(part(3, 0)).success).toBe(true)
    for (const sign of [0, -2, null, '1', 0.5]) {
      expect(partSchema.safeParse({ ...part(3, 0), sign }).success).toBe(false)
    }
  })

  it('round-trips signed later steps on a signed board', () => {
    const input = JSON.parse(JSON.stringify(document([part(10, 0, -1), part(4, 10, -1)])))
    const result = validateLevelDocument(input, arrayAdapter(signedPolicy))
    expect(result.allowed).toBe(true)
    expect(result.allowed && result.value.steps[1]!.trains[0]!.parts.map(p => p.sign)).toEqual([-1, -1])
  })

  it('rejects a signed level on a positive-only board with an actionable reason', () => {
    const result = validateLevelDocument(document([part(4, 0, -1)]), arrayAdapter(positivePolicy))
    expect(result.allowed).toBe(false)
    expect(!result.allowed && result.reason).toMatch(/^Step s2: This board accepts positive rods only/)
  })
})

describe('signed goals', () => {
  const array = createArrayGoalAdapter({ columns: 24, rows: 12 })
  const goal = (type: 'region-total' | 'empty-region', value?: number) => ({
    type: 'all' as const,
    conditions: [type === 'region-total'
      ? { type, regionId: 'array', value: value ?? 0 }
      : { type, regionId: 'array' }],
  })

  it('reads +10 and -10 as total 0 while the cells stay occupied', () => {
    const scene = [train('t', [part(10, 0), part(10, 10, -1)])]
    expect(array.evaluate(goal('region-total', 0), scene).satisfied).toBe(true)
    expect(array.evaluate(goal('empty-region'), scene).satisfied).toBe(false)
    expect(array.evaluate({
      type: 'all', conditions: [{ type: 'occupied-area', regionId: 'array', cells: 20 }],
    }, scene).satisfied).toBe(true)
  })

  it('accepts negative targets only where the board supports them', () => {
    const scene = [train('t', [part(10, 0, -1), part(4, 10, -1)])]
    expect(array.parse(goal('region-total', -14)).allowed).toBe(true)
    expect(array.evaluate(goal('region-total', -14), scene).satisfied).toBe(true)
    expect(createBarGoalAdapter({ columns: 24, targetCount: 3 }).parse({
      type: 'all', conditions: [{ type: 'region-total', regionId: 'target-0', value: -1 }],
    }).allowed).toBe(false)
  })
})
