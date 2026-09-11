import { computed, readonly, ref } from 'vue'
import { copyScene } from '~/components/rod/scene/scene-snapshot'
import type {
  AuthoringStep,
  AuthoringResult,
  DeleteStepOptions,
  LevelAuthoringOptions,
  StepDirection,
  StepMetadataPatch,
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
        prompt: '',
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

  function patchStep(
    id: string,
    patch: StepMetadataPatch,
  ): AuthoringResult {
    if (!options.editable()) {
      return { allowed: false, reason: 'Editing is unavailable.' }
    }

    if (!steps.value.some(step => step.id === id)) {
      return { allowed: false, reason: 'Unknown step.' }
    }

    // Whitelist metadata. Never spread arbitrary input onto a step.
    steps.value = steps.value.map(step => {
      if (step.id !== id) return step

      return {
        ...step,
        title: patch.title ?? step.title,
        prompt: patch.prompt ?? step.prompt,
      }
    })

    return { allowed: true }
  }

  function moveStep(
    id: string,
    direction: StepDirection,
  ): AuthoringResult {
    if (!options.editable()) {
      return { allowed: false, reason: 'Editing is unavailable.' }
    }

    const index = steps.value.findIndex(step => step.id === id)
    if (index < 0) {
      return { allowed: false, reason: 'Unknown step.' }
    }

    const destination = index + (direction === 'earlier' ? -1 : 1)

    if (destination < 0 || destination >= steps.value.length) {
      return { allowed: false, reason: 'The step cannot move further.' }
    }

    const reordered = [...steps.value]
    const [step] = reordered.splice(index, 1)
    reordered.splice(destination, 0, step!)

    steps.value = reordered
    return { allowed: true }
  }

  function deleteStep(
    id: string,
    deletion: DeleteStepOptions,
  ): AuthoringResult {
    if (!options.editable()) {
      return { allowed: false, reason: 'Editing is unavailable.' }
    }

    const index = steps.value.findIndex(step => step.id === id)
    if (index < 0) {
      return { allowed: false, reason: 'Unknown step.' }
    }

    if (!deletion.confirmed) {
      return { allowed: false, reason: 'Confirm deletion first.' }
    }

    const deletingActive = activeStepId.value === id

    if (
      deletingActive &&
      dirty.value &&
      !deletion.discardChanges
    ) {
      return {
        allowed: false,
        reason: 'Confirm discarding this step’s unsaved board changes.',
        needsDecision: true,
      }
    }

    const remaining = steps.value.filter(step => step.id !== id)

    if (!deletingActive) {
      // Preserve working board, selection, and dirty state.
      steps.value = remaining
      return { allowed: true }
    }

    // Prefer the next step; use the previous one when deleting the last.
    const neighbor = remaining[Math.min(index, remaining.length - 1)]
    const destination = neighbor?.trains ?? []

    const checked = options.scene.checkReplacement(destination)
    if (!checked.allowed) return checked

    // The adapter cancels gestures and rechecks before replacing.
    const replaced = options.scene.replace(destination)
    if (!replaced.allowed) return replaced

    // Remove the step only after replacement succeeds.
    steps.value = remaining
    activeStepId.value = neighbor?.id ?? null

    return { allowed: true }
  }

  return {
    steps: readonly(steps),
    activeStepId: readonly(activeStepId),
    dirty,
    captureStep,
    updateStep,
    selectStep,
    patchStep,
    moveStep,
    deleteStep,
  }
}
