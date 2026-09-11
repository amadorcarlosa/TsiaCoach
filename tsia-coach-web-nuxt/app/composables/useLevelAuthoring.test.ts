import { createArrayGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
import { describe, expect, it, vi } from 'vitest'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { useLevelAuthoring } from './useLevelAuthoring'
import { useRodScene } from './useRodScene'

function setup() {
  let editable = true
  const scene = useRodScene({
    columns: 24, rows: 12, spawnRows: [4],
    editable: () => editable, allowOrientation: true,
  })
  const captureScene = vi.fn(() => copyScene(scene.trains.value))
  const checkReplacement = vi.fn(scene.checkReplacement)
  const replaceScene = vi.fn(scene.replace)
  const authoring = useLevelAuthoring({
    goals: createArrayGoalAdapter({ columns: 100, rows: 100 }),
    scene: {
      read: () => scene.trains.value,
      capture: captureScene,
      checkReplacement,
      replace: replaceScene,
    },
    editable: () => editable,
  })
  const add = () => {
    expect(scene.apply([], { type: 'create', value: 2 }).allowed).toBe(true)
  }
  function twoSteps() {
    add()
    authoring.captureStep()
    add()
    authoring.captureStep()
    expect(authoring.selectStep('step-1').allowed).toBe(true)
    add()
  }
  const state = () => ({
    steps: authoring.steps.value.map(step => ({ ...step, trains: copyScene(step.trains) })),
    active: authoring.activeStepId.value,
    dirty: authoring.dirty.value,
    scene: copyScene(scene.trains.value),
    selection: [...scene.selection.value],
    message: scene.message.value,
  })
  return {
    scene, authoring, add, twoSteps, state,
    captureScene, checkReplacement, replaceScene,
    disable: () => { editable = false },
  }
}

describe('level authoring', () => {
  it('captures independent steps and board edits never mutate a saved step', () => {
    const { scene, authoring, add } = setup()
    add()
    authoring.captureStep()
    const saved = copyScene(authoring.steps.value[0]!.trains)
    expect(scene.apply(['train-1'], { type: 'move', delta: { x: 3, y: 1 } }).allowed).toBe(true)
    expect(scene.apply(['train-1'], { type: 'regroup-ones' }).allowed).toBe(true)
    expect(authoring.dirty.value).toBe(true)
    authoring.captureStep()
    expect(authoring.steps.value[0]!.trains).toEqual(saved)
    expect(authoring.steps.value.map(s => s.title)).toEqual(['Step 1', 'Step 2'])
    expect(authoring.steps.value.map(s => s.prompt)).toEqual(['', ''])
    expect(authoring.activeStepId.value).toBe('step-2')
    expect(authoring.dirty.value).toBe(false)
  })

  it('ignores selection-only changes and marks reverted board edits clean', () => {
    const { scene, authoring, add } = setup()
    add()
    authoring.captureStep()
    scene.select(['train-1'])
    expect(authoring.dirty.value).toBe(false)
    scene.select([])
    expect(authoring.dirty.value).toBe(false)
    scene.apply(['train-1'], { type: 'move', delta: { x: 1, y: 0 } })
    expect(authoring.dirty.value).toBe(true)
    scene.apply(['train-1'], { type: 'move', delta: { x: -1, y: 0 } })
    expect(authoring.dirty.value).toBe(false)
  })

  it.each(['save', 'discard', 'cancel'] as const)('%s has its own switch outcome', decision => {
    const { authoring, twoSteps, state } = setup()
    twoSteps()
    const before = state()
    expect(authoring.selectStep('step-2')).toMatchObject({ allowed: false, needsDecision: true })
    expect(state()).toEqual(before)
    const result = authoring.selectStep('step-2', decision)
    if (decision === 'cancel') {
      expect(result.allowed).toBe(false)
      expect(state()).toEqual(before)
      return
    }
    expect(result.allowed).toBe(true)
    expect(authoring.activeStepId.value).toBe('step-2')
    expect(authoring.dirty.value).toBe(false)
    expect(state().scene).toEqual(before.steps[1]!.trains)
    expect(authoring.steps.value[0]!.trains).toEqual(
      decision === 'save' ? before.scene : before.steps[0]!.trains,
    )
    expect(authoring.selectStep('step-1').allowed).toBe(true)
    expect(state().scene).toEqual(authoring.steps.value[0]!.trains)
  })

  it('updates the active step without changing its ID or adding a step', () => {
    const { authoring, add, state } = setup()
    expect(authoring.updateStep().allowed).toBe(false)
    add()
    authoring.captureStep()
    add()
    const expected = state().scene
    expect(authoring.updateStep().allowed).toBe(true)
    expect(authoring.steps.value).toHaveLength(1)
    expect(authoring.activeStepId.value).toBe('step-1')
    expect(authoring.steps.value[0]!.trains).toEqual(expected)
    expect(authoring.dirty.value).toBe(false)
  })

  it.each(['unknown', 'preflight', 'replacement'] as const)('an invalid %s destination cannot partially save or switch', failure => {
    const { authoring, twoSteps, state, captureScene, checkReplacement, replaceScene } = setup()
    twoSteps()
    const before = state()
    captureScene.mockClear()
    replaceScene.mockClear()
    if (failure === 'preflight') {
      checkReplacement.mockReturnValueOnce({ allowed: false, reason: 'Destination no longer fits.' })
    }
    if (failure === 'replacement') {
      replaceScene.mockReturnValueOnce({ allowed: false, reason: 'Replacement rejected.' })
    }
    expect(authoring.selectStep(failure === 'unknown' ? 'missing' : 'step-2', 'save').allowed).toBe(false)
    expect(state()).toEqual(before)
    if (failure !== 'replacement') {
      expect(captureScene).not.toHaveBeenCalled()
      expect(replaceScene).not.toHaveBeenCalled()
    }
  })

  it('rejects authoring while editing is disabled', () => {
    const { authoring, twoSteps, state, disable } = setup()
    twoSteps()
    const before = state()
    disable()
    expect(authoring.captureStep().allowed).toBe(false)
    expect(authoring.updateStep().allowed).toBe(false)
    expect(authoring.selectStep('step-2', 'save').allowed).toBe(false)
    expect(authoring.patchStep('step-1', { title: 'Changed' }).allowed).toBe(false)
    expect(authoring.moveStep('step-1', 'later').allowed).toBe(false)
    expect(authoring.deleteStep('step-1', { confirmed: true, discardChanges: true }).allowed).toBe(false)
    expect(state()).toEqual(before)
  })

  it('edits only metadata on a dirty step without saving its board', () => {
    const { authoring, scene, twoSteps, state, captureScene, checkReplacement, replaceScene } = setup()
    twoSteps()
    scene.select(['train-1'])
    const before = state()
    captureScene.mockClear()
    checkReplacement.mockClear()
    replaceScene.mockClear()
    // Extra runtime properties must never overwrite identity or the snapshot.
    const patch = { title: '', prompt: 'Compare the rods.', id: 'injected', trains: [] }
    expect(authoring.patchStep('step-1', patch)).toEqual({ allowed: true })
    expect(state()).toEqual({
      ...before,
      steps: before.steps.map(step => step.id === 'step-1'
        ? { ...step, title: '', prompt: 'Compare the rods.' } : step),
    })
    expect(authoring.patchStep('step-1', { title: 'Compare' }).allowed).toBe(true)
    expect(authoring.steps.value[0]!.prompt).toBe('Compare the rods.')
    expect(captureScene).not.toHaveBeenCalled()
    expect(checkReplacement).not.toHaveBeenCalled()
    expect(replaceScene).not.toHaveBeenCalled()
  })

  it('moves the active step in both directions without changing board edits or selection', () => {
    const { authoring, scene, twoSteps, state, captureScene, checkReplacement, replaceScene } = setup()
    twoSteps()
    scene.select(['train-1'])
    const before = state()
    captureScene.mockClear()
    checkReplacement.mockClear()
    replaceScene.mockClear()
    expect(authoring.moveStep('step-1', 'later')).toEqual({ allowed: true })
    expect(state()).toEqual({ ...before, steps: [...before.steps].reverse() })
    expect(authoring.moveStep('step-1', 'earlier')).toEqual({ allowed: true })
    expect(state()).toEqual(before)
    expect(captureScene).not.toHaveBeenCalled()
    expect(checkReplacement).not.toHaveBeenCalled()
    expect(replaceScene).not.toHaveBeenCalled()
  })

  it.each([
    ['step-1', 'earlier'], ['step-2', 'later'],
  ] as const)('rejects moving %s %s beyond the list', (id, direction) => {
    const { authoring, twoSteps, state } = setup()
    twoSteps()
    const before = state()
    expect(authoring.moveStep(id, direction)).toEqual({ allowed: false, reason: 'The step cannot move further.' })
    expect(state()).toEqual(before)
  })

  it('rejects metadata, movement, and deletion for unknown IDs without mutation', () => {
    const { authoring, twoSteps, state } = setup()
    twoSteps()
    const before = state()
    const rejection = { allowed: false, reason: 'Unknown step.' }
    expect(authoring.patchStep('missing', { prompt: 'Changed' })).toEqual(rejection)
    expect(authoring.moveStep('missing', 'later')).toEqual(rejection)
    expect(authoring.deleteStep('missing', { confirmed: true })).toEqual(rejection)
    expect(state()).toEqual(before)
  })

  it('rejects deletion without confirmation even with discard consent', () => {
    const { authoring, twoSteps, state, replaceScene } = setup()
    twoSteps()
    const before = state()
    replaceScene.mockClear()
    expect(authoring.deleteStep('step-1', { confirmed: false, discardChanges: true }))
      .toEqual({ allowed: false, reason: 'Confirm deletion first.' })
    expect(state()).toEqual(before)
    expect(replaceScene).not.toHaveBeenCalled()
  })

  it('deletes an inactive step while preserving the active dirty board and selection', () => {
    const { authoring, scene, twoSteps, state, captureScene, checkReplacement, replaceScene } = setup()
    twoSteps()
    scene.select(['train-1'])
    const before = state()
    captureScene.mockClear()
    checkReplacement.mockClear()
    replaceScene.mockClear()
    expect(authoring.deleteStep('step-2', { confirmed: true })).toEqual({ allowed: true })
    expect(state()).toEqual({ ...before, steps: [before.steps[0]] })
    expect(captureScene).not.toHaveBeenCalled()
    expect(checkReplacement).not.toHaveBeenCalled()
    expect(replaceScene).not.toHaveBeenCalled()
  })

  it('requires discard consent for a dirty active step and never captures before deleting it', () => {
    const { authoring, twoSteps, state, captureScene, checkReplacement, replaceScene } = setup()
    twoSteps()
    const before = state()
    captureScene.mockClear()
    checkReplacement.mockClear()
    replaceScene.mockClear()
    expect(authoring.deleteStep('step-1', { confirmed: true })).toEqual({
      allowed: false, needsDecision: true,
      reason: 'Confirm discarding this step’s unsaved board changes.',
    })
    expect(state()).toEqual(before)
    expect(checkReplacement).not.toHaveBeenCalled()
    expect(replaceScene).not.toHaveBeenCalled()
    expect(authoring.deleteStep('step-1', { confirmed: true, discardChanges: true })).toEqual({ allowed: true })
    expect(state().scene).toEqual(before.steps[1]!.trains)
    expect(authoring.steps.value).toEqual([before.steps[1]])
    expect(authoring.activeStepId.value).toBe('step-2')
    expect(authoring.dirty.value).toBe(false)
    expect(captureScene).not.toHaveBeenCalled()
  })

  it.each([
    { count: 3, active: 'step-2', neighbor: 'step-3' },
    { count: 3, active: 'step-3', neighbor: 'step-2' },
    { count: 1, active: 'step-1', neighbor: null },
  ])('deleting $active of $count loads $neighbor through checked replacement', ({ count, active, neighbor }) => {
    const { authoring, scene, add, state, captureScene, checkReplacement, replaceScene } = setup()
    for (let i = 0; i < count; i++) {
      add()
      expect(authoring.captureStep().allowed).toBe(true)
    }
    expect(authoring.selectStep(active).allowed).toBe(true)
    scene.select(['train-1'])
    const before = state()
    const destination = before.steps.find(step => step.id === neighbor)?.trains ?? []
    captureScene.mockClear()
    checkReplacement.mockClear()
    replaceScene.mockClear()
    replaceScene.mockImplementationOnce(trains => {
      // No list/active mutation is allowed until the adapter succeeds.
      expect(state()).toEqual(before)
      return scene.replace(trains)
    })
    expect(authoring.deleteStep(active, { confirmed: true })).toEqual({ allowed: true })
    expect(checkReplacement).toHaveBeenCalledExactlyOnceWith(destination)
    expect(replaceScene).toHaveBeenCalledExactlyOnceWith(destination)
    expect(checkReplacement.mock.invocationCallOrder[0]!).toBeLessThan(replaceScene.mock.invocationCallOrder[0]!)
    expect(authoring.steps.value).toEqual(before.steps.filter(step => step.id !== active))
    expect(authoring.activeStepId.value).toBe(neighbor)
    expect(state().scene).toEqual(destination)
    expect(scene.selection.value.size).toBe(0)
    expect(authoring.dirty.value).toBe(false)
    expect(captureScene).not.toHaveBeenCalled()
  })

  it.each(['preflight', 'replacement'] as const)('a deletion %s rejection preserves the list and working scene', failure => {
    const { authoring, scene, twoSteps, state, captureScene, checkReplacement, replaceScene } = setup()
    twoSteps()
    scene.select(['train-1'])
    const before = state()
    const rejection = { allowed: false as const, reason: 'Destination rejected.' }
    captureScene.mockClear()
    checkReplacement.mockClear()
    replaceScene.mockClear()
    if (failure === 'preflight') checkReplacement.mockReturnValueOnce(rejection)
    else replaceScene.mockReturnValueOnce(rejection)
    expect(authoring.deleteStep('step-1', { confirmed: true, discardChanges: true })).toEqual(rejection)
    expect(state()).toEqual(before)
    expect(captureScene).not.toHaveBeenCalled()
    expect(checkReplacement).toHaveBeenCalledExactlyOnceWith(before.steps[1]!.trains)
    expect(replaceScene).toHaveBeenCalledTimes(failure === 'preflight' ? 0 : 1)
  })
})

it('goal metadata preserves dirty board and saved snapshot through authoring operations', () => {
  const { authoring, add, captureScene } = setup()
  add()
  authoring.captureStep()
  expect(authoring.steps.value[0]!.goal).toBeNull()
  const saved = copyScene(authoring.steps.value[0]!.trains)
  add()
  captureScene.mockClear()
  const input = { type: 'all', conditions: [{ type: 'occupied-area', regionId: 'array', cells: 3 }] }
  expect(authoring.setGoal('step-1', input).allowed).toBe(true)
  input.conditions[0]!.cells = 99
  expect(authoring.steps.value[0]!.goal?.conditions[0]).toMatchObject({ cells: 3 })
  expect(authoring.dirty.value).toBe(true)
  expect(authoring.steps.value[0]!.trains).toEqual(saved)
  expect(captureScene).not.toHaveBeenCalled()
  authoring.updateStep()
  authoring.captureStep()
  authoring.moveStep('step-1', 'later')
  authoring.selectStep('step-1')
  expect(authoring.steps.value[1]!.goal?.conditions[0]).toMatchObject({ cells: 3 })
  expect(authoring.setGoal('missing', null).allowed).toBe(false)
})
