import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (event: unknown) => Promise<unknown>
const fetch = vi.fn()

describe('Effect H3 request boundaries', () => {
  beforeEach(() => {
    fetch.mockReset()
    vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
    vi.stubGlobal('getRouterParam', () => 'attempt-1')
    vi.stubGlobal('useRuntimeConfig', () => ({ apiUrl: 'https://api.example.invalid' }))
    vi.stubGlobal('$fetch', { raw: fetch })
    vi.stubGlobal('createError', (input: { statusCode: number; statusMessage: string; data?: unknown }) =>
      Object.assign(new Error(input.statusMessage), input))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rejects a missing practice-item identifier before calling the backend', async () => {
    vi.stubGlobal('readBody', async () => ({ selectedAnswerId: 'answer-b' }))
    const handler = (await import('../api/attempts.post')).default as Handler
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, message: 'A practice item ID is required.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a numeric answer identifier before calling the backend', async () => {
    vi.stubGlobal('readBody', async () => ({ selectedAnswerId: 123 }))
    const handler = (await import('../api/attempts/[attemptId]/checks.post')).default as Handler
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, message: 'A selected answer ID is required.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects a learner submission carrying a correctness claim', async () => {
    vi.stubGlobal('readBody', async () => ({ type: 'enterScalar', value: 2, satisfied: true }))
    const handler = (await import('../api/scaffold-sessions/[sessionId]/checks.post')).default as Handler
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, message: 'The scaffold response is malformed.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an array as a decision board state', async () => {
    vi.stubGlobal('readBody', async () => ({ instructions: 'evaluate', state: [] }))
    const handler = (await import('../api/decisions.post')).default as Handler
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, message: 'Provide a board state and decision instructions.' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects an agent request with a malformed history', async () => {
    vi.stubGlobal('readBody', async () => ({ model: 'model-1', instructions: 'help', prompt: 'hello', history: null }))
    const handler = (await import('../api/agent.post')).default as Handler
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400, message: 'Invalid agent request body.' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
