import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type RawFetch = ((url: string, options?: unknown) => Promise<{ status: number; _data: unknown }>)

function stubNitroGlobals() {
  vi.stubGlobal('useRuntimeConfig', () => ({
    apiUrl: 'https://example.invalid'
  }) as unknown)

  vi.stubGlobal('createError', (error: {
    statusCode: number
    statusMessage?: string
    data?: unknown
  }) => {
    const thrown = new Error(error.statusMessage)
    ;(thrown as unknown as { statusCode: number; statusMessage?: string; data: unknown }).statusCode = error.statusCode
    ;(thrown as unknown as { statusMessage?: string }).statusMessage = error.statusMessage
    ;(thrown as unknown as { data: unknown }).data = error.data
    throw thrown
  })
}

const validMove = {
  move: {
    type: 'askReadingQuestion',
    message: 'What does the phrase describe?',
    focusPhraseIds: ['phrase-1']
  }
}

describe('coaching proxy contract', () => {
  beforeEach(() => {
    stubNitroGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('coachAttemptProxy_ForwardsOnlyEvent', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 200,
      _data: validMove
    }))

    vi.stubGlobal('$fetch', { raw: rawFetch })

    const { coachAttempt } = await import('#server/utils/coaching')

    await coachAttempt({} as any, 'attempt-1', {
      event: 'helpRequested',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      model: 'blocked',
      instructions: 'blocked',
      history: [],
      phase: 'blocked',
      misconception: 'blocked',
      suggestedStepId: 'blocked',
      correctAnswerId: 'blocked'
    } as any)

    const [url, options] = rawFetch.mock.calls[0] as [string, { method: string; body: Record<string, unknown> }]
    expect(url).toBe('/api/attempts/attempt-1/coach')
    expect(options.method).toBe('POST')
    expect(options.body).toEqual({ event: 'helpRequested' })
    expect(options.body).not.toHaveProperty('model')
    expect(options.body).not.toHaveProperty('instructions')
    expect(options.body).not.toHaveProperty('history')
    expect(options.body).not.toHaveProperty('phase')
    expect(options.body).not.toHaveProperty('misconception')
    expect(options.body).not.toHaveProperty('suggestedStepId')
    expect(options.body).not.toHaveProperty('correctAnswerId')
  })

  it('coachAttemptProxy_RejectsUnexpectedRequestFields', async () => {
    const { parseCoachTurnRequest } = await import('#server/utils/coaching')

    expect(() => parseCoachTurnRequest({
      event: 'helpRequested',
      model: 'gpt-anything'
    })).toThrowError(expect.objectContaining({ statusCode: 400 }))

    expect(() => parseCoachTurnRequest({
      event: 'helpRequested',
      history: []
    })).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('coachAttemptProxy_Preserves409', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 409,
      _data: { title: 'Coaching event is not legal in the current attempt phase.', status: 409 }
    }))

    vi.stubGlobal('$fetch', { raw: rawFetch })
    const { coachAttempt } = await import('#server/utils/coaching')

    await expect(coachAttempt({} as any, 'attempt-1', { event: 'helpRequested' }))
      .rejects.toMatchObject({ statusCode: 409 })
  })

  it('coachAttemptProxy_Preserves429', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 429,
      _data: { title: 'The model provider rate-limited the request', status: 429 }
    }))

    vi.stubGlobal('$fetch', { raw: rawFetch })
    const { coachAttempt } = await import('#server/utils/coaching')

    await expect(coachAttempt({} as any, 'attempt-1', { event: 'diagnosisRequested' }))
      .rejects.toMatchObject({
        statusCode: 429,
        statusMessage: 'The coach is busy. Try again in a moment.'
      })
  })

  it('coachAttemptProxy_Preserves502', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 502,
      _data: { title: 'The model provider failed the coaching turn', status: 502 }
    }))

    vi.stubGlobal('$fetch', { raw: rawFetch })
    const { coachAttempt } = await import('#server/utils/coaching')

    await expect(coachAttempt({} as any, 'attempt-1', { event: 'explainCorrect' }))
      .rejects.toMatchObject({ statusCode: 502 })
  })

  it('coachAttemptProxy_DoesNotExposeRawProviderFailure', async () => {
    const rawFetch = vi.fn<RawFetch>(async () => ({
      status: 502,
      _data: {
        title: 'The model provider failed the coaching turn',
        detail: 'azure-openai deployment gpt-x exploded: raw stack trace here',
        status: 502
      }
    }))

    vi.stubGlobal('$fetch', { raw: rawFetch })
    const { coachAttempt } = await import('#server/utils/coaching')

    let thrown: unknown
    try {
      await coachAttempt({} as any, 'attempt-1', { event: 'helpRequested' })
    } catch (error) {
      thrown = error
    }

    const serialized = JSON.stringify({
      statusMessage: (thrown as { statusMessage?: string }).statusMessage,
      message: (thrown as Error).message,
      data: (thrown as { data?: unknown }).data
    })
    expect(serialized).not.toContain('azure-openai')
    expect(serialized).not.toContain('stack trace')
    expect(serialized).not.toContain('gpt-x')
    expect((thrown as { statusCode: number }).statusCode).toBe(502)
    expect((thrown as { statusMessage?: string }).statusMessage)
      .toBe('Coaching is temporarily unavailable.')
  })

  it('coachRoute_RequiresAttemptId', async () => {
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', () => undefined)
    vi.stubGlobal('readBody', async () => ({ event: 'helpRequested' }))
    vi.stubGlobal('$fetch', { raw: vi.fn() })

    const handler = (await import('../api/attempts/[attemptId]/coach.post')).default as
      (event: unknown) => Promise<unknown>

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('coachRoute_RejectsUnknownEvent', async () => {
    const rawFetch = vi.fn<RawFetch>()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', () => 'attempt-1')
    vi.stubGlobal('readBody', async () => ({ event: 'openScaffoldStep' }))
    vi.stubGlobal('$fetch', { raw: rawFetch })

    const handler = (await import('../api/attempts/[attemptId]/coach.post')).default as
      (event: unknown) => Promise<unknown>

    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
    expect(rawFetch).not.toHaveBeenCalled()
  })
})
