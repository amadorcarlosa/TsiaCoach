import { afterEach, describe, expect, it, vi } from 'vitest'
import { runBrowserEffect } from '../runtime'
import { browserRequest } from './transport'
import { requestAgentTurn, AgentRequestError } from '~/utils/agent'

afterEach(() => vi.unstubAllGlobals())

describe('Effect workflow transport', () => {
  it('preserves typed transport errors and never retries paid mutations', async () => {
    const failure = Object.assign(new Error('safe upstream error'), { statusCode: 429 })
    const fetch = vi.fn().mockRejectedValue(failure)
    vi.stubGlobal('$fetch', fetch)
    await expect(runBrowserEffect(browserRequest('/api/agent', { method: 'POST', body: {} }))).rejects.toBe(failure)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('/api/agent', expect.objectContaining({ method: 'POST', retry: 0 }))
  })

  it('interrupts the underlying request when its workflow is cancelled', async () => {
    let requestSignal: AbortSignal | undefined
    const fetch = vi.fn((_url, options) => new Promise((_resolve, reject) => {
      requestSignal = options.signal
      requestSignal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }))
    vi.stubGlobal('$fetch', fetch)
    const lifetime = new AbortController()
    const pending = runBrowserEffect(browserRequest('/api/agent', { method: 'POST' }), { signal: lifetime.signal })
    lifetime.abort()
    await expect(pending).rejects.toBeDefined()
    expect(requestSignal?.aborted).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('validates agent text without exposing an Effect failure wrapper', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({ model: 'test' }))
    const request = { model: 'test', instructions: '', prompt: 'hello', history: [] }
    await expect(requestAgentTurn(request)).rejects.toBeInstanceOf(AgentRequestError)
    await expect(requestAgentTurn(request)).rejects.toThrow('Agent response did not include any text.')
  })
})
