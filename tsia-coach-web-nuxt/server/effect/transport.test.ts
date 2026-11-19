import { afterEach, describe, expect, it, vi } from 'vitest'
import { Cause, Effect, Exit, Fiber } from 'effect'
import { context, ROOT_CONTEXT, trace, TraceFlags, createTraceState } from '@opentelemetry/api'
import { requestBackend, type BackendFetch } from './transport'

describe('Effect backend transport', () => {
  afterEach(() => vi.restoreAllMocks())

  it('injects the active W3C trace and trace state without forwarding baggage', async () => {
    const parent = trace.setSpanContext(ROOT_CONTEXT, {
      traceId: '12345678901234567890123456789012',
      spanId: '1234567890123456',
      traceFlags: TraceFlags.SAMPLED,
      traceState: createTraceState('vendor=safe'),
    })
    vi.spyOn(context, 'active').mockReturnValue(parent)
    const fetch = vi.fn<BackendFetch>().mockResolvedValue({ status: 200, _data: [] })
    await Effect.runPromise(requestBackend('https://example.invalid', { path: '/api/models' }, fetch))
    expect(fetch.mock.calls[0]?.[1].headers).toEqual({
      traceparent: '00-12345678901234567890123456789012-1234567890123456-01',
      tracestate: 'vendor=safe',
    })
  })

  it('retries a transient GET once and disables the underlying fetch retry policy', async () => {
    const fetch = vi.fn<BackendFetch>()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce({ status: 200, _data: { ok: true } })

    await expect(Effect.runPromise(requestBackend('https://example.invalid', { path: '/api/models' }, fetch)))
      .resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', retry: 0, ignoreResponseError: true })
    expect(fetch.mock.calls[0]?.[1].signal).toBeInstanceOf(AbortSignal)
  })

  it.each(['connection', 'status'] as const)('does not repeat a POST after a %s failure', async failure => {
    const fetch = failure === 'connection'
      ? vi.fn<BackendFetch>().mockRejectedValue(new TypeError('offline'))
      : vi.fn<BackendFetch>().mockResolvedValue({ status: 503, _data: { title: 'Busy' } })
    const exit = await Effect.runPromiseExit(requestBackend('https://example.invalid', {
      path: '/api/attempts', method: 'POST', body: { practiceItemId: 'item-1' },
    }, fetch))
    expect(Exit.isFailure(exit)).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('preserves a conflict without retrying or treating it as a connection failure', async () => {
    const fetch = vi.fn<BackendFetch>().mockResolvedValue({ status: 409, _data: { title: 'Conflict' } })
    const exit = await Effect.runPromiseExit(requestBackend('https://example.invalid', { path: '/api/attempts/1' }, fetch))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(Cause.squash(exit.cause)).toMatchObject({ _tag: 'BackendResponseError', status: 409, body: { title: 'Conflict' } })
    }
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('limits transient GET responses to two total attempts', async () => {
    const fetch = vi.fn<BackendFetch>().mockResolvedValue({ status: 502 })
    await Effect.runPromiseExit(requestBackend('https://example.invalid', { path: '/api/models' }, fetch))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('aborts the underlying request when its owning fiber is interrupted', async () => {
    let signal: AbortSignal | undefined
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const fetch: BackendFetch = (_path, options) => new Promise((_resolve, reject) => {
      signal = options.signal
      signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
      started()
    })
    const fiber = Effect.runFork(requestBackend('https://example.invalid', { path: '/api/attempts', method: 'POST' }, fetch))
    await ready
    await Effect.runPromise(Fiber.interrupt(fiber))
    expect(signal?.aborted).toBe(true)
  })

  it('rejects a malformed success payload in the typed error channel', async () => {
    const fetch = vi.fn<BackendFetch>().mockResolvedValue({ status: 200, _data: { text: 12 } })
    const exit = await Effect.runPromiseExit(requestBackend('https://example.invalid', {
      path: '/api/agent', method: 'POST',
      validate: (body): body is { text: string } => typeof (body as { text?: unknown })?.text === 'string',
      invalidResponseMessage: 'The agent API returned an invalid response.',
    }, fetch))
    if (Exit.isFailure(exit)) expect(Cause.squash(exit.cause)).toMatchObject({ _tag: 'BackendPayloadError' })
    else throw new Error('Malformed payload was accepted')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
