import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AttemptProjection, MathNode, PracticeItemPrompt, PromptMultipleChoiceInteraction } from '#shared/types/sample-items'
import {
  isAfterCorrectCheckPhase,
  isAfterIncorrectCheckPhase,
  isBeforeCheckPhase,
  isVisibleCoachingButton
} from '#shared/types/sample-items'
import type { CoachMoveResponse, CoachTurnEvent } from '#shared/types/coaching'
import { AttemptPhaseKinds } from '#shared/types/sample-items'
import { CoachTurnEvents } from '#shared/types/coaching'
import {
  FocusTargetKinds,
  LoadStates,
  SubmissionStates,
  type FocusTarget,
  type FocusTargetCommand,
  type LoadState,
  type SubmissionState
} from './sample-items-ui'

export type CoachingState = 'idle' | 'requesting' | 'shown' | 'error'

interface AttemptSession {
  attemptId: string | null
  projection: AttemptProjection | null
  selectedAnswerId: string | null
  submissionState: SubmissionState
  submissionError: string | null
  coachingState: CoachingState
  coachingMove: CoachMoveResponse | null
  coachingError: string | null
}

export {
  FocusTargetKinds,
  LoadStates,
  SubmissionStates
} from './sample-items-ui'
export type {
  FocusTarget,
  FocusTargetCommand,
  LoadState,
  SubmissionState
} from './sample-items-ui'

const SUBMISSION_ERROR_MESSAGE = 'Could not submit the selected answer.'

export const useSampleItemsStore = defineStore('sampleItems', () => {
  const items = ref<PracticeItemPrompt[]>([])
  const selectedItemId = ref<string | null>(null)
  const focusTarget = ref<FocusTarget | null>(null)
  const loadState = ref<LoadState>(LoadStates.Idle)
  const loadError = ref<string | null>(null)
  const loadInFlight = ref<Promise<void> | null>(null)

  const attemptSessions = ref<Record<string, AttemptSession>>({})
  const startAttemptInFlight = new Map<string, Promise<AttemptProjection>>()
  const coachingInFlight = new Map<string, Promise<void>>()

  const selectedItem = computed(() =>
    items.value.find(item => item.id === selectedItemId.value) ?? null
  )

  const selectedSession = computed(() =>
    selectedItemId.value
      ? attemptSessions.value[selectedItemId.value] ?? null
      : null
  )

  const selectedInteraction = computed<PromptMultipleChoiceInteraction | null>(() =>
    selectedItem.value?.interaction ?? null
  )

  const selectedAnswerId = computed(() =>
    selectedSession.value?.selectedAnswerId ?? null
  )

  const attemptProjection = computed(() =>
    selectedSession.value?.projection ?? null
  )

  const submissionState = computed(() =>
    selectedSession.value?.submissionState ?? SubmissionStates.Idle
  )

  const submissionError = computed(() =>
    selectedSession.value?.submissionError ?? null
  )

  const selectedAnswer = computed(() =>
    selectedInteraction.value?.answers.find(
      answer => answer.id === selectedAnswerId.value
    ) ?? null
  )

  const tokensById = computed(() => new Map(
    selectedItem.value?.text.tokens.map(token => [token.id, token]) ?? []
  ))

  const phrasesById = computed(() => new Map(
    selectedItem.value?.text.phrases.map(phrase => [phrase.id, phrase]) ?? []
  ))

  const answersById = computed(() => new Map(
    selectedInteraction.value?.answers.map(answer => [answer.id, answer]) ?? []
  ))

  const mathObjectsById = computed(() => new Map(
    selectedItem.value?.mathematics.objects.map(
      object => [object.id, object]
    ) ?? []
  ))

  const mathNodesById = computed(() => {
    const entries: Array<[string, MathNode]> = []

    for (const object of selectedItem.value?.mathematics.objects ?? []) {
      for (const node of object.nodes) {
        entries.push([node.id, node])
      }
    }

    return new Map(entries)
  })

  const answerMathObjectIds = computed(() => new Map(
    selectedInteraction.value?.answerMathBindings.map(binding => [
      binding.answerChoiceId,
      binding.mathObjectId
    ]) ?? []
  ))

  const coachingButton = computed(() => {
    const button = attemptProjection.value?.coachingButton
    return button && isVisibleCoachingButton(button) ? button : null
  })

  const coachingState = computed<CoachingState>(() =>
    selectedSession.value?.coachingState ?? 'idle'
  )

  const coachingMove = computed(() =>
    selectedSession.value?.coachingMove ?? null
  )

  const coachingError = computed(() =>
    selectedSession.value?.coachingError ?? null
  )

  const isAttemptTerminal = computed(() =>
    isAfterCorrectCheckPhase(attemptProjection.value)
  )

  const isBeforeCheck = computed(() =>
    isBeforeCheckPhase(attemptProjection.value)
  )

  const isAfterIncorrect = computed(() =>
    isAfterIncorrectCheckPhase(attemptProjection.value)
  )

  function getOrCreateSession(itemId: string): AttemptSession {
    const existing = attemptSessions.value[itemId]
    if (existing) {
      return existing
    }

    const created: AttemptSession = {
      attemptId: null,
      projection: null,
      selectedAnswerId: null,
      submissionState: SubmissionStates.Idle,
      submissionError: null,
      coachingState: 'idle',
      coachingMove: null,
      coachingError: null
    }

    attemptSessions.value[itemId] = created
    return created
  }

  function setSessionSubmissionState(itemId: string, state: SubmissionState) {
    getOrCreateSession(itemId).submissionState = state
  }

  function setSessionError(itemId: string, message: string | null) {
    getOrCreateSession(itemId).submissionError = message
  }

  async function ensureAttemptForItem(itemId: string): Promise<AttemptProjection> {
    const session = getOrCreateSession(itemId)

    if (session.projection) {
      return session.projection
    }

    const existing = startAttemptInFlight.get(itemId)
    if (existing) {
      return existing
    }

    const startAttempt = (async () => {
      const started = await $fetch<AttemptProjection>('/api/attempts', {
        method: 'POST',
        body: {
          practiceItemId: itemId
        }
      })

      if (started.practiceItemId !== itemId) {
        throw new Error('Attempt projection did not match requested item.')
      }

      session.attemptId = started.attemptId
      session.projection = started
      session.submissionState = SubmissionStates.Idle
      session.submissionError = null

      return started
    })()

    startAttemptInFlight.set(itemId, startAttempt)

    try {
      return await startAttempt
    } catch (error) {
      session.submissionState = SubmissionStates.Error
      session.submissionError = error instanceof Error
        ? error.message
        : 'Could not start attempt.'
      throw error
    } finally {
      startAttemptInFlight.delete(itemId)
    }
  }

  async function load() {
    if (loadInFlight.value) {
      return loadInFlight.value
    }

    if (loadState.value === LoadStates.Loaded) {
      if (
        selectedItemId.value
        && !attemptSessions.value[selectedItemId.value]?.projection
      ) {
        await ensureAttemptForItem(selectedItemId.value)
      }

      return
    }

    loadState.value = LoadStates.Loading
    loadError.value = null

    const load = (async () => {
      const practiceItems = await $fetch<PracticeItemPrompt[]>('/api/practice-items')
      items.value = practiceItems
      loadState.value = LoadStates.Loaded

      if (!selectedItemId.value || !items.value.some(item => item.id === selectedItemId.value)) {
        selectedItemId.value = items.value[0]?.id ?? null
      }

      if (selectedItemId.value) {
        await ensureAttemptForItem(selectedItemId.value)
      }
    })()

    loadInFlight.value = load

    try {
      await load
    } catch (error) {
      loadState.value = LoadStates.Error
      loadError.value = error instanceof Error
        ? error.message
        : 'Could not load practice items.'
    } finally {
      loadInFlight.value = null
    }
  }

  async function selectItem(itemId: string) {
    if (!items.value.some(item => item.id === itemId)) {
      return
    }

    if (selectedItemId.value !== itemId) {
      selectedItemId.value = itemId
      focusTarget.value = null
    }

    await ensureAttemptForItem(itemId)
  }

  function selectAnswer(answerChoiceId: string) {
    const session = selectedSession.value

    if (
      isAttemptTerminal.value
      || submissionState.value === SubmissionStates.Submitting
      || !session
      || !answersById.value.has(answerChoiceId)
    ) {
      return
    }

    session.selectedAnswerId = answerChoiceId
    session.submissionState = SubmissionStates.Idle
    session.submissionError = null
    focusTarget.value = { kind: FocusTargetKinds.Answer, id: answerChoiceId }
  }

  async function focusForItem(command: FocusTargetCommand) {
    if (!items.value.some(item => item.id === command.itemId)) {
      return
    }

    await selectItem(command.itemId)

    if (!selectedItem.value || selectedItem.value.id !== command.itemId) {
      return
    }

    focusTarget.value = command.target
  }

  function focus(target: FocusTarget) {
    focusTarget.value = target
  }

  function clearFocus() {
    focusTarget.value = null
  }

  function coachingEventFor(projection: AttemptProjection): CoachTurnEvent | null {
    switch (projection.phase.type) {
      case AttemptPhaseKinds.BeforeCheck:
        return CoachTurnEvents.HelpRequested
      case AttemptPhaseKinds.AfterIncorrectCheck:
        return CoachTurnEvents.DiagnosisRequested
      case AttemptPhaseKinds.AfterCorrectCheck:
        return CoachTurnEvents.ExplainCorrect
      default:
        return null
    }
  }

  function firstKnownPhraseId(itemId: string, phraseIds: readonly string[]): string | null {
    const item = items.value.find(candidate => candidate.id === itemId)
    if (!item) {
      return null
    }

    const known = new Set(item.text.phrases.map(phrase => phrase.id))
    return phraseIds.find(id => known.has(id)) ?? null
  }

  function clearCoachingFor(itemId: string) {
    const session = attemptSessions.value[itemId]
    if (!session) {
      return
    }

    session.coachingState = 'idle'
    session.coachingMove = null
    session.coachingError = null
  }

  function clearCoaching() {
    const itemId = selectedItemId.value
    if (itemId) {
      clearCoachingFor(itemId)
    }
  }

  async function requestCoaching(): Promise<void> {
    const itemId = selectedItemId.value
    const session = itemId ? attemptSessions.value[itemId] ?? null : null
    const projection = session?.projection

    if (!itemId || !session || !projection || !session.attemptId) {
      return
    }

    const button = projection.coachingButton
    if (!isVisibleCoachingButton(button)) {
      return
    }

    const event = coachingEventFor(projection)
    if (!event) {
      return
    }

    const existing = coachingInFlight.get(itemId)
    if (existing) {
      return existing
    }

    const capturedAttemptId = session.attemptId
    const capturedCheckCount = projection.checkCount
    const capturedPhaseType = projection.phase.type

    session.coachingState = 'requesting'
    session.coachingError = null

    function isStale(): boolean {
      const current = attemptSessions.value[itemId!]
      const currentProjection = current?.projection

      return !current
        || !currentProjection
        || current.attemptId !== capturedAttemptId
        || currentProjection.checkCount !== capturedCheckCount
        || currentProjection.phase.type !== capturedPhaseType
    }

    const request = (async () => {
      try {
        const turn = await $fetch<{ move: CoachMoveResponse }>(
          `/api/attempts/${encodeURIComponent(capturedAttemptId)}/coach`,
          {
            method: 'POST',
            body: { event }
          }
        )

        if (isStale()) {
          return
        }

        const current = attemptSessions.value[itemId]!
        current.coachingMove = turn.move
        current.coachingState = 'shown'
        current.coachingError = null

        const focusPhraseId = firstKnownPhraseId(itemId, turn.move.focusPhraseIds)
        if (focusPhraseId && selectedItemId.value === itemId) {
          focusTarget.value = { kind: FocusTargetKinds.Phrase, id: focusPhraseId }
        }
      } catch (error) {
        const statusCode = (error as { statusCode?: number; status?: number }).statusCode
          ?? (error as { status?: number }).status

        if (statusCode === 409) {
          try {
            const refreshed = await $fetch<AttemptProjection>(
              `/api/attempts/${encodeURIComponent(capturedAttemptId)}`
            )
            const current = attemptSessions.value[itemId]
            if (current && current.attemptId === capturedAttemptId) {
              current.projection = refreshed
            }
          } catch {
            // Keep the last known projection when the refresh also fails.
          }
        }

        if (isStale() && statusCode !== 409) {
          return
        }

        const current = attemptSessions.value[itemId]
        if (!current) {
          return
        }

        current.coachingState = 'error'
        current.coachingError = statusCode === 409
          ? 'This item changed. Ask the coach again.'
          : statusCode === 429
            ? 'The coach is busy. Try again in a moment.'
            : statusCode === 502
              ? 'Coaching is temporarily unavailable.'
              : 'Could not reach the coach.'
      } finally {
        coachingInFlight.delete(itemId)
      }
    })()

    coachingInFlight.set(itemId, request)
    return request
  }

  async function retryCoaching(): Promise<void> {
    const itemId = selectedItemId.value
    if (itemId) {
      const session = attemptSessions.value[itemId]
      if (session) {
        session.coachingError = null
        session.coachingState = 'idle'
      }
    }

    return requestCoaching()
  }

  async function submitSelectedAnswer() {
    const itemId = selectedItem.value?.id
    const answerId = selectedAnswerId.value
    const session = selectedSession.value

    if (!itemId || !session || !answerId) {
      if (itemId) {
        setSessionSubmissionState(itemId, SubmissionStates.Error)
        setSessionError(itemId, 'Please select an answer first.')
      }
      return
    }

    if (isAttemptTerminal.value || session.submissionState === SubmissionStates.Submitting) {
      return
    }

    if (!session.attemptId) {
      setSessionSubmissionState(itemId, SubmissionStates.Error)
      setSessionError(itemId, 'No active attempt exists for this item.')
      return
    }

    const previousProjection = session.projection
    setSessionSubmissionState(itemId, SubmissionStates.Submitting)
    setSessionError(itemId, null)

    try {
      const projection = await $fetch<AttemptProjection>(
        `/api/attempts/${encodeURIComponent(session.attemptId)}/checks`,
        {
          method: 'POST',
          body: {
            selectedAnswerId: answerId
          }
        }
      )

      if (projection.practiceItemId !== itemId) {
        throw new Error('Attempt projection did not match requested item.')
      }

      session.projection = projection
      session.submissionState = SubmissionStates.Submitted
      session.selectedAnswerId = answerId
      clearCoachingFor(itemId)
    } catch (error) {
      session.projection = previousProjection
      setSessionSubmissionState(itemId, SubmissionStates.Error)
      setSessionError(
        itemId,
        error instanceof Error
          ? error.message
          : SUBMISSION_ERROR_MESSAGE
      )
    }
  }

  return {
    items,
    selectedItemId,
    selectedItem,
    selectedInteraction,
    attemptSessions,
    selectedAnswerId,
    selectedAnswer,
    isAttemptTerminal,
    isBeforeCheck,
    isAfterIncorrect,
    attemptProjection,
    answerMathObjectIds,
    tokensById,
    phrasesById,
    answersById,
    mathObjectsById,
    mathNodesById,
    focusTarget,
    loadState,
    loadError,
    submissionState,
    submissionError,
    coachingButton,
    coachingState,
    coachingMove,
    coachingError,
    requestCoaching,
    retryCoaching,
    clearCoaching,
    ensureAttemptForItem,
    load,
    selectItem,
    selectAnswer,
    focus,
    focusForItem,
    clearFocus,
    submitSelectedAnswer
  }
})
