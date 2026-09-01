import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAttempt, startAttempt, checkAttempt } from '#server/utils/attempts'
import { getPracticeItems } from '#server/utils/practice-items'
import { AttemptPhaseKinds, type AttemptProjection } from '#shared/types/sample-items'

type RawFetch = ((url: string, options?: unknown) => Promise<{ status: number; _data: unknown }>)

describe('attempt and practice-item proxy contracts', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      apiUrl: 'https://example.invalid'
    }) as unknown)

    vi.stubGlobal('createError', (error: {
      statusCode: number
      statusMessage?: string
      data?: unknown
    }) => {
      const thrown = new Error(error.statusMessage)
      ;(thrown as { statusCode: number; data: unknown }).statusCode = error.statusCode
      ;(thrown as { statusCode: number; data: unknown }).data = error.data
      throw thrown
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('practiceItemsProxy_UsesSafeUpstreamPath', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 200,
      _data: [{ id: 'item-1', text: { sourceText: 'x', tokens: [], phrases: [], sentences: [] }, semantics: { entities: [], edges: [] }, mathematics: { objects: [], textBindings: [] }, interaction: { answers: [], answerMathBindings: [] } }]
    }))

    vi.stubGlobal('$fetch', {
      raw: rawFetch
    })

    await getPracticeItems({} as any)

    expect(rawFetch).toHaveBeenCalledWith('/api/practice-items', {
      baseURL: 'https://example.invalid',
      method: 'GET',
      ignoreResponseError: true
    })
  })

  it('startAttemptProxy_ForwardsOnlyPracticeItemId', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 200,
      _data: {
        attemptId: 'attempt-1',
        practiceItemId: 'item-1',
        checkCount: 1,
        phase: {
          type: AttemptPhaseKinds.BeforeCheck
        },
        coachingButton: {
          type: 'hidden'
        }
      } as AttemptProjection
    }))

    vi.stubGlobal('$fetch', {
      raw: rawFetch
    })

    const event = {} as any

    await startAttempt(event, {
      practiceItemId: 'item-1',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      selectedAnswerId: 'blocked'
    } as any)

    const [, options] = rawFetch.mock.calls[0] as [string, { method: string; body: { practiceItemId: string } }]
    expect(options.body).toEqual({ practiceItemId: 'item-1' })
    expect(options.body).not.toHaveProperty('selectedAnswerId')
  })

  it('checkAttemptProxy_ForwardsOnlySelectedAnswerId', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 200,
      _data: {
        attemptId: 'attempt-1',
        practiceItemId: 'item-1',
        checkCount: 1,
        phase: {
          type: AttemptPhaseKinds.AfterCorrectCheck,
          selectedAnswerId: 'selected-answer'
        },
        coachingButton: {
          type: 'hidden'
        }
      } as AttemptProjection
    }))

    vi.stubGlobal('$fetch', {
      raw: rawFetch
    })

    await checkAttempt({}, 'attempt-1', {
      selectedAnswerId: 'selected-answer',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      extraKey: 'blocked'
    } as any)

    const [, options] = rawFetch.mock.calls[0] as [string, { method: string; body: { selectedAnswerId: string } }]
    expect(options.body).toEqual({ selectedAnswerId: 'selected-answer' })
    expect(options.body).not.toHaveProperty('extraKey')
  })

  it('attemptProxy_PreservesUpstreamProblemStatus', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 409,
      _data: {
        title: 'Conflict',
        status: 409
      }
    }))

    vi.stubGlobal('$fetch', {
      raw: rawFetch
    })

    await expect(getAttempt({}, 'attempt-1')).rejects.toMatchObject({
      statusCode: 409,
      data: {
        title: 'Conflict',
        status: 409
      }
    })

    expect(rawFetch).toHaveBeenCalledWith('/api/attempts/attempt-1', {
      baseURL: 'https://example.invalid',
      method: 'GET',
      ignoreResponseError: true
    })
  })
})
