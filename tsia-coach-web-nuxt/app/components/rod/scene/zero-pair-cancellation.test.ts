import { describe, expect, it } from 'vitest'
import { useRodScene } from '~/composables/useRodScene'
import type { CuisenaireRodValue } from '../rod.types'
import { trainFootprints } from './part-footprint'
import { trainMagnitude, trainSignedTotal } from './rod-arithmetic'
import type { RodTrain, ScenePolicy, TrainPart } from './rod.scene.types'
import { copyScene } from './scene-snapshot'
import {
  applyZeroPairPlan,
  planZeroPair,
  zeroPairReasons,
  type ZeroPairPlan,
} from './zero-pair-cancellation'
import { zeroPairEquations, zeroPairExplanation, zeroPairOutcome } from './zero-pair-text'

type Orientation = TrainPart['orientation']

const rod = (
  id: string, value: number, sign: 1 | -1, anchor = { x: 0, y: 0 }, orientation: Orientation = 'horizontal',
): RodTrain => ({
  id, anchor,
  parts: [{ value: value as CuisenaireRodValue, ...(sign === -1 ? { sign } : {}), offset: { x: 0, y: 0 }, orientation }],
})

const policy: ScenePolicy = {
  columns: 48, rows: 24, spawnRows: [0], editable: () => true,
  allowOrientation: true, allowFactors: true, allowNegativeRods: true, allowZeroPairCancellation: true,
}

const enabled = { enabled: true }
const plan = (trains: RodTrain[], ids: string[]): ZeroPairPlan => {
  const result = planZeroPair(trains, ids, enabled)
  if (!result.allowed) throw new Error(result.reason)
  return result.plan
}
const cells = (trains: readonly RodTrain[]) => new Set(trains.flatMap(trainFootprints).flatMap(box => {
  const out: string[] = []
  for (let y = box.y; y < box.y + box.depth; y++) for (let x = box.x; x < box.x + box.width; x++) out.push(`${x},${y}`)
  return out
}))
const total = (trains: readonly RodTrain[]) => trains.reduce((sum, train) => sum + trainSignedTotal(train), 0)
const magnitude = (trains: readonly RodTrain[]) => trains.reduce((sum, train) => sum + trainMagnitude(train), 0)

describe('zero-pair planner', () => {
  const magnitudes = Array.from({ length: 10 }, (_, i) => i + 1)
  const combinations = magnitudes.flatMap(p => magnitudes.map(n => [p, n] as const))

  it.each(combinations)('conserves value for +%i and -%i in either selection order', (p, n) => {
    const scene = [rod('p', p, 1), rod('n', n, -1, { x: 0, y: 2 }), rod('other', 3, 1, { x: 20, y: 5 })]
    const forward = plan(scene, ['p', 'n'])
    expect(plan(scene, ['n', 'p'])).toEqual(forward)

    const after = applyZeroPairPlan(scene, forward)
    expect(total(after)).toBe(total(scene))
    expect(magnitude(scene) - magnitude(after)).toBe(2 * Math.min(p, n))
    expect(forward.cancelledMagnitude).toBe(Math.min(p, n))
    expect(forward.signedRemainder).toBe(p - n)
    for (const part of after.flatMap(train => train.parts)) {
      expect(part.value).toBeGreaterThanOrEqual(1)
      expect(part.value).toBeLessThanOrEqual(10)
    }
    // Unselected material is untouched, the same object in the same place.
    expect(after.find(train => train.id === 'other')).toBe(scene[2])
    // The larger rod's cells are partitioned; the survivor keeps a subset.
    if (forward.decomposition) {
      const larger = scene.find(train => train.id === forward.survivorId)!
      const pieces = forward.decomposition.pieces.map((piece, index) => ({
        id: `${index}`, anchor: larger.anchor, parts: [{ ...piece }],
      }))
      expect(cells(pieces)).toEqual(cells([larger]))
      expect(pieces.reduce((sum, piece) => sum + piece.parts[0]!.value, 0)).toBe(Math.max(p, n))
      const survivorCells = cells([forward.survivor!])
      expect([...survivorCells].every(cell => cells([larger]).has(cell))).toBe(true)
    } else {
      expect(after.map(train => train.id)).toEqual(['other'])
    }
    expect(scene.map(train => copyScene([train])[0])).toEqual(copyScene(scene))
  })

  it.each([
    [4, 4, null, null],
    [10, 4, 'p', 6],
    [4, 10, 'n', -6],
    [1, 10, 'n', -9],
    [10, 1, 'p', 9],
  ] as const)('+%i and -%i leaves %s with %s', (p, n, survivorId, value) => {
    const result = plan([rod('p', p, 1), rod('n', n, -1, { x: 0, y: 2 })], ['p', 'n'])
    expect(result.survivorId).toBe(survivorId)
    if (value === null) {
      expect(result.survivor).toBeNull()
      expect(result.removedIds).toEqual(['p', 'n'])
    } else {
      expect(trainSignedTotal(result.survivor!)).toBe(value)
      expect(result.survivor!.parts[0]!.sign).toBe(value < 0 ? -1 : undefined)
      expect('sign' in result.survivor!.parts[0]!).toBe(value < 0)
    }
  })

  it('splits a horizontal +10 into +6 then +4 from its own starting offset', () => {
    const larger: RodTrain = { id: 'p', anchor: { x: 3, y: 1 }, parts: [{ value: 10, offset: { x: 0, y: 0 }, orientation: 'horizontal', addendGroup: 0 }] }
    const result = plan([larger, rod('n', 4, -1, { x: 0, y: 5 }, 'vertical')], ['p', 'n'])
    expect(result.decomposition!.pieces).toEqual([
      { role: 'remainder', value: 6, sign: 1, offset: { x: 0, y: 0 }, orientation: 'horizontal' },
      { role: 'cancelling', value: 4, sign: 1, offset: { x: 6, y: 0 }, orientation: 'horizontal' },
    ])
    // Same ID, anchor, orientation; the stale addend marker is not copied.
    expect(result.survivor).toEqual({
      id: 'p', anchor: { x: 3, y: 1 }, parts: [{ value: 6, offset: { x: 0, y: 0 }, orientation: 'horizontal' }],
    })
  })

  it('splits a vertical -10 along y and keeps it negative', () => {
    const result = plan([rod('p', 4, 1), rod('n', 10, -1, { x: 8, y: 0 }, 'vertical')], ['p', 'n'])
    expect(result.decomposition!.pieces.map(piece => [piece.role, piece.value, piece.sign, piece.offset]))
      .toEqual([['remainder', 6, -1, { x: 0, y: 0 }], ['cancelling', 4, -1, { x: 0, y: 6 }]])
    expect(result.survivor!.parts[0]).toEqual({ value: 6, sign: -1, offset: { x: 0, y: 0 }, orientation: 'vertical' })
  })

  it.each([
    ['capability off', [rod('p', 4, 1), rod('n', 4, -1, { x: 0, y: 2 })], ['p', 'n'], false, zeroPairReasons.unavailable],
    ['one target', [rod('p', 4, 1)], ['p'], true, zeroPairReasons.count],
    ['three targets', [rod('p', 4, 1)], ['p', 'p', 'p'], true, zeroPairReasons.count],
    ['duplicate target', [rod('p', 4, 1)], ['p', 'p'], true, zeroPairReasons.count],
    ['missing target', [rod('p', 4, 1)], ['p', 'gone'], true, zeroPairReasons.missing],
    ['two positives', [rod('a', 4, 1), rod('b', 4, 1, { x: 0, y: 2 })], ['a', 'b'], true, zeroPairReasons.sameSign],
    ['two negatives', [rod('a', 4, -1), rod('b', 4, -1, { x: 0, y: 2 })], ['a', 'b'], true, zeroPairReasons.sameSign],
    ['tower', [rod('p', 4, 1, { x: 0, y: 0 }, 'tower'), rod('n', 4, -1, { x: 0, y: 2 })], ['p', 'n'], true, zeroPairReasons.tower],
    ['multi-part train', [{ id: 'p', anchor: { x: 0, y: 0 }, parts: [
      { value: 4, offset: { x: 0, y: 0 }, orientation: 'horizontal' },
      { value: 2, offset: { x: 4, y: 0 }, orientation: 'horizontal' },
    ] } as RodTrain, rod('n', 4, -1, { x: 0, y: 2 })], ['p', 'n'], true, zeroPairReasons.multiPart],
    ['role-bearing material', [{ ...rod('p', 4, 1), materialRole: 'numerator' } as RodTrain, rod('n', 4, -1, { x: 0, y: 2 })], ['p', 'n'], true, zeroPairReasons.role],
  ] as const)('rejects %s', (_, trains, ids, on, reason) => {
    const before = JSON.stringify(trains)
    expect(planZeroPair(trains, ids, { enabled: on })).toEqual({ allowed: false, reason })
    expect(JSON.stringify(trains)).toBe(before)
  })
})

describe('zero-pair text', () => {
  it('writes equations, explanations and outcomes from the plan', () => {
    const equal = plan([rod('p', 4, 1), rod('n', 4, -1, { x: 0, y: 2 })], ['p', 'n'])
    expect(zeroPairEquations(equal)).toEqual(['4 + (−4) = 0'])
    expect(zeroPairExplanation(equal)).toBe('Positive 4 and negative 4 make zero. No rods remain.')
    expect(zeroPairOutcome(equal)).toBe('Zero pair cancelled. No rods remain.')

    const positive = plan([rod('p', 10, 1), rod('n', 4, -1, { x: 0, y: 2 })], ['p', 'n'])
    expect(zeroPairEquations(positive)).toEqual(['10 = 6 + 4', '6 + [4 + (−4)] = 6'])
    expect(zeroPairExplanation(positive)).toBe(
      'Split positive 10 into positive 6 and positive 4. Positive 4 and negative 4 make zero. Positive 6 will remain.')

    const negative = plan([rod('p', 4, 1), rod('n', 10, -1, { x: 0, y: 2 })], ['p', 'n'])
    expect(zeroPairEquations(negative)).toEqual(['−10 = (−6) + (−4)', '(−6) + [4 + (−4)] = −6'])
    expect(zeroPairOutcome(negative)).toBe('Zero pair cancelled. Negative 6 remains.')
  })
})

describe('cancel-zero-pair scene action', () => {
  function setup(trains: RodTrain[], options: Partial<ScenePolicy> = {}) {
    const scene = useRodScene({ ...policy, ...options })
    expect(scene.replace(trains).allowed).toBe(true)
    return scene
  }
  const state = (scene: ReturnType<typeof useRodScene>) =>
    JSON.stringify({ trains: scene.trains.value, selection: [...scene.selection.value] })
  const cancel = (scene: ReturnType<typeof useRodScene>, ids: string[], expected = copyScene(scene.trains.value.filter(train => ids.includes(train.id)))) =>
    scene.apply(ids, { type: 'cancel-zero-pair', expectedInputs: expected })

  it('removes an equal pair in one commit, clears selection and allocates no IDs', () => {
    const other = rod('other', 3, 1, { x: 20, y: 5 })
    const scene = setup([rod('p', 4, 1), rod('n', 4, -1, { x: 0, y: 2 }), other])
    scene.select(['p', 'n'])
    expect(scene.check(['p', 'n'], { type: 'cancel-zero-pair', expectedInputs: copyScene(scene.trains.value.slice(0, 2)) }))
      .toEqual({ allowed: true })
    expect(cancel(scene, ['p', 'n'])).toEqual({ allowed: true, createdIds: [] })
    expect(copyScene(scene.trains.value)).toEqual([other])
    expect(scene.selection.value.size).toBe(0)
    const next = scene.apply([], { type: 'create', value: 1 })
    expect(next.allowed && next.createdIds).toEqual(['train-1'])
  })

  it('leaves +6 on the +10 train with its ID and anchor, and selects it', () => {
    const scene = setup([rod('n', 4, -1, { x: 0, y: 2 }), rod('p', 10, 1, { x: 5, y: 0 })])
    scene.select(['n', 'p'])
    expect(cancel(scene, ['n', 'p']).allowed).toBe(true)
    expect(copyScene(scene.trains.value)).toEqual([
      { id: 'p', anchor: { x: 5, y: 0 }, parts: [{ value: 6, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] },
    ])
    expect([...scene.selection.value]).toEqual(['p'])
  })

  it('refuses a stale preview after the inputs change, without mutating', () => {
    const base = () => [rod('p', 10, 1), rod('n', 4, -1, { x: 12, y: 0 }), rod('spare', 4, -1, { x: 12, y: 4 })]
    const scene = setup(base())
    const expected = copyScene(scene.trains.value.slice(0, 2))
    const changes: (() => { allowed: boolean })[] = [
      () => scene.apply(['n'], { type: 'move', delta: { x: 1, y: 0 } }),
      () => scene.apply(['p'], { type: 'set-orientation', orientation: 'vertical' }),
      () => scene.replace([rod('p', 10, 1), rod('n', 4, 1, { x: 12, y: 0 })]),
      () => scene.replace([rod('p', 10, 1), rod('n', 5, -1, { x: 12, y: 0 })]),
    ]
    for (const change of changes) {
      scene.replace(base())
      expect(change().allowed).toBe(true)
      const before = state(scene)
      expect(cancel(scene, ['p', 'n'], expected)).toEqual({ allowed: false, reason: zeroPairReasons.stale })
      expect(state(scene)).toBe(before)
    }
    // Deleted target: the stale descriptors cannot reach other material.
    scene.replace([rod('p', 10, 1), rod('spare', 4, -1, { x: 12, y: 4 })])
    expect(cancel(scene, ['p', 'n'], expected).allowed).toBe(false)
    // Retargeted: same expected inputs, different rod.
    expect(cancel(scene, ['p', 'spare'], expected)).toEqual({ allowed: false, reason: zeroPairReasons.stale })
    expect(scene.trains.value).toHaveLength(2)
  })

  it('is unavailable on boards without the capability', () => {
    const scene = setup([rod('p', 4, 1), rod('n', 4, -1, { x: 0, y: 2 })], { allowZeroPairCancellation: false })
    const before = state(scene)
    expect(cancel(scene, ['p', 'n'])).toEqual({ allowed: false, reason: zeroPairReasons.unavailable })
    expect(scene.planZeroPair(['p', 'n'])).toEqual({ allowed: false, reason: zeroPairReasons.unavailable })
    expect(state(scene)).toBe(before)
  })

  it('keeps mixed-train regrouping disabled', () => {
    const scene = setup([rod('p', 4, 1), rod('n', 4, -1, { x: 4, y: 0 })])
    const made = scene.apply(['p', 'n'], { type: 'make-train' })
    const id = made.allowed ? made.createdIds[0]! : ''
    expect(scene.check([id], { type: 'regroup-ones' }).allowed).toBe(false)
    expect(scene.planZeroPair([id]).allowed).toBe(false)
  })
})
