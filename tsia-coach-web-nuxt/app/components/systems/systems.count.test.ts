import { describe, expect, it } from 'vitest'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain, ScenePolicy, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import { useRodScene } from '~/composables/useRodScene'
import { validateLevelDocument, type LevelDocumentAdapter } from '~/components/playground/files/level-document'
import { createSystemsGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import { evaluateBoard, evaluateSystem } from './systems.evaluate'
import { evaluateCountSystem } from './systems.count-evaluate'
import { countHint, countPhase, countStatus, substitutionLines } from './systems.count-feedback'
import { countLayout, derivedLowerTrains, unitTrain } from './systems.count-layout'
import { conversionSource, decodePlacements, defaultPlacements, encodePlacements, exchangeSelection, planCountTransform } from './systems.count-operations'
import { systemsFixtures } from './systems.fixtures'
import { planSystemsTransform } from './systems.operations'
import { systemsBoardConfigSchema, type SystemsBoardConfig } from './systems.schema'
import { substituteSystem } from './systems.substitution'

const reference = systemsFixtures.rodCountReference.config as SystemsBoardConfig
const small = systemsFixtures.rodCountSmall.config as SystemsBoardConfig
const layout = countLayout(reference)

let counter = 0
/** x rods then y rods standing in canonical columns. */
function build(config: SystemsBoardConfig, xCount: number, yCount: number): RodTrain[] {
  const { upper } = countLayout(config)
  const { x: a, y: b } = config.system.equations[0].coefficients
  return [
    ...Array.from({ length: xCount }, (_, index) => unitTrain(upper.x + index, upper.y, a, `u${++counter}`)),
    ...Array.from({ length: yCount }, (_, index) => unitTrain(upper.x + xCount + index, upper.y, b, `u${++counter}`)),
  ]
}

const policyFor = (config: SystemsBoardConfig): ScenePolicy => {
  const shape = countLayout(config)
  return {
    columns: shape.columns,
    rows: shape.rows,
    spawnRows: [shape.upper.y],
    regions: shape.regions,
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
    regionBoundEdits: true,
    planTransform: (trains, ids, transform) => {
      const result = planSystemsTransform(config, trains, ids, transform)
      return result.allowed ? { allowed: true, remove: result.plan.remove, add: result.plan.add } : result
    },
  }
}

function sceneWith(config: SystemsBoardConfig, trains: RodTrain[]) {
  const scene = useRodScene(policyFor(config))
  expect(scene.replace(trains)).toEqual({ allowed: true })
  return scene
}

function exchange(config: SystemsBoardConfig, scene: ReturnType<typeof useRodScene>) {
  const selection = exchangeSelection(config, scene.trains.value)
  if (!('ids' in selection)) throw new Error(selection.reason)
  const params = encodePlacements(defaultPlacements(config, scene.trains.value, selection.ids))
  const planned = planSystemsTransform(config, scene.trains.value, selection.ids, { name: 'count-exchange', params })
  if (!planned.allowed) throw new Error(planned.reason)
  return scene.apply(selection.ids, { type: 'board-transform', transform: { name: 'count-exchange', params, expected: planned.plan.key } })
}

describe('rod-count schema', () => {
  it('keeps files without a strategy on row lengths', () => {
    const legacy = systemsFixtures.development.config as SystemsBoardConfig
    expect(systemsBoardConfigSchema.parse(legacy).strategy).toBeUndefined()
    expect(evaluateBoard(legacy, []).strategy).toBe('row-length')
  })

  it('requires distinct rod values from 1 to 9', () => {
    const withCoefficients = (x: number, y: number) => ({
      ...reference,
      system: { equations: [{ ...reference.system.equations[0], coefficients: { x, y } }, reference.system.equations[1]] },
    })
    expect(systemsBoardConfigSchema.safeParse(withCoefficients(4, 4)).success).toBe(false)
    expect(systemsBoardConfigSchema.safeParse(withCoefficients(12, 3)).success).toBe(false)
    expect(systemsBoardConfigSchema.safeParse(reference).success).toBe(true)
  })

  it('accepts generation provenance only on rod-count boards', () => {
    const legacy = systemsFixtures.development.config
    expect(systemsBoardConfigSchema.safeParse({ ...legacy, generation: { seed: 1, profile: 'standard' } }).success).toBe(false)
    expect(systemsBoardConfigSchema.safeParse({ ...reference, generation: { seed: 1, profile: 'standard' } }).success).toBe(true)
  })
})

describe('rod-count layout and evaluation', () => {
  it('stacks a top-aligned learner band over a bottom-aligned check band', () => {
    expect(layout.upper).toMatchObject({ x: 2, y: 0, depth: 8, width: 26 })
    expect(layout.lower).toMatchObject({ y: 10, depth: 9 })
    expect(layout.regions).toEqual([layout.upper])
  })

  it('starts with one rod of each type: areas 11 and 13 (Artboard 1)', () => {
    const evaluation = evaluateCountSystem(reference, build(reference, 1, 1))
    expect(evaluation.valid && evaluation.upper.total).toBe(11)
    expect(evaluation.valid && evaluation.lower?.total).toBe(13)
    expect(evaluation.valid && evaluation.candidate).toBeNull()
  })

  it('treats residual unit cells as unassigned material, never a fractional count (Artboard 2)', () => {
    const trains = [...build(reference, 23, 0), unitTrain(layout.upper.x + 23, 0, 2, 'loose')]
    const evaluation = evaluateCountSystem(reference, trains)
    if (!evaluation.valid) throw new Error(evaluation.reason)
    expect(evaluation.counts).toEqual({ xCount: 23, yCount: 0 })
    expect(evaluation.upper).toMatchObject({ xAddend: 69, unassigned: 2, total: 71, satisfied: false })
    expect(evaluation.candidate).toBeNull()
    expect(evaluation.lower).toBeNull()
    expect(countStatus(reference, evaluation, 'building')).toMatch(/2 cells are unassigned material/)
  })

  it('counts lying x and y rods like upright ones; only towers stay unassigned', () => {
    // The reported board: 16 upright x rods, the y rod, and 5 x rods laid down beside it.
    const lying = Array.from({ length: 5 }, (_, row): RodTrain =>
      ({ id: `lying${row}`, anchor: { x: layout.upper.x + 17, y: row }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }))
    const trains = [...build(reference, 16, 1), ...lying]
    const evaluation = evaluateCountSystem(reference, trains)
    if (!evaluation.valid) throw new Error(evaluation.reason)
    expect(evaluation.material.unassigned).toHaveLength(0)
    expect(evaluation.candidate).toEqual({ xCount: 21, yCount: 1 })
    expect(evaluation.lower?.total).toBe(193)
    expect(evaluation.canonical).toBe(false)

    const tower: RodTrain = { id: 'tower', anchor: { x: 2, y: 0 }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation: 'tower' }] }
    const towered = evaluateCountSystem(reference, [tower])
    expect(towered.valid && towered.material.unassigned[0]?.reason).toBe('orientation')
  })

  it('arranges lying rods by standing them up in their slots', () => {
    const lying = Array.from({ length: 5 }, (_, row): RodTrain =>
      ({ id: `lying${row}`, anchor: { x: layout.upper.x + 17, y: row }, parts: [{ value: 3, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }))
    const scene = sceneWith(reference, [...build(reference, 16, 1), ...lying])
    const planned = planSystemsTransform(reference, scene.trains.value, ['lying0'], { name: 'count-arrange' })
    if (!planned.allowed) throw new Error(planned.reason)
    expect(scene.apply(['lying0'], { type: 'board-transform', transform: { name: 'count-arrange', expected: planned.plan.key } }).allowed).toBe(true)
    const evaluation = evaluateCountSystem(reference, scene.trains.value)
    expect(evaluation.valid && evaluation.canonical).toBe(true)
    expect(evaluation.valid && evaluation.counts).toEqual({ xCount: 21, yCount: 1 })
    expect(scene.trains.value.every(train => train.parts.every(part => part.orientation === 'vertical'))).toBe(true)
  })

  it('counts every unit of a multi-unit train', () => {
    const parts: TrainPart[] = Array.from({ length: 21 }, (_, index) => ({ value: 3 as CuisenaireRodValue, offset: { x: index, y: 0 }, orientation: 'vertical' }))
    const block: RodTrain = { id: 'block', anchor: { x: 2, y: 0 }, parts }
    const evaluation = evaluateCountSystem(reference, [block, unitTrain(23, 0, 8, 'y1')])
    expect(evaluation.valid && evaluation.candidate).toEqual({ xCount: 21, yCount: 1 })
  })

  it('recognises (21,1) as the first candidate and checks Equation 2 at 193 (Artboard 4)', () => {
    const evaluation = evaluateCountSystem(reference, build(reference, 21, 1))
    if (!evaluation.valid) throw new Error(evaluation.reason)
    expect(evaluation.candidate).toEqual({ xCount: 21, yCount: 1 })
    expect(evaluation.candidateIndex).toBe(0)
    expect(evaluation.lower).toMatchObject({ xAddend: 189, yAddend: 4, total: 193, difference: 120 })
    expect(countPhase(evaluation, { previewing: false, selectedUnits: 0 })).toBe('reviewing')
    expect(countStatus(reference, evaluation, 'reviewing')).toMatch(/120 cells excess.*not a common solution.*8 3-rods into 3 8-rods/)
  })

  it('recognises an intermediate candidate and explains the guided start', () => {
    const evaluation = evaluateCountSystem(reference, build(reference, 13, 4))
    expect(evaluation.valid && evaluation.candidateIndex).toBe(1)
    expect(countHint(reference, evaluation, 1)).toMatch(/not the first one/)
  })

  it('writes substitution lines like the artboards', () => {
    const evaluation = evaluateCountSystem(reference, build(reference, 5, 7))
    if (!evaluation.valid) throw new Error(evaluation.reason)
    expect(evaluation.solved).toBe(true)
    expect(substitutionLines({ x: 3, y: 8 }, evaluation.counts, evaluation.upper)).toEqual(['3(5) + 8(7) = 71', '15 + 56 = 71'])
    expect(substitutionLines({ x: 9, y: 4 }, evaluation.counts, evaluation.lower!)).toEqual(['9(5) + 4(7) = 73', '45 + 28 = 73'])
  })

  it('derives the lower check under the same columns, bottom-aligned', () => {
    const derived = derivedLowerTrains(reference, { xCount: 5, yCount: 7 })
    expect(derived).toHaveLength(12)
    expect(derived[0]).toMatchObject({ anchor: { x: 2, y: 10 }, parts: [{ value: 9, orientation: 'vertical' }] })
    expect(derived[5]).toMatchObject({ anchor: { x: 7, y: 15 }, parts: [{ value: 4 }] })
  })

  it('never reads row lengths or row-length suggestions on a rod-count board', () => {
    expect(evaluateSystem(reference, []).valid).toBe(false)
    expect(substituteSystem(reference, build(reference, 21, 1)).suggestions).toEqual([])
  })

  it('gives progressive hints without naming the solution', () => {
    const evaluation = evaluateCountSystem(reference, build(reference, 10, 0))
    const hints = [1, 2, 3].map(level => countHint(reference, evaluation, level))
    expect(hints[0]).toMatch(/as many x rods/)
    expect(hints[1]).toMatch(/More x rods fit/)
    expect(hints[2]).toMatch(/leaving 41/)
    for (const hint of hints) expect(hint).not.toMatch(/x = 5|y = 7/)
  })
})

describe('rod-count exchange', () => {
  it('walks the reference sequence by exchanges and stops at the solution', () => {
    const scene = sceneWith(reference, build(reference, 21, 1))
    const totals: number[] = []
    for (const expected of [{ xCount: 13, yCount: 4 }, { xCount: 5, yCount: 7 }]) {
      const selection = exchangeSelection(reference, scene.trains.value)
      if (!('ids' in selection)) throw new Error(selection.reason)
      const untouched = scene.trains.value.filter(train => !selection.ids.includes(train.id)).map(train => JSON.stringify(train))
      const result = exchange(reference, scene)
      expect(result.allowed).toBe(true)
      const evaluation = evaluateCountSystem(reference, scene.trains.value)
      if (!evaluation.valid) throw new Error(evaluation.reason)
      expect(evaluation.counts).toEqual(expected)
      expect(evaluation.upper.total).toBe(71)
      expect(evaluation.material.unassigned).toHaveLength(0)
      totals.push(evaluation.lower!.total)
      // Only the source rods change: everything else keeps its ID and place.
      const now = scene.trains.value.map(train => JSON.stringify(train))
      for (const train of untouched) expect(now).toContain(train)
      expect(scene.trains.value).toHaveLength(untouched.length + 3)
    }
    expect(totals).toEqual([133, 73])
    const solved = evaluateCountSystem(reference, scene.trains.value)
    expect(solved.valid && solved.solved).toBe(true)
    expect(exchangeSelection(reference, scene.trains.value)).toEqual({ reason: 'Both equations already hold: this is the common solution.' })
  })

  it('exchanges three 4-rods for two 6-rods on 4x + 6y = 34', () => {
    const scene = sceneWith(small, build(small, 7, 1))
    expect(exchange(small, scene).allowed).toBe(true)
    const evaluation = evaluateCountSystem(small, scene.trains.value)
    expect(evaluation.valid && evaluation.counts).toEqual({ xCount: 4, yCount: 3 })
    expect(evaluation.valid && evaluation.solved).toBe(true)
  })

  it('describes the conserved area as an equation bridge', () => {
    const trains = build(reference, 21, 1)
    const ids = trains.slice(13, 21).map(train => train.id)
    const params = encodePlacements(defaultPlacements(reference, trains, ids))
    const planned = planCountTransform(reference, trains, ids, { name: 'count-exchange', params })
    if (!planned.allowed) throw new Error(planned.reason)
    expect(planned.plan.lines).toEqual([
      '8 × 3 = 24 = 3 × 8',
      'x: 21 → 13     y: 1 → 4',
      '3(13) + 8(4) = 71',
    ])
    expect(planned.plan.remove).toEqual(ids)
    expect(planned.plan.detail.added.map(train => train.anchor)).toEqual([{ x: 20, y: 0 }, { x: 21, y: 0 }, { x: 22, y: 0 }])
    expect(planned.plan.detail.next).toEqual({ xCount: 13, yCount: 4 })
  })

  it('requires integer placements for exactly the added y rods, inside Equation 1', () => {
    const trains = build(reference, 21, 1)
    const ids = trains.slice(13, 21).map(train => train.id)
    const plan = (params?: Record<string, number>) => planCountTransform(reference, trains, ids, { name: 'count-exchange', ...(params ? { params } : {}) })
    expect(plan()).toMatchObject({ allowed: false, reason: expect.stringMatching(/Place exactly 3 y rods/) })
    expect(plan(encodePlacements([{ x: 20, y: 0 }, { x: 21, y: 0 }]))).toMatchObject({ allowed: false })
    expect(plan({ count: 3, x0: 20.5, y0: 0, x1: 21, y1: 0, x2: 22, y2: 0 })).toMatchObject({ allowed: false })
    expect(decodePlacements({ count: 1, x0: 1 })).toBeNull()
    // A y rod hanging below the band is not a whole y rod in Equation 1.
    expect(plan(encodePlacements([{ x: 20, y: 0 }, { x: 21, y: 0 }, { x: 40, y: 0 }]))).toMatchObject({ allowed: false })
  })

  it('counts conversion sources by parts and rejects mixed selections of the same area', () => {
    const trains = build(reference, 21, 1)
    expect(conversionSource(reference, trains, trains.slice(13, 21).map(train => train.id))).toMatchObject({
      allowed: true, next: { xCount: 13, yCount: 4 }, step: { removedX: 8, addedY: 3, preservedArea: 24 },
    })
    const parts: TrainPart[] = Array.from({ length: 8 }, (_, index) => ({ value: 3 as CuisenaireRodValue, offset: { x: index, y: 0 }, orientation: 'vertical' }))
    const joined = [...build(reference, 13, 0), { id: 'eight', anchor: { x: 15, y: 0 }, parts }, unitTrain(23, 0, 8, 'y1')]
    expect(conversionSource(reference, joined, ['eight'])).toMatchObject({ allowed: true })
    // 3 + 3 + 3 + 3 + 8 + 4 rods… an 8-rod plus 16 cells of 3-rods is not 8 x rods.
    expect(conversionSource(reference, trains, [...trains.slice(16, 21), trains[21]!].map(train => train.id)))
      .toMatchObject({ allowed: false, reason: expect.stringMatching(/only x rods/) })
  })

  it('rejects wrong counts, mixed selections and non-candidates', () => {
    const trains = build(reference, 21, 1)
    const plan = (ids: string[], source = trains) => planCountTransform(reference, source, ids, { name: 'count-exchange', params: encodePlacements(defaultPlacements(reference, source, ids)) })
    expect(plan(trains.slice(0, 3).map(train => train.id))).toMatchObject({ allowed: false, reason: expect.stringMatching(/exactly 8 x rods.*3 selected/) })
    expect(plan([...trains.slice(0, 7), trains[21]!].map(train => train.id))).toMatchObject({ allowed: false, reason: expect.stringMatching(/only x rods/) })
    expect(plan(['missing'])).toMatchObject({ allowed: false })
    const notCandidate = build(reference, 20, 1)
    expect(plan(notCandidate.slice(0, 8).map(train => train.id), notCandidate)).toMatchObject({ allowed: false, reason: expect.stringMatching(/hold/) })
  })

  it('selects whole trains inside a multi-unit train only when the count is exact', () => {
    const parts: TrainPart[] = Array.from({ length: 21 }, (_, index) => ({ value: 3 as CuisenaireRodValue, offset: { x: index, y: 0 }, orientation: 'vertical' }))
    const trains = [{ id: 'block', anchor: { x: 2, y: 0 }, parts }, unitTrain(23, 0, 8, 'y1')]
    expect(exchangeSelection(reference, trains)).toMatchObject({ reason: expect.stringMatching(/Separate the x rods/) })
    expect(planCountTransform(reference, trains, ['block'], { name: 'count-exchange' })).toMatchObject({ allowed: false, reason: expect.stringMatching(/21 selected/) })
  })

  it('refuses a stale preview and leaves the scene unchanged', () => {
    const scene = sceneWith(reference, build(reference, 21, 1))
    const selection = exchangeSelection(reference, scene.trains.value)
    if (!('ids' in selection)) throw new Error(selection.reason)
    const params = encodePlacements(defaultPlacements(reference, scene.trains.value, selection.ids))
    const planned = planSystemsTransform(reference, scene.trains.value, selection.ids, { name: 'count-exchange', params })
    if (!planned.allowed) throw new Error(planned.reason)
    const y = scene.trains.value.find(train => train.parts[0]!.value === 8)!
    expect(scene.apply([y.id], { type: 'move', delta: { x: 1, y: 0 } }).allowed).toBe(true)
    const before = JSON.stringify(scene.trains.value)
    const result = scene.apply(selection.ids, { type: 'board-transform', transform: { name: 'count-exchange', params, expected: planned.plan.key } })
    expect(result).toMatchObject({ allowed: false, reason: 'The rods changed. Open the preview again.' })
    expect(JSON.stringify(scene.trains.value)).toBe(before)
  })

  it('assigns fresh IDs and arranges loose rods without changing counts', () => {
    const trains = [unitTrain(10, 0, 8, 'y'), unitTrain(4, 2, 3, 'x1'), unitTrain(7, 0, 3, 'x2')]
    const scene = sceneWith(reference, trains)
    const planned = planSystemsTransform(reference, scene.trains.value, ['x1'], { name: 'count-arrange' })
    if (!planned.allowed) throw new Error(planned.reason)
    expect(scene.apply(['x1'], { type: 'board-transform', transform: { name: 'count-arrange', expected: planned.plan.key } }).allowed).toBe(true)
    const evaluation = evaluateCountSystem(reference, scene.trains.value)
    expect(evaluation.valid && evaluation.canonical).toBe(true)
    expect(evaluation.valid && evaluation.counts).toEqual({ xCount: 2, yCount: 1 })
    expect(new Set(scene.trains.value.map(train => train.id)).size).toBe(3)
    expect(planSystemsTransform(reference, scene.trains.value, [scene.trains.value[0]!.id], { name: 'count-arrange' }))
      .toMatchObject({ allowed: false, reason: 'The rods already stand x first, then y.' })
  })

  it('never plans row-length commands on rod-count boards, or the reverse', () => {
    const trains = build(reference, 21, 1)
    expect(planSystemsTransform(reference, trains, [trains[0]!.id], { name: 'repeat-row' })).toMatchObject({ allowed: false })
    const legacy = systemsFixtures.development.config as SystemsBoardConfig
    expect(planSystemsTransform(legacy, [], ['x'], { name: 'count-exchange' })).toMatchObject({ allowed: false })
  })
})

describe('rod-count persistence', () => {
  const adapter: LevelDocumentAdapter = {
    board: { kind: 'systems', config: reference },
    goals: createSystemsGoalAdapter(reference),
    validateSnapshot: snapshot => validateSnapshot(snapshot, policyFor(reference)),
  }

  it('restores saved Equation 1 rods and regenerates the derived check', () => {
    const steps = [{ id: 's1', title: '', prompt: '', trains: build(reference, 13, 4), goal: null }]
    const result = validateLevelDocument({ version: 1, board: adapter.board, steps }, adapter)
    if (!result.allowed) throw new Error(result.reason)
    const evaluation = evaluateCountSystem(reference, result.value.steps[0]!.trains)
    expect(evaluation.valid && evaluation.lower?.total).toBe(133)
  })

  it('rejects derived lower rods in a saved snapshot', () => {
    const steps = [{ id: 's1', title: '', prompt: '', trains: derivedLowerTrains(reference, { xCount: 1, yCount: 1 }), goal: null }]
    expect(validateLevelDocument({ version: 1, board: adapter.board, steps }, adapter).allowed).toBe(false)
  })

  it('does not load a rod-count level into a row-length board with the same equations', () => {
    const rowLength = { ...reference, strategy: undefined } as SystemsBoardConfig
    const result = validateLevelDocument({ version: 1, board: { kind: 'systems', config: rowLength }, steps: [] }, adapter)
    expect(result).toMatchObject({ allowed: false, reason: expect.stringMatching(/rod-count/) })
  })

  it('offers one goal region: the learner band', () => {
    expect(createSystemsGoalAdapter(reference).regions.map(region => region.id)).toEqual(['equation-1:rods'])
  })
})
