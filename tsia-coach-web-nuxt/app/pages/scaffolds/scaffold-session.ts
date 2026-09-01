import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import type {
  ScaffoldSession,
  ScaffoldStepSubmission,
} from '#shared/types/scaffolds'

export const ScaffoldSessionLoadStates = {
  Idle: 'idle',
  Loading: 'loading',
  Loaded: 'loaded',
  Error: 'error',
} as const

type ScaffoldSessionLoadState =
  typeof ScaffoldSessionLoadStates[keyof typeof ScaffoldSessionLoadStates]

const UNAUTHORIZED_MESSAGE =
  'This walkthrough is not available yet. Try the practice item again, then ask for help.'

function statusCodeOf(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null
  }

  const candidate = error as {
    status?: number
    statusCode?: number
    response?: { status?: number }
  }

  return candidate.statusCode ?? candidate.status ?? candidate.response?.status ?? null
}

export const useScaffoldSessionStore = defineStore('scaffold-session', () => {
  const attemptId = ref<string | null>(null)
  const session = ref<ScaffoldSession | null>(null)
  const practiceItem = ref<PracticeItemPrompt | null>(null)
  const loadState = ref<ScaffoldSessionLoadState>(ScaffoldSessionLoadStates.Idle)
  const loadError = ref<string | null>(null)
  const checking = ref(false)
  const checkError = ref<string | null>(null)
  const loadInFlight = shallowRef<Promise<void> | null>(null)

  const completedPercent = computed(() => {
    if (!session.value || Number(session.value.totalStepCount) === 0) {
      return 0
    }

    return Math.round(
      Number(session.value.completedStepCount)
      / Number(session.value.totalStepCount)
      * 100,
    )
  })

  async function load(nextAttemptId: string, force = false) {
    if (!nextAttemptId) {
      loadState.value = ScaffoldSessionLoadStates.Error
      loadError.value = 'No practice attempt was provided.'
      return
    }

    if (
      !force
      && attemptId.value === nextAttemptId
      && loadState.value === ScaffoldSessionLoadStates.Loaded
      && session.value
      && practiceItem.value
    ) {
      return
    }

    if (loadInFlight.value) {
      return await loadInFlight.value
    }

    attemptId.value = nextAttemptId
    loadState.value = ScaffoldSessionLoadStates.Loading
    loadError.value = null
    checkError.value = null

    const pending = (async () => {
      try {
        const loadedSession = await $fetch<ScaffoldSession>(
          `/api/attempts/${encodeURIComponent(nextAttemptId)}/scaffold-sessions`,
          { method: 'POST' },
        )
        const loadedItem = await $fetch<PracticeItemPrompt>(
          `/api/practice-items/${encodeURIComponent(loadedSession.practiceItemId)}`,
        )

        session.value = loadedSession
        practiceItem.value = loadedItem
        loadState.value = ScaffoldSessionLoadStates.Loaded
      }
      catch (error) {
        session.value = null
        practiceItem.value = null
        loadState.value = ScaffoldSessionLoadStates.Error
        loadError.value = statusCodeOf(error) === 409
          ? UNAUTHORIZED_MESSAGE
          : 'The walkthrough could not be loaded. Return to practice and try again.'
      }
    })()

    loadInFlight.value = pending

    try {
      await pending
    }
    finally {
      loadInFlight.value = null
    }
  }

  async function submit(submission: ScaffoldStepSubmission) {
    const current = session.value
    if (!current || checking.value || current.state.type !== 'active') {
      return
    }

    checking.value = true
    checkError.value = null

    try {
      session.value = await $fetch<ScaffoldSession>(
        `/api/scaffold-sessions/${encodeURIComponent(current.sessionId)}/checks`,
        {
          method: 'POST',
          body: submission,
        },
      )
    }
    catch {
      session.value = current
      checkError.value = 'Your response could not be checked. Please try again.'
    }
    finally {
      checking.value = false
    }
  }

  return {
    attemptId,
    session,
    practiceItem,
    loadState,
    loadError,
    checking,
    checkError,
    completedPercent,
    load,
    submit,
  }
})
