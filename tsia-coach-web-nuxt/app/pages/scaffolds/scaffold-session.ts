import { Effect } from 'effect'
import { workflowField, workflowFacade, workflowFeature, useWorkflowContext, type WorkflowContext } from '~/effect/registry'
import { workflowRequest, executeWorkflow } from '~/effect/workflows/transport'
import { computed } from 'vue'
import type { PracticeItemPrompt } from '#shared/types/sample-items'
import type {
  ScaffoldSession,
  ScaffoldStepSubmission,
} from '#shared/types/scaffolds'
import type { CoachTurnResponse } from '#shared/types/coaching'
import { CoachTurnEvents, isAnswerQuestionMove } from '#shared/types/coaching'

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

function createScaffoldSessionWorkflow(context: WorkflowContext) {
  const attemptId = workflowField<string | null>(context, 'scaffoldSession.attemptId', null)
  const session = workflowField<ScaffoldSession | null>(context, 'scaffoldSession.session', null)
  const practiceItem = workflowField<PracticeItemPrompt | null>(context, 'scaffoldSession.practiceItem', null)
  const loadState = workflowField<ScaffoldSessionLoadState>(context, 'scaffoldSession.loadState', ScaffoldSessionLoadStates.Idle)
  const loadError = workflowField<string | null>(context, 'scaffoldSession.loadError', null)
  const checking = workflowField(context, 'scaffoldSession.checking', false)
  const checkError = workflowField<string | null>(context, 'scaffoldSession.checkError', null)
  const loadInFlight = new Map<string, Promise<void>>()
  let loadGeneration = 0
  /** The coach's last reply on the current step. Cleared when the step changes. */
  const coachReply = workflowField<string | null>(context, 'scaffoldSession.coachReply', null)
  const asking = workflowField(context, 'scaffoldSession.asking', false)
  const askError = workflowField<string | null>(context, 'scaffoldSession.askError', null)

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

    const existing = loadInFlight.get(nextAttemptId)
    if (existing && attemptId.value === nextAttemptId) return existing
    const generation = ++loadGeneration
    attemptId.value = nextAttemptId
    loadState.value = ScaffoldSessionLoadStates.Loading
    loadError.value = null
    checkError.value = null
    coachReply.value = null
    askError.value = null
    asking.value = false
    checking.value = false

    const pending = executeWorkflow('ScaffoldSessions.load', Effect.gen(function* () {
      const loadedSession = yield* workflowRequest<ScaffoldSession>(
        context, `/api/attempts/${encodeURIComponent(nextAttemptId)}/scaffold-sessions`,
        { method: 'POST' },
      )
      if (generation !== loadGeneration) return
      const loadedItem = yield* workflowRequest<PracticeItemPrompt>(
        context, `/api/practice-items/${encodeURIComponent(loadedSession.practiceItemId)}`,
      )
      if (generation !== loadGeneration || attemptId.value !== nextAttemptId) return
      session.value = loadedSession
      practiceItem.value = loadedItem
      loadState.value = ScaffoldSessionLoadStates.Loaded
    }).pipe(
      Effect.catch(error => Effect.sync(() => {
        if (generation !== loadGeneration) return
        session.value = null
        practiceItem.value = null
        loadState.value = ScaffoldSessionLoadStates.Error
        loadError.value = statusCodeOf(error) === 409
          ? UNAUTHORIZED_MESSAGE
          : 'The walkthrough could not be loaded. Return to practice and try again.'
      })),
      Effect.ensuring(Effect.sync(() => { loadInFlight.delete(nextAttemptId) })),
    ))
    loadInFlight.set(nextAttemptId, pending)
    await pending
  }

  async function submit(submission: ScaffoldStepSubmission) {
    const current = session.value
    if (!current || checking.value || current.state.type !== 'active') {
      return
    }

    checking.value = true
    checkError.value = null
    const generation = loadGeneration

    try {
      await executeWorkflow('ScaffoldSessions.check', Effect.gen(function* () {
        const next = yield* workflowRequest<ScaffoldSession>(
          context, `/api/scaffold-sessions/${encodeURIComponent(current.sessionId)}/checks`,
          {
            method: 'POST',
            body: submission,
          },
        )
        if (generation !== loadGeneration || session.value?.sessionId !== current.sessionId) return
        const currentStepId = current.state.type === 'active' ? current.state.currentStep.id : null
        const nextStepId = next.state.type === 'active' ? next.state.currentStep.id : null
        if (nextStepId !== currentStepId) {
          coachReply.value = null
          askError.value = null
        }
        session.value = next
      }))
    }
    catch {
      if (generation !== loadGeneration) return
      session.value = current
      checkError.value = 'Your response could not be checked. Please try again.'
    }
    finally {
      if (generation === loadGeneration) checking.value = false
    }
  }

  /**
   * Ask the coach about the current step. The browser sends the step id and
   * the question only; the server classifies it and returns an authored
   * reply. The reply never moves the student.
   */
  async function askCoach(question: string) {
    const current = session.value
    const trimmed = question.trim()
    if (!current || !attemptId.value || asking.value || current.state.type !== 'active' || !trimmed) {
      return
    }

    asking.value = true
    askError.value = null
    const generation = loadGeneration
    const capturedStepId = current.state.currentStep.id
    const capturedAttemptId = attemptId.value

    try {
      await executeWorkflow('ScaffoldSessions.askCoach', Effect.gen(function* () {
        const turn = yield* workflowRequest<CoachTurnResponse>(
          context, `/api/attempts/${encodeURIComponent(capturedAttemptId)}/coach`,
          {
            method: 'POST',
            body: {
              event: CoachTurnEvents.StepQuestionAsked,
              stepId: capturedStepId,
              question: trimmed,
            },
          },
        )
        if (generation !== loadGeneration || session.value?.state.type !== 'active'
          || session.value.state.currentStep.id !== capturedStepId) return
        coachReply.value = isAnswerQuestionMove(turn.move) ? turn.move.message : null
        if (!coachReply.value) {
          askError.value = 'The coach could not answer that. Try asking another way.'
        }
      }))
    }
    catch (error) {
      if (generation !== loadGeneration) return
      askError.value = statusCodeOf(error) === 429
        ? 'The coach is busy. Try again in a moment.'
        : 'The coach could not answer right now. Try again.'
    }
    finally {
      if (generation === loadGeneration) asking.value = false
    }
  }

  return workflowFacade({
    attemptId,
    session,
    practiceItem,
    loadState,
    loadError,
    checking,
    checkError,
    completedPercent,
    coachReply,
    asking,
    askError,
    load,
    submit,
    askCoach,
  })
}

export function useScaffoldSessionStore(context: WorkflowContext = useWorkflowContext()) {
  return workflowFeature(context, 'scaffoldSession', () => createScaffoldSessionWorkflow(context))
}
