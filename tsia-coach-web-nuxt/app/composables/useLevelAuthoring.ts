import { computed, readonly, ref } from 'vue'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import type {
  AuthoringStep,
  AuthoringResult,
  LevelAuthoringOptions,
  SwitchDecision,
} from '~/components/playground/authoring.types'

export function useLevelAuthoring(options: LevelAuthoringOptions) {
  const steps = ref<AuthoringStep[]>([])
  const activeStepId = ref<string | null>(null)
  let nextStepId = 1

  const activeStep = computed(() =>
    steps.value.find(step => step.id === activeStepId.value),
  )

  // Compare stored data, not transient drag translations or selection.
  const dirty = computed(() => {
    const active = activeStep.value
    if (!active) return false

    return JSON.stringify(copyScene(options.scene.read())) !==
      JSON.stringify(active.trains)
  })

  function captureStep(): AuthoringResult {
    if (!options.editable()) {
      return { allowed: false, reason: 'Editing is unavailable.' }
    }

    const snapshot = options.scene.capture()
    const id = `step-${nextStepId++}`

    steps.value = [
      ...steps.value,
      {
        id,
        title: `Step ${steps.value.length + 1}`,
        trains: copyScene(snapshot),
      },
    ]
    activeStepId.value = id

    return { allowed: true }
  }

  function updateStep(): AuthoringResult {
    if (!options.editable()) {
      return { allowed: false, reason: 'Editing is unavailable.' }
    }

    const active = activeStep.value
    if (!active) {
      return { allowed: false, reason: 'Capture a step first.' }
    }

    const snapshot = options.scene.capture()

    steps.value = steps.value.map(step =>
      step.id === active.id
        ? { ...step, trains: copyScene(snapshot) }
        : step,
    )

    return { allowed: true }
  }

  function selectStep(
    id: string,
    decision?: SwitchDecision,
  ): AuthoringResult {
    if (!options.editable()) {
      return { allowed: false, reason: 'Editing is unavailable.' }
    }

    const target = steps.value.find(step => step.id === id)
    if (!target) {
      return { allowed: false, reason: 'Unknown step.' }
    }

    if (id === activeStepId.value) return { allowed: true }

    if (decision === 'cancel') {
      return { allowed: false, reason: 'Step switch cancelled.' }
    }

    if (dirty.value && decision === undefined) {
      return {
        allowed: false,
        reason: 'Save or discard the current changes first.',
        needsDecision: true,
      }
    }

    // Reject an invalid destination before saving or switching.
    const checked = options.scene.checkReplacement(target.trains)
    if (!checked.allowed) return checked

    const previousId = activeStepId.value
    const saved = dirty.value && decision === 'save'
      ? options.scene.capture()
      : null

    const result = options.scene.replace(target.trains)
    if (!result.allowed) return result

    if (saved && previousId) {
      steps.value = steps.value.map(step =>
        step.id === previousId
          ? { ...step, trains: copyScene(saved) }
          : step,
      )
    }

    activeStepId.value = id
    return { allowed: true }
  }

  return {
    steps: readonly(steps),
    activeStepId: readonly(activeStepId),
    dirty,
    captureStep,
    updateStep,
    selectStep,
  }
}
