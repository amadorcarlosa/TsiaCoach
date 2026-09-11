import { readonly, ref } from 'vue'
import type { useLevelAuthoring } from './useLevelAuthoring'
import type {
  AuthoringResult,
  SwitchDecision,
} from '~/components/playground/authoring.types'

type Authoring = ReturnType<typeof useLevelAuthoring>

export function useAuthoringControls(
  authoring: Authoring,
  blocked: () => boolean,
) {
  const pendingStepId = ref<string | null>(null)
  const message = ref('')

  function report(result: AuthoringResult): void {
    message.value = result.allowed ? '' : result.reason
  }

  function capture(): void {
    if (blocked() || pendingStepId.value !== null) return
    report(authoring.captureStep())
  }

  function update(): void {
    if (blocked() || pendingStepId.value !== null) return
    report(authoring.updateStep())
  }

  function requestStep(id: string): void {
    if (blocked() || pendingStepId.value !== null) return

    const result = authoring.selectStep(id)

    pendingStepId.value =
      !result.allowed && result.needsDecision ? id : null

    report(result)
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
    message: readonly(message),
    capture,
    update,
    requestStep,
    resolve,
  }
}
