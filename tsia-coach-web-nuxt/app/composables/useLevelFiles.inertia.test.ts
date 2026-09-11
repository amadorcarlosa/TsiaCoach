// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useRodScene } from './useRodScene'
import { useRodPlaygroundInteraction } from './useRodPlaygroundInteraction'
import { useLevelAuthoring } from './useLevelAuthoring'
import { useLevelFiles } from './useLevelFiles'
import { createArrayGoalAdapter } from '~/components/playground/goals/board-goal-adapters'
it('import replacement cancels movement and ignores a delayed inertia settle, even with reused train IDs', () => {
  vi.useFakeTimers()
  const scene = useRodScene({ columns: 24, rows: 12, spawnRows: [0], allowOrientation: true, editable: () => true })
  let interaction!: ReturnType<typeof useRodPlaygroundInteraction>
  const wrapper = mount(defineComponent({ setup() {
    interaction = useRodPlaygroundInteraction({ scene, viewport: ref(null), disabled: () => false, cancelVersion: () => 0 })
    return () => null
  } }))
  try {
    scene.apply([], { type: 'create', value: 3 })
    const goals = createArrayGoalAdapter({ columns: 24, rows: 12 })
    const authoring = useLevelAuthoring({ goals, editable: () => true, scene: { read: () => scene.trains.value, capture: interaction.captureScene, checkReplacement: scene.checkReplacement, replace: interaction.replaceScene } })
    const files = useLevelFiles({ adapter: { board: { kind: 'array', config: { columns: 24, rows: 12 } }, goals, validateSnapshot: scene.validateSnapshot }, authoring, editable: () => true, hasWorkingRods: () => true, resolveDrafts: () => true, onImported: vi.fn() })
    expect(interaction.interaction.beginMove('train-1')).toBe(true)
    interaction.interaction.previewMove('train-1', { x: 8, y: 0 })
    setTimeout(() => interaction.interaction.settleMove('train-1', { x: 10, y: 0 }), 1000)
    const document = { version: 1, board: { kind: 'array', config: { columns: 24, rows: 12 } }, steps: [{ id: 'step-1', title: '', prompt: '', goal: null, trains: [{ id: 'train-1', anchor: { x: 2, y: 2 }, parts: [{ value: 2, orientation: 'tower', offset: { x: 0, y: 0 } }] }] }] }
    expect(files.prepareImport(document).allowed).toBe(true)
    expect(interaction.interaction.leaderId.value).toBe('train-1')
    expect(files.confirmImport().allowed).toBe(true)
    expect(interaction.interaction.leaderId.value).toBeNull()
    vi.advanceTimersByTime(2000)
    expect(scene.trains.value).toEqual(document.steps[0]!.trains)
    expect(authoring.dirty.value).toBe(false)
  } finally { wrapper.unmount(); vi.useRealTimers() }
})
