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
    trains: () => scene.trains.value,
    captureScene, checkReplacement, replaceScene,
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
    expect(state()).toEqual(before)
  })
})
