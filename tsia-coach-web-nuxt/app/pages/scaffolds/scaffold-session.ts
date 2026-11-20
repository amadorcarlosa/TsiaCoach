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
import type { PlaygroundRecorder } from '~/effect/playground-events'
import type { StartPlaygroundSession } from '#shared/effect/playground-events'

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

const isToken = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)
const stepToken = (value: unknown) => isToken(value) ? { stepId: value } : {}

function progress(session: ScaffoldSession) {
  return {
    checks: Number(session.checkCount),
    completedSteps: Number(session.completedStepCount),
    totalSteps: Number(session.totalStepCount),
  }
}

type ScaffoldSessionOptions = {
  /** Learner action log; one recorder per scaffold session, linked to its attempt. */
  eventLog?: {
    recorder(input: StartPlaygroundSession): PlaygroundRecorder
    flush(timeoutMillis?: number): Promise<void>
  } | null
}

function createScaffoldSessionWorkflow(context: WorkflowContext, options: ScaffoldSessionOptions = {}) {
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
  const recorders = new Map<string, PlaygroundRecorder>()
  function recorderFor(current: ScaffoldSession): PlaygroundRecorder | null {
    if (!options.eventLog) return null
    let recorder = recorders.get(current.sessionId)
    if (!recorder) {
      recorder = options.eventLog.recorder({
        playground: 'scaffold',
        ...(isToken(current.attemptId) ? { attemptId: current.attemptId } : {}),
        ...(isToken(current.sessionId) ? { scaffoldSessionId: current.sessionId } : {}),
      })
      recorders.set(current.sessionId, recorder)
    }
    return recorder
  }

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
        const recorder = recorderFor(next)
        const check = next.lastCheck
        if (recorder && check && Number(next.checkCount) > Number(current.checkCount)) {
          recorder.record({
            type: 'step.checked',
            ...(check.outcome === 'rejected'
              ? { outcome: 'rejected' as const, reason: "The move broke the step's rule." }
              : { outcome: 'applied' as const }),
            data: { ...stepToken(check.stepId), satisfied: check.satisfied, ...(isToken(check.outcome) ? { variant: check.outcome } : {}) },
            sceneSummary: progress(next),
          })
        }
        if (recorder && (nextStepId !== currentStepId || next.state.type !== current.state.type)) {
          recorder.record({
            type: 'step.advanced',
            outcome: 'applied',
            data: { ...stepToken(nextStepId), variant: next.state.type, count: Number(next.completedStepCount) },
            sceneSummary: progress(next),
          })
        }
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
      // The coach reads this attempt's actions on the server; send the latest first.
      if (options.eventLog) await options.eventLog.flush(1000)
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
        // The question's length only; its text is never logged.
        const recorder = session.value ? recorderFor(session.value) : null
        recorder?.record({
          type: 'coach.asked',
          outcome: 'applied',
          data: { ...stepToken(capturedStepId), length: trimmed.length, variant: coachReply.value ? 'answered' : 'unanswered' },
        })
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

/** The first caller's options win; the store is one per Nuxt app. */
export function useScaffoldSessionStore(context: WorkflowContext = useWorkflowContext(), options: ScaffoldSessionOptions = {}) {
  return workflowFeature(context, 'scaffoldSession', () => createScaffoldSessionWorkflow(context, options))
}
