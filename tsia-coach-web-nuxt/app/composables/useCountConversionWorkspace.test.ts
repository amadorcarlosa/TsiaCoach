import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import type { RodTrain, ScenePolicy } from '~/components/rod/scene/rod.scene.types'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { evaluateCountSystem } from '~/components/systems/systems.count-evaluate'
import { countLayout, unitTrain } from '~/components/systems/systems.count-layout'
import { exchangeSelection } from '~/components/systems/systems.count-operations'
import { systemsFixtures } from '~/components/systems/systems.fixtures'
import { planSystemsTransform } from '~/components/systems/systems.operations'
import type { SystemsBoardConfig } from '~/components/systems/systems.schema'
import { useCountConversionWorkspace } from './useCountConversionWorkspace'
import { useRodScene } from './useRodScene'

const reference = systemsFixtures.rodCountReference.config as SystemsBoardConfig
const small = systemsFixtures.rodCountSmall.config as SystemsBoardConfig

function setup(config: SystemsBoardConfig, xCount: number, yCount: number) {
  const layout = countLayout(config)
  const { x: a, y: b } = config.system.equations[0].coefficients
  const policy: ScenePolicy = {
    columns: layout.columns,
    rows: layout.rows,
    spawnRows: [layout.upper.y],
    regions: layout.regions,
    editable: () => true,
    allowOrientation: true,
    allowFactors: true,
    regionBoundEdits: true,
    planTransform: (trains, ids, transform) => {
      const result = planSystemsTransform(config, trains, ids, transform)
      return result.allowed ? { allowed: true, remove: result.plan.remove, add: result.plan.add } : result
    },
  }
  const scene = useRodScene(policy)
  const trains: RodTrain[] = [
    ...Array.from({ length: xCount }, (_, index) => unitTrain(layout.upper.x + index, 0, a, `x${index}`)),
    ...Array.from({ length: yCount }, (_, index) => unitTrain(layout.upper.x + xCount + index, 0, b, `y${index}`)),
  ]
  expect(scene.replace(trains).allowed).toBe(true)
  const workspace = useCountConversionWorkspace({ config: shallowRef(config), scene, editable: () => true })
  return { scene, workspace, layout }
}

const committed = (scene: ReturnType<typeof useRodScene>) => JSON.stringify(copyScene(scene.trains.value))

/** The learner has already gathered eight lying 3-rods into a 3 × 8 block. */
function layOutSources(scene: ReturnType<typeof useRodScene>) {
  const ids = Array.from({ length: 8 }, (_, index) => `x${13 + index}`)
  const arranged = copyScene(scene.trains.value).map(train => {
    const row = ids.indexOf(train.id)
    if (row >= 0) return {
      ...train,
      anchor: { x: 18, y: row },
      parts: train.parts.map(part => ({ ...part, orientation: 'horizontal' as const })),
    }
    return train.id === 'y0' ? { ...train, anchor: { x: 25, y: 0 } } : train
  })
  expect(scene.replace(arranged).allowed).toBe(true)
  scene.select(ids)
  return ids
}

/** Select an exchange's x rods, open the workspace, make the target rectangle and group it. */
function convert(config: SystemsBoardConfig, scene: ReturnType<typeof useRodScene>, workspace: ReturnType<typeof useCountConversionWorkspace>) {
  const selection = exchangeSelection(config, scene.trains.value)
  if (!('ids' in selection)) throw new Error(selection.reason)
  expect(workspace.begin(selection.ids).allowed).toBe(true)
  const { draft } = workspace
  const shape = workspace.suggestedShape.value!
  const made = draft.apply([...draft.selection.value], { type: 'make-rectangle', shape })
  if (!made.allowed) throw new Error(made.reason)
  expect(workspace.assessment.value?.ready).toBe(false)
  const grouped = draft.apply(made.createdIds, { type: 'regroup-area', grouping: 'columns' })
  if (!grouped.allowed) throw new Error(grouped.reason)
  return selection.ids
}

describe('conversion workspace', () => {
  it('converts whole x rods that the learner has already laid horizontally', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    const ids = layOutSources(scene)
    const before = committed(scene)
    const unfinished = evaluateCountSystem(reference, scene.trains.value)
    expect(unfinished.valid && unfinished.material.unassignedArea).toBe(24)
    expect(workspace.availability.value).toEqual({ allowed: true })
    expect(workspace.begin(ids).allowed).toBe(true)
    expect(workspace.session.value?.baselineCounts).toEqual({ xCount: 21, yCount: 1 })
    expect(committed(scene)).toBe(before)

    const rectangle = workspace.draft.apply(ids, { type: 'make-rectangle', shape: workspace.suggestedShape.value! })
    if (!rectangle.allowed) throw new Error(rectangle.reason)
    expect(workspace.draft.apply(rectangle.createdIds, { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(true)
    expect(workspace.apply().allowed).toBe(true)
    const after = evaluateCountSystem(reference, scene.trains.value)
    expect(after.valid && after.counts).toEqual({ xCount: 13, yCount: 4 })
    expect(after.valid && after.lower?.total).toBe(133)
  })

  it('cancels a conversion of lying rods back to their exact unfinished arrangement', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    const ids = layOutSources(scene)
    const before = committed(scene)
    expect(workspace.begin(ids).allowed).toBe(true)
    expect(workspace.draft.apply(ids, { type: 'make-rectangle', shape: workspace.suggestedShape.value! }).allowed).toBe(true)
    expect(workspace.cancel()).toBe(true)
    expect(committed(scene)).toBe(before)
    expect([...scene.selection.value]).toEqual(ids)
  })

  it('does not reinterpret unselected unfinished material as conversion sources', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    const ids = layOutSources(scene)
    // A tower has the same physical magnitude, but cannot be an area source.
    expect(scene.apply([ids[0]!], { type: 'set-orientation', orientation: 'tower' }).allowed).toBe(true)
    expect(workspace.begin(ids).allowed).toBe(false)
    expect(workspace.active.value).toBe(false)
    expect(scene.apply([ids[0]!], { type: 'set-orientation', orientation: 'horizontal' }).allowed).toBe(true)
    // The selected eight are complete, but a ninth unfinished x rod outside the
    // selection must still prevent us claiming a feasible source candidate.
    expect(scene.apply(['x0'], { type: 'set-orientation', orientation: 'tower' }).allowed).toBe(true)
    expect(workspace.begin(ids).allowed).toBe(false)
    expect(workspace.active.value).toBe(false)
  })

  it('opens on a selection without changing the committed scene or its counts', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    const before = committed(scene)
    const selection = exchangeSelection(reference, scene.trains.value)
    if (!('ids' in selection)) throw new Error(selection.reason)
    expect(workspace.begin(selection.ids).allowed).toBe(true)
    expect(committed(scene)).toBe(before)
    expect(workspace.session.value?.baselineCounts).toEqual({ xCount: 21, yCount: 1 })
    expect(workspace.session.value?.protectedIds.size).toBe(14)
    expect(workspace.assessment.value).toMatchObject({ area: 24, required: 24, grouping: '8 groups of 3', target: '3 groups of 8', ready: false })
    expect(workspace.assessment.value?.summary).toBe('24 cells being converted: 8 groups of 3 → 3 groups of 8')
  })

  it('refuses a selection that is not exactly one exchange of whole x rods', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    expect(workspace.begin(['x0', 'x1']).allowed).toBe(false)
    expect(workspace.begin(['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'y0']).allowed).toBe(false)
    expect(workspace.active.value).toBe(false)
    expect(workspace.message.value).toMatch(/only x rods/)
    void scene
  })

  it('keeps clone, delete and decomposition in the draft, and gates Apply on area and grouping', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    const before = committed(scene)
    const sources = convert(reference, scene, workspace)
    expect(workspace.assessment.value?.ready).toBe(true)
    const { draft } = workspace
    const groups = draft.trains.value.filter(train => !workspace.protectedIds.value.has(train.id))
    expect(groups).toHaveLength(1)

    // Clone: 48 cells in the workspace blocks Apply.
    const cloned = draft.apply([groups[0]!.id], { type: 'clone' })
    if (!cloned.allowed) throw new Error(cloned.reason)
    expect(workspace.assessment.value).toMatchObject({ ready: false, reason: '48 cells in workspace; this exchange requires 24.' })
    expect(workspace.apply().allowed).toBe(false)
    expect(committed(scene)).toBe(before)

    // Deleting the clone restores availability.
    expect(draft.apply(cloned.createdIds, { type: 'delete' }).allowed).toBe(true)
    expect(workspace.assessment.value?.ready).toBe(true)

    // Wrong grouping blocks it again; regrouping restores it.
    expect(draft.apply([groups[0]!.id], { type: 'regroup-area', grouping: 'rows' }).allowed).toBe(true)
    expect(workspace.assessment.value?.ready).toBe(false)
    expect(draft.apply([groups[0]!.id], { type: 'regroup-area', grouping: 'columns' }).allowed).toBe(true)
    expect(workspace.assessment.value?.ready).toBe(true)

    // Protected rods refuse edits through the scene itself.
    expect(draft.apply(['y0'], { type: 'move', delta: { x: 1, y: 0 } }).allowed).toBe(false)
    expect(committed(scene)).toBe(before)
    void sources
  })

  it('applies the reference sequence atomically, keeping every unaffected rod', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    for (const [expected, lower] of [[{ xCount: 13, yCount: 4 }, 133], [{ xCount: 5, yCount: 7 }, 73]] as const) {
      const sources = new Set(convert(reference, scene, workspace))
      const untouched = scene.trains.value.filter(train => !sources.has(train.id)).map(train => JSON.stringify(train))
      const result = workspace.apply()
      expect(result.allowed).toBe(true)
      expect(workspace.active.value).toBe(false)
      const evaluation = evaluateCountSystem(reference, scene.trains.value)
      if (!evaluation.valid) throw new Error(evaluation.reason)
      expect(evaluation.counts).toEqual(expected)
      expect(evaluation.upper.total).toBe(71)
      expect(evaluation.lower?.total).toBe(lower)
      const now = scene.trains.value.map(train => JSON.stringify(train))
      for (const train of untouched) expect(now).toContain(train)
      // Three independent upright 8-rods, none with a draft ID.
      if (!result.allowed) return
      expect(result.createdIds).toHaveLength(3)
      const created = scene.trains.value.filter(train => result.createdIds.includes(train.id))
      expect(created.every(train => train.parts.length === 1 && train.parts[0]!.value === 8 && train.parts[0]!.orientation === 'vertical')).toBe(true)
    }
    const solved = evaluateCountSystem(reference, scene.trains.value)
    expect(solved.valid && solved.solved).toBe(true)
  })

  it('converts three 4-rods into two 6-rods on 4x + 6y = 34', () => {
    const { scene, workspace } = setup(small, 7, 1)
    convert(small, scene, workspace)
    expect(workspace.assessment.value).toMatchObject({ area: 12, ready: true, target: '2 groups of 6' })
    expect(workspace.apply().allowed).toBe(true)
    const evaluation = evaluateCountSystem(small, scene.trains.value)
    expect(evaluation.valid && evaluation.counts).toEqual({ xCount: 4, yCount: 3 })
  })

  it('cancels back to exactly the baseline, restoring the source selection', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    const before = committed(scene)
    const sources = convert(reference, scene, workspace)
    const material = workspace.material.value.map(train => train.id)
    workspace.draft.apply(material, { type: 'clone' })
    workspace.draft.apply(material, { type: 'move', delta: { x: 0, y: 0 } })
    expect(workspace.cancel()).toBe(true)
    expect(committed(scene)).toBe(before)
    expect([...scene.selection.value].sort()).toEqual([...sources].sort())
  })

  it('treats a changed committed scene as stale and changes nothing', () => {
    const { scene, workspace } = setup(reference, 21, 1)
    convert(reference, scene, workspace)
    // An outside change to the committed board, such as a restore.
    expect(scene.replace(copyScene(scene.trains.value).map(train => train.id === 'y0' ? { ...train, id: 'y-renamed' } : train)).allowed).toBe(true)
    const before = committed(scene)
    expect(workspace.apply()).toMatchObject({ allowed: false, reason: expect.stringMatching(/board changed/) })
    expect(committed(scene)).toBe(before)
    expect(workspace.active.value).toBe(false)
  })
})
