import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSampleItemsStore } from './sample-items'
import {
  AttemptPhaseKinds,
  type AttemptProjection,
  type MathNode,
  type PracticeItemPrompt
} from '#shared/types/sample-items'
import {
  LoadStates,
  SubmissionStates,
  coachingCardView
} from './sample-items-ui'

function makeToken(
  id: string,
  index: number,
  surface: string,
  start: number,
): any {
  return {
    id,
    index,
    surface,
    kind: 'symbol',
    characterSpan: {
      start,
      length: surface.length
    }
  }
}

function makePrompt(id: string, answers: string[]): PracticeItemPrompt {
  const answerItems = answers.map((answerId, index) => ({
    id: answerId,
    labelSpan: { start: index * 2, length: 1 },
    labelCharacterSpan: { start: index * 2, length: 1 },
    contentSpan: { start: index * 2 + 1, length: 3 },
    contentCharacterSpan: { start: index * 2 + 1, length: 3 }
  }))

  return {
    id,
    text: {
      sourceText: `${id} text`,
      tokens: [
        makeToken(`${id}-t0`, 0, id, 0),
        makeToken(`${id}-t1`, 1, 'a', 2),
        makeToken(`${id}-t2`, 2, 'b', 4)
      ],
      sentences: [
        { start: 0, length: `${id} text`.length }
      ],
      phrases: [
        {
          id: `${id}-phrase-1`,
          tokenSpan: { start: 0, length: 1 },
          characterSpan: { start: 0, length: 2 }
        }
      ]
    },
    semantics: {
      entities: [],
      edges: []
    },
    mathematics: {
      objects: [] as { id: string; rootNodeId: string; nodes: MathNode[] }[],
      textBindings: []
    },
    interaction: {
      answers: answerItems,
      answerMathBindings: answerItems.map(answer => ({
        answerChoiceId: answer.id,
        mathObjectId: `math-${answer.id}`
      }))
    }
  } as PracticeItemPrompt
}

function beforeCheckProjection(itemId: string, attemptId: string): AttemptProjection {
  return {
    attemptId,
    practiceItemId: itemId,
    checkCount: 0,
    phase: {
      type: AttemptPhaseKinds.BeforeCheck
    },
    coachingButton: {
      type: 'hidden'
    }
  } as AttemptProjection
}

function incorrectProjection(itemId: string, attemptId: string): AttemptProjection {
  return {
    attemptId,
    practiceItemId: itemId,
    checkCount: 1,
    phase: {
      type: AttemptPhaseKinds.AfterIncorrectCheck,
      selectedAnswerId: 'a-2',
      misconceptionCode: 'misconception',
      purpose: 'Purpose',
      route: {
        type: 'noScaffoldAuthored'
      },
      routeStreak: 2,
      hintLevel: 'none'
    },
    coachingButton: {
      type: 'hidden'
    }
  } as AttemptProjection
}

function correctProjection(itemId: string, attemptId: string): AttemptProjection {
  return {
    attemptId,
    practiceItemId: itemId,
    checkCount: 1,
    phase: {
      type: AttemptPhaseKinds.AfterCorrectCheck,
      selectedAnswerId: 'a-1'
    },
    coachingButton: {
      type: 'visible',
      label: 'Continue'
    }
  } as AttemptProjection
}

function createDeferred<T>() {
  let resolve: ((value: T) => void) | null = null
  const promise = new Promise<T>(res => {
    resolve = res
  })

  return {
    promise,
    resolve: resolve as (value: T) => void
  }
}

describe('sample item attempt store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('load_UsesSafePromptRouteAndStartsInitialAttempt', async () => {
    const fetchMock = vi.fn(async (url: string, options?: Record<string, unknown>) => {
      if (url === '/api/practice-items') {
        return [
          makePrompt('item-1', ['a-1', 'a-2']),
          makePrompt('item-2', ['b-1', 'b-2'])
        ]
      }

      if (url === '/api/attempts') {
        expect(options).toMatchObject({
          method: 'POST',
          body: {
            practiceItemId: 'item-1'
          }
        })

        return beforeCheckProjection('item-1', 'attempt-1')
      }

      throw new Error(`Unexpected API call: ${url}`)
    })

    vi.stubGlobal('$fetch', fetchMock)

    const store = useSampleItemsStore()
    await store.load()

    expect(fetchMock).toHaveBeenCalledWith('/api/practice-items')
    expect(fetchMock).toHaveBeenCalledWith('/api/attempts', {
      method: 'POST',
      body: {
        practiceItemId: 'item-1'
      }
    })
    expect(store.selectedItemId).toBe('item-1')
    expect(store.loadState).toBe(LoadStates.Loaded)
    expect(store.attemptProjection).not.toBeNull()
    expect(store.attemptProjection?.attemptId).toBe('attempt-1')
  })

  it('load_DoesNotDuplicateHydratedAttempt', async () => {
    const serverPinia = createPinia()
    setActivePinia(serverPinia)

    const initialFetch = vi.fn(async (url: string) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1'])]
      }

      if (url === '/api/attempts') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', initialFetch)

    const serverStore = useSampleItemsStore()
    await serverStore.load()

    const serializedState = JSON.parse(JSON.stringify(serverPinia.state.value))
    expect(serializedState.sampleItems.attemptSessions['item-1']).toMatchObject({
      attemptId: 'attempt-1',
      projection: {
        attemptId: 'attempt-1',
        practiceItemId: 'item-1'
      }
    })

    const clientPinia = createPinia()
    clientPinia.state.value = serializedState
    setActivePinia(clientPinia)
    const secondFetch = vi.fn(async () => {
      throw new Error('Should not call API when hydrated')
    })

    vi.stubGlobal('$fetch', secondFetch)
    const clientStore = useSampleItemsStore()
    await clientStore.load()

    expect(secondFetch).not.toHaveBeenCalled()
    expect(clientStore.selectedItemId).toBe('item-1')
    expect(clientStore.attemptSessions['item-1']).toMatchObject({
      attemptId: 'attempt-1',
      projection: {
        attemptId: 'attempt-1',
        practiceItemId: 'item-1'
      }
    })
  })

  it('selectItem_StartsAtMostOneAttemptPerItem', async () => {
    const store = useSampleItemsStore()
    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1']), makePrompt('item-2', ['b-1'])]
      }

      if (url === '/api/attempts' && options?.body?.practiceItemId === 'item-1') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      if (url === '/api/attempts' && options?.body?.practiceItemId === 'item-2') {
        return beforeCheckProjection('item-2', 'attempt-2')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()
    await store.selectItem('item-2')

    const currentCalls = fetchMock.mock.calls.length
    await store.selectItem('item-2')

    expect(fetchMock).toHaveBeenCalledTimes(currentCalls)
  })

  it('selectItem_ReusesExistingAttemptAndHistory', async () => {
    const store = useSampleItemsStore()
    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1', 'a-2'])]
      }

      if (url === '/api/attempts') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)
    await store.load()
    fetchMock.mockClear()

    await store.selectItem('item-1')

    expect(fetchMock).not.toHaveBeenCalled()
    expect(store.attemptProjection).toMatchObject({
      attemptId: 'attempt-1',
      practiceItemId: 'item-1'
    })
  })

  it('concurrentSelectItem_DeduplicatesAttemptStart', async () => {
    const store = useSampleItemsStore()

    const deferred = createDeferred<AttemptProjection>()

    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1']), makePrompt('item-2', ['b-1'])]
      }

      if (url === '/api/attempts') {
        if (options?.body?.practiceItemId === 'item-1') {
          return beforeCheckProjection('item-1', 'attempt-1')
        }

        if (options?.body?.practiceItemId === 'item-2') {
          return deferred.promise
        }
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()

    const p1 = store.selectItem('item-2')
    const p2 = store.selectItem('item-2')

    const item2StartCalls = fetchMock.mock.calls.filter(
      call => call[0] === '/api/attempts' && call[1]?.body?.practiceItemId === 'item-2'
    ).length
    expect(item2StartCalls).toBe(1)

    deferred.resolve(beforeCheckProjection('item-2', 'attempt-2'))

    await Promise.all([p1, p2])
    expect(store.selectedItem?.id).toBe('item-2')
  })

  it('submitSelectedAnswer_PostsOnlySelectedAnswerId', async () => {
    const store = useSampleItemsStore()
    let capturedBody: Record<string, unknown> | null = null

    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1', 'a-2'])]
      }

      if (url === '/api/attempts') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      if (url === '/api/attempts/attempt-1/checks') {
        capturedBody = options?.body
        return incorrectProjection('item-1', 'attempt-1')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()
    store.selectAnswer('a-2')
    await store.submitSelectedAnswer()

    expect(capturedBody).toEqual({ selectedAnswerId: 'a-2' })
  })

  it('selectingAfterIncorrect_PreservesProjectionAndHidesOldFeedback', async () => {
    const store = useSampleItemsStore()

    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1', 'a-2'])]
      }

      if (url === '/api/attempts') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      if (url === '/api/attempts/attempt-1/checks') {
        return incorrectProjection('item-1', 'attempt-1')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()
    store.selectAnswer('a-1')
    await store.submitSelectedAnswer()

    const preservedProjection = store.attemptProjection
    expect(store.submissionState).toBe(SubmissionStates.Submitted)

    store.selectAnswer('a-2')

    expect(store.attemptProjection).toBe(preservedProjection)
    expect(store.submissionState).toBe(SubmissionStates.Idle)
    expect(store.selectedAnswerId).toBe('a-2')
  })

  it('correctProjection_LocksSelectionAndResubmission', async () => {
    const store = useSampleItemsStore()

    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1', 'a-2'])]
      }

      if (url === '/api/attempts') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      if (url === '/api/attempts/attempt-1/checks') {
        return correctProjection('item-1', 'attempt-1')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()
    store.selectAnswer('a-1')
    await store.submitSelectedAnswer()

    expect(store.submissionState).toBe(SubmissionStates.Submitted)

    store.selectAnswer('a-2')
    expect(store.selectedAnswerId).toBe('a-1')

    await store.submitSelectedAnswer()

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('failedCheck_PreservesLastServerProjectionAndAllowsRetry', async () => {
    const store = useSampleItemsStore()

    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1', 'a-2'])]
      }

      if (url === '/api/attempts') {
        return beforeCheckProjection('item-1', 'attempt-1')
      }

      if (url === '/api/attempts/attempt-1/checks') {
        throw new Error('server unavailable')
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()
    store.selectAnswer('a-1')
    await store.submitSelectedAnswer()

    const preservedProjection = store.attemptProjection
    expect(store.submissionState).toBe(SubmissionStates.Error)
    expect(store.attemptProjection).toBe(preservedProjection)

    fetchMock.mockImplementationOnce(async (url: string) => {
      if (url === '/api/attempts/attempt-1/checks') {
        return incorrectProjection('item-1', 'attempt-1')
      }

      throw new Error('unexpected')
    })

    await store.submitSelectedAnswer()
    expect(store.submissionState).toBe(SubmissionStates.Submitted)
    expect(store.attemptProjection).toEqual(expect.objectContaining({
      attemptId: 'attempt-1',
      practiceItemId: 'item-1'
    }))
  })

  it('focusForItem_WaitsForTargetItemSession', async () => {
    const store = useSampleItemsStore()
    const deferred = createDeferred<AttemptProjection>()

    const fetchMock = vi.fn(async (url: string, options?: Record<string, any>) => {
      if (url === '/api/practice-items') {
        return [makePrompt('item-1', ['a-1']), makePrompt('item-2', ['b-1'])]
      }

      if (url === '/api/attempts') {
        if (options?.body?.practiceItemId === 'item-1') {
          return beforeCheckProjection('item-1', 'attempt-1')
        }

        if (options?.body?.practiceItemId === 'item-2') {
          return deferred.promise
        }
      }

      throw new Error('unexpected')
    })

    vi.stubGlobal('$fetch', fetchMock)

    await store.load()

    const focusCommand = {
      itemId: 'item-2',
      target: {
        kind: 'answer' as const,
        id: 'b-1'
      }
    }

    const promise = store.focusForItem(focusCommand)

    await Promise.resolve()
    expect(store.focusTarget).toBeNull()

    deferred.resolve(beforeCheckProjection('item-2', 'attempt-2'))
    await promise

    expect(store.focusTarget).toEqual(focusCommand.target)
    expect(store.selectedItem?.id).toBe('item-2')
  })
})

function coachableBeforeCheck(itemId: string, attemptId: string): AttemptProjection {
  return {
    ...beforeCheckProjection(itemId, attemptId),
    coachingButton: {
      type: 'visible',
      label: 'Help'
    }
  } as AttemptProjection
}

function coachableIncorrect(itemId: string, attemptId: string): AttemptProjection {
  return {
    ...incorrectProjection(itemId, attemptId),
    coachingButton: {
      type: 'visible',
      label: 'Diagnosis'
    }
  } as AttemptProjection
}

function coachableCorrect(itemId: string, attemptId: string): AttemptProjection {
  return {
    ...correctProjection(itemId, attemptId),
    coachingButton: {
      type: 'visible',
      label: 'Why it works'
    }
  } as AttemptProjection
}

interface CoachingHarnessOptions {
  startProjection?: (itemId: string, attemptId: string) => AttemptProjection
  onCoach?: (options: Record<string, any>) => unknown | Promise<unknown>
  onCheck?: () => unknown
  onRead?: (attemptId: string) => unknown
}

function askMove(focusPhraseIds: string[] = []) {
  return {
    move: {
      type: 'askReadingQuestion',
      message: 'What quantity does the phrase describe?',
      focusPhraseIds
    }
  }
}

async function createCoachingHarness(options: CoachingHarnessOptions = {}) {
  const startProjection = options.startProjection ?? coachableBeforeCheck
  const coachCalls: Array<Record<string, any>> = []

  const fetchMock = vi.fn(async (url: string, requestOptions?: Record<string, any>) => {
    if (url === '/api/practice-items') {
      return [makePrompt('item-1', ['a-1', 'a-2']), makePrompt('item-2', ['b-1', 'b-2'])]
    }

    if (url === '/api/attempts') {
      const itemId = requestOptions?.body?.practiceItemId
      return startProjection(itemId, `attempt-${itemId}`)
    }

    if (url.endsWith('/coach')) {
      coachCalls.push(requestOptions ?? {})
      if (options.onCoach) {
        return options.onCoach(requestOptions ?? {})
      }
      return askMove()
    }

    if (url.endsWith('/checks') && options.onCheck) {
      return options.onCheck()
    }

    if (url.startsWith('/api/attempts/') && options.onRead) {
      return options.onRead(url.slice('/api/attempts/'.length))
    }

    throw new Error(`Unexpected API call: ${url}`)
  })

  vi.stubGlobal('$fetch', fetchMock)

  const store = useSampleItemsStore()
  await store.load()

  return { store, fetchMock, coachCalls }
}

describe('sample item coaching store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requestCoaching_BeforeCheckSendsHelpRequested', async () => {
    const { store, coachCalls, fetchMock } = await createCoachingHarness()

    await store.requestCoaching()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/attempts/attempt-item-1/coach',
      expect.objectContaining({ method: 'POST' })
    )
    expect(coachCalls[0]?.body).toEqual({ event: 'helpRequested' })
    expect(store.coachingState).toBe('shown')
    expect(store.coachingMove).toMatchObject({ type: 'askReadingQuestion' })
  })

  it('requestCoaching_AfterIncorrectSendsDiagnosisRequested', async () => {
    const { store, coachCalls } = await createCoachingHarness({
      startProjection: coachableIncorrect
    })

    await store.requestCoaching()

    expect(coachCalls[0]?.body).toEqual({ event: 'diagnosisRequested' })
  })

  it('requestCoaching_AfterCorrectSendsExplainCorrect', async () => {
    const { store, coachCalls } = await createCoachingHarness({
      startProjection: coachableCorrect
    })

    await store.requestCoaching()

    expect(coachCalls[0]?.body).toEqual({ event: 'explainCorrect' })
  })

  it('requestCoaching_SendsNoModelInstructionsOrHistory', async () => {
    const { store, coachCalls } = await createCoachingHarness()

    await store.requestCoaching()

    const body = coachCalls[0]?.body as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['event'])
    for (const forbidden of [
      'model', 'instructions', 'history', 'phase',
      'misconception', 'suggestedStepId', 'correctAnswerId'
    ]) {
      expect(body).not.toHaveProperty(forbidden)
    }
  })

  it('requestCoaching_RequiresVisibleServerButton', async () => {
    const { store, coachCalls } = await createCoachingHarness({
      startProjection: beforeCheckProjection
    })

    await store.requestCoaching()

    expect(coachCalls).toHaveLength(0)
    expect(store.coachingState).toBe('idle')
  })

  it('requestCoaching_DeduplicatesConcurrentRequests', async () => {
    const deferred = createDeferred<unknown>()
    const { store, coachCalls } = await createCoachingHarness({
      onCoach: () => deferred.promise
    })

    const first = store.requestCoaching()
    const second = store.requestCoaching()

    expect(coachCalls).toHaveLength(1)

    deferred.resolve(askMove())
    await Promise.all([first, second])

    expect(coachCalls).toHaveLength(1)
    expect(store.coachingState).toBe('shown')
  })

  it('requestCoaching_StoresValidatedMovePerItem', async () => {
    const { store } = await createCoachingHarness()

    await store.requestCoaching()
    expect(store.coachingMove).not.toBeNull()

    await store.selectItem('item-2')
    expect(store.coachingMove).toBeNull()
    expect(store.coachingState).toBe('idle')
  })

  it('requestCoaching_IgnoresResponseAfterPhaseChanges', async () => {
    const deferred = createDeferred<unknown>()
    const { store } = await createCoachingHarness({
      onCoach: () => deferred.promise,
      onCheck: () => coachableIncorrect('item-1', 'attempt-item-1')
    })

    const pending = store.requestCoaching()

    store.selectAnswer('a-2')
    await store.submitSelectedAnswer()

    deferred.resolve(askMove())
    await pending

    expect(store.coachingMove).toBeNull()
    expect(store.attemptProjection?.phase.type).toBe(AttemptPhaseKinds.AfterIncorrectCheck)
  })

  it('successfulAnswerCheck_ClearsPreviousCoachingMove', async () => {
    const { store } = await createCoachingHarness({
      onCheck: () => coachableCorrect('item-1', 'attempt-item-1')
    })

    await store.requestCoaching()
    expect(store.coachingMove).not.toBeNull()

    store.selectAnswer('a-1')
    await store.submitSelectedAnswer()

    expect(store.coachingMove).toBeNull()
    expect(store.coachingState).toBe('idle')
  })

  it('itemNavigation_DoesNotLeakCoachingMoveBetweenItems', async () => {
    const { store } = await createCoachingHarness()

    await store.requestCoaching()
    const firstMove = store.coachingMove
    expect(firstMove).not.toBeNull()

    await store.selectItem('item-2')
    expect(store.coachingMove).toBeNull()

    await store.selectItem('item-1')
    expect(store.coachingMove).toEqual(firstMove)
  })

  it('coachingFailure_PreservesAttemptProjection', async () => {
    const { store } = await createCoachingHarness({
      onCoach: () => {
        const error = new Error('bad gateway') as Error & { statusCode: number }
        error.statusCode = 502
        throw error
      }
    })

    const projectionBefore = store.attemptProjection

    await store.requestCoaching()

    expect(store.attemptProjection).toBe(projectionBefore)
    expect(store.coachingState).toBe('error')
    expect(store.coachingError).toBe('Coaching is temporarily unavailable.')
  })

  it('coachingFailure_AllowsExplicitRetry', async () => {
    let failNext = true
    const { store, coachCalls } = await createCoachingHarness({
      onCoach: () => {
        if (failNext) {
          failNext = false
          throw new Error('network down')
        }
        return askMove()
      }
    })

    await store.requestCoaching()
    expect(store.coachingState).toBe('error')
    expect(store.coachingError).toBe('Could not reach the coach.')

    await store.retryCoaching()

    expect(coachCalls).toHaveLength(2)
    expect(store.coachingState).toBe('shown')
    expect(store.coachingMove).not.toBeNull()
  })

  it('coaching409_RefreshesAttemptProjection', async () => {
    const refreshed = coachableIncorrect('item-1', 'attempt-item-1')
    const { store } = await createCoachingHarness({
      onCoach: () => {
        const error = new Error('conflict') as Error & { statusCode: number }
        error.statusCode = 409
        throw error
      },
      onRead: () => refreshed
    })

    await store.requestCoaching()

    expect(store.attemptProjection).toEqual(refreshed)
    expect(store.coachingState).toBe('error')
    expect(store.coachingError).toBe('This item changed. Ask the coach again.')
  })

  it('suggestScaffold_UsesAttemptIdNotSuggestedStepId', async () => {
    const { store } = await createCoachingHarness({
      startProjection: coachableIncorrect,
      onCoach: () => ({
        move: {
          type: 'suggestScaffold',
          message: 'A short walkthrough can help.',
          focusPhraseIds: [],
          suggestedStepId: 'step-secret-entry'
        }
      })
    })

    await store.requestCoaching()

    const view = coachingCardView(store.coachingMove, store.attemptProjection!.attemptId)
    expect(view?.walkthroughHref).toBe('/scaffolds/attempt-item-1')
    expect(JSON.stringify(view)).not.toContain('step-secret-entry')
  })

  it('coachingFocus_UsesFirstKnownPhrase', async () => {
    const { store } = await createCoachingHarness({
      onCoach: () => askMove(['foreign-phrase', 'item-1-phrase-1'])
    })

    await store.requestCoaching()

    expect(store.focusTarget).toEqual({
      kind: 'phrase',
      id: 'item-1-phrase-1'
    })
  })

  it('coachingFocus_IgnoresForeignPhraseId', async () => {
    const { store } = await createCoachingHarness({
      onCoach: () => askMove(['foreign-phrase', 'item-2-phrase-1'])
    })

    await store.requestCoaching()

    expect(store.focusTarget).toBeNull()
    expect(store.coachingState).toBe('shown')
  })
})
