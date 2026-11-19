import { EventEmitter } from 'node:events'
import { afterAll, describe, expect, it } from 'vitest'
import { Cause, Effect, Exit } from 'effect'
import type { H3Event } from 'h3'
import { httpStatusForExit, runServerEffect } from './runtime'
import { closeServerTelemetry, initializeServerTelemetry, serverTelemetry } from './telemetry'
import { traceHeaders } from '#shared/effect/trace'

function request() {
  const req = Object.assign(new EventEmitter(), { method: 'POST', headers: {
    traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01', tracestate: 'vendor=value',
  } })
  const res = Object.assign(new EventEmitter(), { writableEnded: false, statusCode: 200 })
  return { node: { req, res }, path: '/api/attempts/opaque-student-id/checks?answer=private' } as unknown as H3Event
}

afterAll(closeServerTelemetry)

describe('Effect HTTP runtime', () => {
  it('records the same HTTP status for cancellation, typed failures and successful responses', () => {
    expect(httpStatusForExit(Exit.failCause(Cause.interrupt(0)), 200)).toBe(499)
    expect(httpStatusForExit(Exit.fail({ statusCode: 409 }), 200)).toBe(409)
    expect(httpStatusForExit(Exit.fail(new Error('Unexpected failure')), 200)).toBe(500)
    expect(httpStatusForExit(Exit.succeed(undefined), 204)).toBe(204)
  })
  it('preserves W3C trace identity and state through nested Effect operations', async () => {
    const event = request()
    const headers = await runServerEffect(event, Effect.sync(traceHeaders).pipe(Effect.withSpan('attempts.check', { kind: 'client' })))
    expect(headers.traceparent).toMatch(/^00-0af7651916cd43dd8448eb211c80319c-[a-f0-9]{16}-01$/)
    expect(headers.traceparent).not.toContain('b7ad6b7169203331')
    expect(headers.tracestate).toBe('vendor=value')
    expect(event.node.req.listenerCount('aborted')).toBe(0)
    expect(event.node.res.listenerCount('close')).toBe(0)
  })

  it('unwraps typed failures instead of exposing fiber internals', async () => {
    const error = Object.assign(new Error('Safe response'), { statusCode: 409 })
    await expect(runServerEffect({} as H3Event, Effect.fail(error))).rejects.toBe(error)
  })

  it('interrupts work on disconnect and removes request listeners', async () => {
    const event = request()
    const pending = runServerEffect(event, Effect.never)
    event.node.res.emit('close')
    await expect(pending).rejects.toMatchObject({ statusCode: 499 })
    expect(event.node.req.listenerCount('aborted')).toBe(0)
    expect(event.node.res.listenerCount('close')).toBe(0)
  })

  it('initializes the provider/runtime owner only once', () => {
    expect(serverTelemetry()).toBe(serverTelemetry())
  })

  it('waits for old providers to close before registering a replacement on reload', async () => {
    const previous = serverTelemetry()
    const closing = closeServerTelemetry()
    const concurrentClose = closeServerTelemetry()
    const replacement = await initializeServerTelemetry()
    await Promise.all([closing, concurrentClose])
    expect(replacement).not.toBe(previous)
    expect(serverTelemetry()).toBe(replacement)
    const headers = await runServerEffect(request(), Effect.sync(traceHeaders))
    expect(headers.traceparent).toMatch(/^00-0af7651916cd43dd8448eb211c80319c-[a-f0-9]{16}-01$/)
  })

  it('preserves cancellation when shutdown interrupts an active request', async () => {
    let started!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const event = request()
    const pending = runServerEffect(event, Effect.sync(started).pipe(Effect.andThen(Effect.never)))
    const rejected = expect(pending).rejects.toMatchObject({ statusCode: 499 })
    await ready
    await closeServerTelemetry()
    await rejected
    expect(event.node.req.listenerCount('aborted')).toBe(0)
    expect(event.node.res.listenerCount('close')).toBe(0)
  })
})
