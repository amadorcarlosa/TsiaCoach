import { describe, expect, it } from 'vitest'
import type { CuisenaireRodValue } from '~/components/rod/rod.types'
import type { RodTrain, ScenePolicy, TrainPart } from '~/components/rod/scene/rod.scene.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { validateSnapshot } from '~/components/rod/scene/validate-snapshot'
import { useRodScene } from '~/composables/useRodScene'
import { validateLevelDocument, type LevelDocumentAdapter } from '~/components/playground/files/level-document'
import { createSystemsGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import { evaluateSystem } from './systems.evaluate'
import { agreementFeedback, equationFeedback, groupFeedback, systemFeedback } from './systems.feedback'
import { systemsFixtures } from './systems.fixtures'
import { systemsGeometry, variableRegionId, type VariableRegion } from './systems.geometry'
import { planSystemsTransform, redistributionPairs, rowParts, systemsReasons } from './systems.operations'
import { systemsBoardConfigSchema, type SystemsBoardConfig, type VariableId } from './systems.schema'

const development = systemsFixtures.development.config as SystemsBoardConfig
const longVariable = systemsFixtures.longVariable.config as SystemsBoardConfig

let counter = 0
const region = (config: SystemsBoardConfig, equation: 1 | 2, variable: VariableId): VariableRegion =>
  systemsGeometry(config).variableRegions.find(item => item.id === variableRegionId(`equation-${equation}`, variable))!

/** One train per row; `split` chooses the rods in each row. */
function rows(target: VariableRegion, length: number, options: { start?: number; split?: number[]; lanes?: number[] } = {}): RodTrain[] {
  const lanes = options.lanes ?? Array.from({ length: target.coefficient }, (_, lane) => lane)
  return lanes.map(lane => {
    const sizes = options.split ?? rowParts(length).map(part => part.value)
    let offset = 0
    const parts: TrainPart[] = sizes.map(value => {
      const part: TrainPart = { value: value as CuisenaireRodValue, offset: { x: offset, y: 0 }, orientation: 'horizontal' }
      offset += value
      return part
    })
    return { id: `t${++counter}`, anchor: { x: target.x + (options.start ?? 0), y: target.y + lane }, parts }
  })
}

const model = (config: SystemsBoardConfig, values: [number, number], equations: (1 | 2)[] = [1, 2]) =>
  equations.flatMap(equation => [
    ...rows(region(config, equation, 'x'), values[0]),
    ...rows(region(config, equation, 'y'), values[1]),
  ])

const valid = (config: SystemsBoardConfig, scene: RodTrain[]) => {
  const result = evaluateSystem(config, scene)
  if (!result.valid) throw new Error(result.reason)
  return result
}

function policy(config: SystemsBoardConfig): ScenePolicy {
  const geometry = systemsGeometry(config)
  return {
    columns: geometry.columns, rows: geometry.rows, spawnRows: [geometry.staging.y], regions: geometry.regions,
    editable: () => true, allowOrientation: true, allowFactors: true, regionBoundEdits: true,
    planTransform: (trains, ids, transform) => {
      const result = planSystemsTransform(config, trains, ids, transform)
      return result.allowed ? { allowed: true, remove: result.plan.remove, add: result.plan.add } : result
    },
  }
}

describe('systems schema and geometry', () => {
  it('accepts both fixtures and rejects invalid problems', () => {
    expect(systemsBoardConfigSchema.safeParse(development).success).toBe(true)
    expect(systemsBoardConfigSchema.safeParse(longVariable).success).toBe(true)
    const bad = (patch: (config: SystemsBoardConfig) => void) => {
      const config = JSON.parse(JSON.stringify(development))
      patch(config)
      return systemsBoardConfigSchema.safeParse(config).success
    }
    expect(bad(config => { config.system.equations[0].coefficients.x = 0 })).toBe(false)
    expect(bad(config => { config.system.equations[0].coefficients.x = 1.5 })).toBe(false)
    expect(bad(config => { config.system.equations[0].targetArea = -1 })).toBe(false)
    expect(bad(config => { config.system.equations[1].id = 'equation-1' })).toBe(false)
    expect(bad(config => { config.laneColumns = 0 })).toBe(false)
    expect(bad(config => { Reflect.set(config, 'extra', 1) })).toBe(false)
  })

  it('derives four lane regions from the coefficients, plus staging', () => {
    const geometry = systemsGeometry(development)
    expect(geometry.variableRegions.map(item => [item.id, item.depth, item.width])).toEqual([
      ['equation-1:x', 3, 24], ['equation-1:y', 5, 24], ['equation-2:x', 4, 24], ['equation-2:y', 2, 24],
    ])
    const [a, b, c, d] = geometry.variableRegions
    // Heading, x lanes, separator, y lanes, then the next heading.
    expect([a!.y, b!.y, c!.y, d!.y]).toEqual([1, 5, 11, 16])
    expect(geometry.staging.y).toBe(19)
    expect(geometry.rows).toBe(23)
    expect(geometry.columns).toBe(28)
    expect(geometry.variableRegions.every(item => item.x === 4)).toBe(true)
  })
})

describe('systems evaluation', () => {
  it('x=3, y=5 satisfies both equations', () => {
    const result = valid(development, model(development, [3, 5]))
    expect(result.equations.map(item => [item.occupiedArea, item.satisfied])).toEqual([[34, true], [22, true]])
    expect(result.agreement).toEqual({ x: 'agrees', y: 'agrees' })
    expect(result.satisfied).toBe(true)
    expect(systemFeedback(result)).toBe('Both equations hold with the same x and the same y.')
  })

  it('x=8, y=2 satisfies only the first; the second has 14 excess', () => {
    const result = valid(development, model(development, [8, 2]))
    expect(result.equations[0].satisfied).toBe(true)
    expect(result.equations[1]).toMatchObject({ occupiedArea: 36, difference: 14, areaMatches: false, satisfied: false })
    expect(equationFeedback(result.equations[1])).toBe('Equation 2: 36 of 22 cells; 14 excess. Both groups form rectangles.')
    expect(result.satisfied).toBe(false)
  })

  it('x=14, y=4 solves the long-variable system with rods of at most 10', () => {
    const scene = model(longVariable, [14, 4])
    expect(scene.flatMap(train => train.parts).every(part => part.value <= 10)).toBe(true)
    const result = valid(longVariable, scene)
    expect(result.satisfied).toBe(true)
    expect(result.equations[0].groups.x.length).toBe(14)
  })

  it.each([[[10, 4]], [[7, 7]], [Array(14).fill(1)]])('a row of 14 made as %j evaluates the same', split => {
    const x = rows(region(longVariable, 1, 'x'), 14, { split })
    const scene = [...x, ...rows(region(longVariable, 1, 'y'), 4)]
    const result = valid(longVariable, scene)
    expect(result.equations[0].groups.x).toMatchObject({ status: 'rectangle', length: 14, occupiedArea: 28 })
    expect(result.equations[0].satisfied).toBe(true)
  })

  it('independent rods in one row count as one row', () => {
    const target = region(development, 1, 'x')
    const halves = [0, 1, 2].flatMap(lane => [
      { id: `a${lane}`, anchor: { x: target.x, y: target.y + lane }, parts: [{ value: 2 as const, offset: { x: 0, y: 0 }, orientation: 'horizontal' as const }] },
      { id: `b${lane}`, anchor: { x: target.x + 2, y: target.y + lane }, parts: [{ value: 1 as const, offset: { x: 0, y: 0 }, orientation: 'horizontal' as const }] },
    ])
    expect(valid(development, halves).equations[0].groups.x).toMatchObject({ status: 'rectangle', length: 3 })
  })

  it('reports shape problems without claiming a value', () => {
    const x = region(development, 1, 'x')
    const cases: [RodTrain[], string][] = [
      [[], 'empty'],
      [rows(x, 3, { lanes: [0, 1] }), 'incomplete'],
      [[...rows(x, 3, { lanes: [0, 1] }), ...rows(x, 1, { lanes: [2] }), ...rows(x, 2, { lanes: [2], start: 2 })], 'gaps'],
      [[...rows(x, 3, { lanes: [0, 1] }), ...rows(x, 4, { lanes: [2] })], 'unequal-widths'],
      [[...rows(x, 3, { lanes: [0, 1] }), ...rows(x, 3, { lanes: [2], start: 1 })], 'misaligned'],
      [rows(x, 3, { start: 5 }), 'rectangle'],
    ]
    for (const [scene, status] of cases) {
      const group = valid(development, scene).equations[0].groups.x
      expect(group.status).toBe(status)
      expect(group.length === null).toBe(status !== 'rectangle')
      expect(groupFeedback(group)).toBeTruthy()
    }
  })

  it('right area with an invalid shape is not satisfied', () => {
    // 34 cells in equation 1, but the x rows are unequal (4, 3, 2 = 9).
    const x = region(development, 1, 'x')
    const scene = [
      ...rows(x, 4, { lanes: [0] }), ...rows(x, 3, { lanes: [1] }), ...rows(x, 2, { lanes: [2] }),
      ...rows(region(development, 1, 'y'), 5),
    ]
    const result = valid(development, scene).equations[0]
    expect(result.areaMatches).toBe(true)
    expect(result.satisfied).toBe(false)
  })

  it('two locally satisfied equations with different values never satisfy the system', () => {
    // Equation 1 with x=8,y=2 (34); equation 2 with x=3,y=5 (22).
    const scene = [...model(development, [8, 2], [1]), ...model(development, [3, 5], [2])]
    const result = valid(development, scene)
    expect(result.equations.every(item => item.satisfied)).toBe(true)
    expect(result.agreement).toEqual({ x: 'disagrees', y: 'disagrees' })
    expect(result.satisfied).toBe(false)
    expect(agreementFeedback(result, 'x')).toBe('Both x groups are rectangles, but their lengths disagree (8 and 3).')
  })

  it('incomplete groups report agreement as unknown, never as equal', () => {
    const result = valid(development, model(development, [3, 5], [1]))
    expect(result.agreement).toEqual({ x: 'unknown', y: 'unknown' })
  })

  it('excludes staging, refuses overlaps, negatives and stray trains', () => {
    const staging = systemsGeometry(development).staging
    const loose: RodTrain = { id: 'loose', anchor: { x: staging.x, y: staging.y }, parts: [{ value: 9, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }
    const result = valid(development, [...model(development, [3, 5]), loose])
    expect(result.satisfied).toBe(true)
    expect(result.stagingArea).toBe(9)

    const x = rows(region(development, 1, 'x'), 3)
    expect(evaluateSystem(development, [...x, { ...x[0]!, id: 'twin' }])).toEqual({ valid: false, reason: 'Two rods share the same cells.' })
    expect(evaluateSystem(development, [{ ...loose, parts: [{ ...loose.parts[0]!, sign: -1 }] }]).valid).toBe(false)
    expect(evaluateSystem(development, [{ ...loose, anchor: { x: 0, y: 0 } }]).valid).toBe(false)
  })
})

describe('systems planners', () => {
  it('repeats a [10, 4] row into three x lanes as independent [10, 4] trains', () => {
    const x = region(development, 1, 'x')
    const [row] = rows(x, 14, { lanes: [1], split: [10, 4], start: 2 })
    const result = planSystemsTransform(development, [row!], [row!.id], { name: 'repeat-row' })
    expect(result.allowed).toBe(true)
    if (!result.allowed) return
    expect(result.plan.remove).toEqual([row!.id])
    expect(result.plan.add.map(train => [train.anchor, train.parts.map(part => part.value)])).toEqual([0, 1, 2]
      .map(lane => [{ x: x.x + 2, y: x.y + lane }, [10, 4]]))
    expect(result.plan.conserves).toBe(false)
  })

  it('repeat row refuses occupied lanes, loose rows and several trains', () => {
    const x = region(development, 1, 'x')
    const [row] = rows(x, 6, { lanes: [0] })
    const [blocker] = rows(x, 2, { lanes: [2], start: 3 })
    expect(planSystemsTransform(development, [row!, blocker!], [row!.id], { name: 'repeat-row' }))
      .toEqual({ allowed: false, reason: systemsReasons.occupied })
    expect(planSystemsTransform(development, [row!, blocker!], [row!.id, blocker!.id], { name: 'repeat-row' }))
      .toEqual({ allowed: false, reason: systemsReasons.makeTrain })
    const staging = systemsGeometry(development).staging
    const loose: RodTrain = { id: 'loose', anchor: { x: staging.x, y: staging.y }, parts: [{ value: 4, offset: { x: 0, y: 0 }, orientation: 'horizontal' }] }
    expect(planSystemsTransform(development, [loose], ['loose'], { name: 'repeat-row' }))
      .toEqual({ allowed: false, reason: systemsReasons.inGroup })
  })

  it('arranges 42 cells into 3 rows of 14 and keeps the area', () => {
    const x = region(development, 1, 'x')
    const scene = [...rows(x, 10, { lanes: [0] }), ...rows(x, 10, { lanes: [1] }), ...rows(x, 10, { lanes: [2] }), ...rows(x, 10, { lanes: [0], start: 10 }), ...rows(x, 2, { lanes: [1], start: 10 })]
    const result = planSystemsTransform(development, scene, [scene[0]!.id], { name: 'arrange-rows' })
    expect(result.allowed).toBe(true)
    if (!result.allowed) return
    expect(result.plan.add.map(train => train.parts.map(part => part.value))).toEqual([[10, 4], [10, 4], [10, 4]])
    expect(result.plan.remove).toHaveLength(scene.length)
    expect(result.plan.conserves).toBe(true)
  })

  it('explains when an area cannot form the coefficient rows', () => {
    const x = region(development, 1, 'x')
    const scene = [...rows(x, 20, { lanes: [0], split: [10, 10] }), ...rows(x, 5, { lanes: [1] })]
    expect(planSystemsTransform(development, scene, [scene[0]!.id], { name: 'arrange-rows' }))
      .toEqual({ allowed: false, reason: 'This group has 25 cells; 25 cannot form 3 equal whole-number rows.' })
  })

  it('lists every single-equation split without ranking the system solution', () => {
    expect(redistributionPairs(3, 5, 34, 24)).toEqual([[3, 5], [8, 2]])
    const scene = model(development, [8, 2], [1])
    const result = planSystemsTransform(development, scene, [scene[0]!.id], { name: 'redistribute', params: { x: 3, y: 5 } })
    expect(result.allowed).toBe(true)
    if (!result.allowed) return
    expect(result.plan.conserves).toBe(true)
    const after = valid(development, [...result.plan.add])
    expect(after.equations[0]).toMatchObject({ occupiedArea: 34, satisfied: true })
    expect(planSystemsTransform(development, scene, [scene[0]!.id], { name: 'redistribute', params: { x: 4, y: 4 } }).allowed).toBe(false)
  })

  it('tests a candidate in the other equation without changing the source', () => {
    const source = model(development, [8, 2], [1])
    const result = planSystemsTransform(development, source, [source[0]!.id], { name: 'test-candidate' })
    expect(result.allowed).toBe(true)
    if (!result.allowed) return
    expect(result.plan.remove).toEqual([])
    expect(result.plan.lines).toContain('Equation 2 would have 36 of 22 cells: 14 excess.')
    const after = valid(development, [...source, ...result.plan.add])
    expect(after.equations[1].occupiedArea).toBe(36)
    expect(after.equations[0].groups.x.length).toBe(8)
  })

  it('a stale expected key is refused', () => {
    const scene = model(development, [8, 2], [1])
    const first = planSystemsTransform(development, scene, [scene[0]!.id], { name: 'test-candidate' })
    if (!first.allowed) throw new Error(first.reason)
    // Slide the whole x rectangle one column: still a valid candidate, but not the previewed one.
    const xRegion = region(development, 1, 'x')
    const moved = scene.map(train => train.anchor.y < xRegion.y + xRegion.depth ? { ...train, anchor: { ...train.anchor, x: train.anchor.x + 1 } } : train)
    expect(planSystemsTransform(development, moved, [scene[0]!.id], { name: 'test-candidate', expected: first.plan.key }))
      .toEqual({ allowed: false, reason: systemsReasons.stale })
    expect(planSystemsTransform(development, scene, [scene[0]!.id], { name: 'test-candidate', expected: first.plan.key }).allowed)
      .toBe(true)
  })
})

describe('systems scene integration', () => {
  const state = (scene: ReturnType<typeof useRodScene>) =>
    JSON.stringify({ trains: scene.trains.value, selection: [...scene.selection.value] })

  it('commits a board transform atomically and selects the new rows', () => {
    const scene = useRodScene(policy(development))
    const x = region(development, 1, 'x')
    const [row] = rows(x, 14, { lanes: [0], split: [10, 4] })
    const other = rows(region(development, 2, 'y'), 2)
    expect(scene.replace([row!, ...other]).allowed).toBe(true)
    const result = scene.apply([row!.id], { type: 'board-transform', transform: { name: 'repeat-row' } })
    expect(result.allowed && result.createdIds).toHaveLength(3)
    expect([...scene.selection.value]).toEqual(result.allowed ? result.createdIds : [])
    // Unselected regions are unchanged, train for train.
    expect(copyScene(scene.trains.value).filter(train => other.some(item => item.id === train.id))).toEqual(copyScene(other))
  })

  it('a failing transform changes nothing and allocates no IDs', () => {
    const scene = useRodScene(policy(development))
    const x = region(development, 1, 'x')
    const scene0 = [...rows(x, 6, { lanes: [0] }), ...rows(x, 2, { lanes: [2], start: 3 })]
    scene.replace(scene0)
    const before = state(scene)
    expect(scene.apply([scene0[0]!.id], { type: 'board-transform', transform: { name: 'repeat-row' } }).allowed).toBe(false)
    expect(state(scene)).toBe(before)
    const created = scene.apply([], { type: 'create', value: 1, regionId: 'staging' })
    expect(created.allowed && created.createdIds).toEqual(['train-1'])
  })

  it('boards without a planner refuse board transforms', () => {
    const plain = useRodScene({ columns: 10, rows: 4, spawnRows: [0], editable: () => true, allowOrientation: true })
    plain.apply([], { type: 'create', value: 3 })
    const id = plain.trains.value[0]!.id
    expect(plain.apply([id], { type: 'board-transform', transform: { name: 'repeat-row' } }))
      .toEqual({ allowed: false, reason: 'This board has no such command.' })
  })

  it('keeps joins and clones inside the source group', () => {
    const scene = useRodScene(policy(development))
    const [a] = rows(region(development, 1, 'x'), 4, { lanes: [0] })
    const [b] = rows(region(development, 1, 'y'), 4, { lanes: [0] })
    scene.replace([a!, b!])
    expect(scene.check([a!.id, b!.id], { type: 'make-train' })).toEqual({ allowed: false, reason: 'Select rods from one group.' })
    expect(scene.apply([a!.id], { type: 'clone' }).allowed).toBe(true)
    const clone = scene.trains.value.at(-1)!
    const x = region(development, 1, 'x')
    expect(clone.anchor.y).toBeGreaterThanOrEqual(x.y)
    expect(clone.anchor.y).toBeLessThan(x.y + x.depth)
  })

  it('rejects negative rods and vertical rods in lanes', () => {
    const p = policy(development)
    const [row] = rows(region(development, 1, 'x'), 3, { lanes: [0] })
    expect(validateSnapshot([{ ...row!, parts: [{ ...row!.parts[0]!, sign: -1 }] }], p).allowed).toBe(false)
    const scene = useRodScene(p)
    scene.replace([row!])
    expect(scene.check([row!.id], { type: 'set-orientation', orientation: 'vertical' }).allowed).toBe(false)
  })
})

describe('systems level files', () => {
  const adapter = (config: SystemsBoardConfig): LevelDocumentAdapter => ({
    board: { kind: 'systems', config },
    goals: createSystemsGoalAdapter(config),
    validateSnapshot: snapshot => validateSnapshot(snapshot, policy(config)),
  })

  it('round-trips the full problem and every step', () => {
    const document = JSON.parse(JSON.stringify({
      version: 1,
      board: { kind: 'systems', config: development },
      steps: [
        { id: 's1', title: 'Start', prompt: '', trains: [], goal: null },
        { id: 's2', title: 'Candidate', prompt: '', trains: model(development, [8, 2]), goal: null },
      ],
    }))
    const result = validateLevelDocument(document, adapter(development))
    expect(result.allowed).toBe(true)
    expect(result.allowed && result.value.board).toEqual({ kind: 'systems', config: development })
  })

  it('names both problems when they differ, and rejects a bad later step', () => {
    const document = { version: 1, board: { kind: 'systems', config: longVariable }, steps: [] }
    const result = validateLevelDocument(document, adapter(development))
    expect(!result.allowed && result.reason).toContain('2x + y = 32')
    expect(!result.allowed && result.reason).toContain('3x + 5y = 34')

    const overlap = model(development, [3, 5])
    const bad = { version: 1, board: { kind: 'systems', config: development }, steps: [
      { id: 's1', title: '', prompt: '', trains: [], goal: null },
      { id: 's2', title: '', prompt: '', trains: [...overlap, { ...overlap[0]!, id: 'twin' }], goal: null },
    ] }
    expect(validateLevelDocument(JSON.parse(JSON.stringify(bad)), adapter(development)).allowed).toBe(false)
  })
})
