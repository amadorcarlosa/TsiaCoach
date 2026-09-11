// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import { useLevelAuthoring } from '~/composables/useLevelAuthoring'
import { useAuthoringControls } from '~/composables/useAuthoringControls'
import { useRodScene } from '~/composables/useRodScene'
import PlaygroundAuthoringControls from './PlaygroundAuthoringControls.vue'

enableAutoUnmount(afterEach)

function setup() {
  const editable = ref(true)
  const blocked = ref(false)
  const scene = useRodScene({
    columns: 24, rows: 12, spawnRows: [0], allowOrientation: true,
    editable: () => editable.value,
  })
  const checkReplacement = vi.fn(scene.checkReplacement)
  const authoring = useLevelAuthoring({
    scene: {
      read: () => scene.trains.value, capture: () => copyScene(scene.trains.value),
      checkReplacement, replace: scene.replace,
    },
    editable: () => editable.value,
  })
  const controls = useAuthoringControls(authoring, () => blocked.value)
  const wrapper = mount(defineComponent({
    setup: () => () => h(PlaygroundAuthoringControls, {
      steps: authoring.steps.value, activeStepId: authoring.activeStepId.value,
      dirty: authoring.dirty.value, blocked: blocked.value,
      pendingStepId: controls.pendingStepId.value, message: controls.message.value,
      onCapture: controls.capture, onUpdate: controls.update,
      'onSelect-step': controls.requestStep, onResolve: controls.resolve,
    }),
  }))
  const button = (label: string) => {
    const found = wrapper.findAll('button').find(b => b.text() === label)
    if (!found) throw new Error(`Missing button: ${label}`)
    return found
  }
  const add = () => expect(scene.apply([], { type: 'create', value: 2 }).allowed).toBe(true)
  async function pending() {
    add()
    await button('Capture step').trigger('click')
    add()
    await button('Capture step').trigger('click')
    add()
    await wrapper.vm.$nextTick()
    await button('Step 1').trigger('click')
    expect(controls.pendingStepId.value).toBe('step-1')
  }
  return { wrapper, button, authoring, controls, editable, blocked, scene, add, pending, checkReplacement }
}

describe('shared authoring controls and controller', () => {
  it.each(['Capture step', 'Update step'] as const)('shows %s failures in the live status and clears them after success', async action => {
    const { wrapper, button, authoring, editable, add } = setup()
    add()
    await button('Capture step').trigger('click')
    add()
    await wrapper.vm.$nextTick()
    // Exercise model failure reporting independently of the UI's blocked guard.
    editable.value = false
    await button(action).trigger('click')
    expect(wrapper.get('[role="status"]').text()).toBe('Editing is unavailable.')
    expect(authoring.steps.value).toHaveLength(1)
    expect(authoring.dirty.value).toBe(true)
    editable.value = true
    await button(action).trigger('click')
    expect(wrapper.get('[role="status"]').text()).toBe('')
    expect(authoring.dirty.value).toBe(false)
  })

  it.each(['Save and switch', 'Discard and switch', 'Cancel'] as const)('routes %s and preserves its outcome', async decision => {
    const { wrapper, button, authoring, controls, scene, pending } = setup()
    await pending()
    const before = copyScene(scene.trains.value)
    for (const item of wrapper.get('[aria-label="Authoring steps"]').findAll('button')) {
      expect(item.attributes('disabled')).toBeDefined()
    }
    controls.capture()
    controls.update()
    controls.requestStep('missing')
    expect(authoring.steps.value).toHaveLength(2)
    expect(authoring.steps.value[1]!.trains).toHaveLength(2)
    expect(controls.pendingStepId.value).toBe('step-1')
    await button(decision).trigger('click')
    expect(wrapper.find('[aria-label="Unsaved step changes"]').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toBe('')
    expect(authoring.activeStepId.value).toBe(decision === 'Cancel' ? 'step-2' : 'step-1')
    expect(authoring.dirty.value).toBe(decision === 'Cancel')
    expect(scene.trains.value).toEqual(decision === 'Cancel' ? before : authoring.steps.value[0]!.trains)
    expect(authoring.steps.value[1]!.trains).toHaveLength(decision === 'Save and switch' ? 3 : 2)
  })

  it('allows cancelling in blocked preview while guarding all editing intentions', async () => {
    const { wrapper, button, authoring, controls, blocked, pending } = setup()
    await pending()
    blocked.value = true
    await wrapper.vm.$nextTick()
    expect(button('Save and switch').attributes('disabled')).toBeDefined()
    expect(button('Discard and switch').attributes('disabled')).toBeDefined()
    expect(button('Cancel').attributes('disabled')).toBeUndefined()
    controls.resolve('save')
    controls.resolve('discard')
    expect(controls.pendingStepId.value).toBe('step-1')
    await button('Cancel').trigger('click')
    expect(controls.pendingStepId.value).toBeNull()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    controls.capture()
    controls.update()
    controls.requestStep('step-1')
    expect(authoring.steps.value).toHaveLength(2)
    expect(authoring.steps.value[1]!.trains).toHaveLength(2)
    expect(authoring.activeStepId.value).toBe('step-2')
    expect(authoring.dirty.value).toBe(true)
  })

  it('keeps a failed switch pending and displays the rejection until a successful retry', async () => {
    const { wrapper, button, controls, authoring, scene, pending, checkReplacement } = setup()
    await pending()
    const before = copyScene(scene.trains.value)
    checkReplacement.mockReturnValueOnce({ allowed: false, reason: 'Destination no longer fits.' })
    await button('Save and switch').trigger('click')
    expect(controls.pendingStepId.value).toBe('step-1')
    expect(wrapper.get('[role="status"]').text()).toBe('Destination no longer fits.')
    expect(scene.trains.value).toEqual(before)
    expect(authoring.steps.value[1]!.trains).toHaveLength(2)
    await button('Save and switch').trigger('click')
    expect(controls.pendingStepId.value).toBeNull()
    expect(wrapper.get('[role="status"]').text()).toBe('')
    expect(authoring.steps.value[1]!.trains).toEqual(before)
    expect(authoring.dirty.value).toBe(false)
  })
})
