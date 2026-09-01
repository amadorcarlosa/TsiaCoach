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
  SubmissionStates
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
      phrases: []
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
