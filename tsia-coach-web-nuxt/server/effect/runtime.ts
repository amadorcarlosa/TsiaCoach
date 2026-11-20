import { Cause, Effect, Exit } from 'effect'
import { OtelTracer } from '@effect/opentelemetry'
import { createError, type H3Event } from 'h3'
import { incomingTraceContext } from '#shared/effect/trace'
import { unwrapExit } from '#shared/effect/run'
import { serverTelemetry } from './telemetry'

const routeParts = new Set(['api', 'agent', 'models', 'attempts', 'checks', 'coach', 'scaffold-sessions', 'scaffolds', 'practice-items', 'sample-items', 'decisions', 'rods', 'algebra-tiles', 'base-ten-blocks', 'health', 'playground-sessions', 'playground-events', 'events', 'summary'])
function routeName(event: H3Event) {
  const pathname = (event.path ?? event.node?.req?.url ?? '/api').split('?')[0]!
  return pathname.split('/').map(part => !part || routeParts.has(part) ? part : ':id').join('/')
}

export function httpStatusForExit(exit: Exit.Exit<unknown, unknown>, successStatus: number, cancelled = false): number {
  if (cancelled || (Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause))) return 499
  if (Exit.isSuccess(exit)) return successStatus
  const failure = Cause.squash(exit.cause)
  if (failure instanceof Error && failure.name === 'AbortError') return 499
  return failure && typeof failure === 'object' && 'statusCode' in failure ? Number(failure.statusCode) : 500
}

export async function runServerEffect<A, E>(event: H3Event, effect: Effect.Effect<A, E, never>, name?: string): Promise<A> {
  // Contract tests pass minimal event doubles, without a live HTTP lifecycle.
  if (!event?.node?.req) return unwrapExit(await Effect.runPromiseExit(effect))
  const method = event.method ?? event.node.req.method ?? 'GET'
  const operation = `${method} ${routeName(event)}`
  const controller = new AbortController()
  const abort = () => controller.abort()
  const disconnect = () => { if (!event.node.res.writableEnded) abort() }
  event.node.req.once('aborted', abort)
  event.node.res.once('close', disconnect)
  const parent = incomingTraceContext(event.node.req.headers)
  const telemetry = serverTelemetry()
  const started = performance.now()
  let failed = true
  const traced = Effect.gen(function* () {
    const result = yield* (name ? effect.pipe(Effect.withSpan(name)) : effect)
    return result
  }).pipe(Effect.onExit(exit => Effect.gen(function* () {
    const status = httpStatusForExit(exit, event.node.res.statusCode, controller.signal.aborted)
    yield* Effect.annotateCurrentSpan('http.response.status_code', status)
    yield* Effect.logInfo('http.request.completed').pipe(Effect.annotateLogs({
      operation, outcome: Exit.isSuccess(exit) ? 'success' : 'failure',
    }))
  })), Effect.withSpan(operation, {
    kind: 'server', attributes: { 'http.request.method': method, 'http.route': routeName(event) },
  }))
  try {
    const execution = parent ? traced.pipe(OtelTracer.withSpanContext(parent)) : traced
    const result = unwrapExit(await telemetry.runtime.runPromiseExit(execution, { signal: controller.signal }))
    failed = false
    return result
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw createError({ statusCode: 499, statusMessage: 'Request cancelled.' })
    }
    throw error
  } finally {
    event.node.req.off('aborted', abort)
    event.node.res.off('close', disconnect)
    // Shutdown can interrupt this request's runtime. Instrumentation must neither
    // resurrect its owner nor replace the original response/cancellation.
    try { telemetry.record(operation, (performance.now() - started) / 1_000, failed) } catch { /* Best-effort telemetry. */ }
  }
}
