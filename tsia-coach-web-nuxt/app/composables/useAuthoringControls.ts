import { computed, readonly, ref } from 'vue'
import type { useLevelAuthoring } from './useLevelAuthoring'
import type {
  AuthoringResult,
  StepDirection,
  StepMetadataPatch,
  SwitchDecision,
} from '~/components/playground/authoring.types'

type Authoring = ReturnType<typeof useLevelAuthoring>

export function useAuthoringControls(
  authoring: Authoring,
  blocked: () => boolean,
) {
  const pendingStepId = ref<string | null>(null)
  const pendingDeleteId = ref<string | null>(null)
  const message = ref('')

  const pendingDelete = computed(() =>
    authoring.steps.value.find(step => step.id === pendingDeleteId.value),
  )

  const deletingDirtyActive = computed(() =>
    pendingDeleteId.value !== null &&
    pendingDeleteId.value === authoring.activeStepId.value &&
    authoring.dirty.value,
  )

  function busy(): boolean {
    return (
      blocked() ||
      pendingStepId.value !== null ||
      pendingDeleteId.value !== null
    )
  }

  function report(result: AuthoringResult): void {
    message.value = result.allowed ? '' : result.reason
  }

  function capture(): void {
    if (busy()) return
    report(authoring.captureStep())
  }

  function update(): void {
    if (busy()) return
    report(authoring.updateStep())
  }

  function requestStep(id: string): void {
    if (busy()) return

    const result = authoring.selectStep(id)

    pendingStepId.value =
      !result.allowed && result.needsDecision ? id : null

    report(result)
  }

  function patch(id: string, value: StepMetadataPatch): void {
    if (busy()) return
    report(authoring.patchStep(id, value))
  }

  function move(id: string, direction: StepDirection): void {
    if (busy()) return
    report(authoring.moveStep(id, direction))
  }

  function requestDelete(id: string): void {
    if (busy()) return

    if (!authoring.steps.value.some(step => step.id === id)) {
      report({ allowed: false, reason: 'Unknown step.' })
      return
    }

    pendingDeleteId.value = id
    message.value = ''
  }

  function cancelDelete(): void {
    pendingDeleteId.value = null
    message.value = ''
  }

  function confirmDelete(discardChanges = false): void {
    const id = pendingDeleteId.value
    if (!id || blocked()) return

    const result = authoring.deleteStep(id, {
      confirmed: true,
      discardChanges,
    })

    report(result)

    if (result.allowed) {
      pendingDeleteId.value = null
    }
  }

  function resolve(decision: SwitchDecision): void {
    const id = pendingStepId.value
    if (!id) return

    // Dismissing the question is allowed even in preview mode.
    if (decision === 'cancel') {
      pendingStepId.value = null
      message.value = ''
      return
    }

    if (blocked()) return

    const result = authoring.selectStep(id, decision)
    report(result)

    if (result.allowed) {
      pendingStepId.value = null
    }
  }

  return {
    pendingStepId: readonly(pendingStepId),
    pendingDeleteId: readonly(pendingDeleteId),
    pendingDeleteTitle: computed(() => pendingDelete.value?.title ?? ''),
    deletingDirtyActive,
    message: readonly(message),
    capture,
    update,
    requestStep,
    resolve,
    patch,
    move,
    requestDelete,
    cancelDelete,
    confirmDelete,
  }
}
