import { Effect } from 'effect'
import { traceHeaders } from '#shared/effect/trace'
import { runBrowserEffect } from '~/effect/runtime'
import type { WorkflowContext, WorkflowFetch } from '~/effect/registry'

/** An interruptible same-origin transport, also backed by event-aware $fetch during SSR. */
export function workflowRequest<A>(
  context: Pick<WorkflowContext, 'fetch' | 'signal'>,
  url: string,
  options: Record<string, unknown> = {},
): Effect.Effect<A, unknown> {
  const method = String(options.method ?? 'GET')
  return Effect.tryPromise({
    try: signal => {
      const callerSignal = options.signal instanceof AbortSignal ? options.signal : undefined
      const headers = new Headers(options.headers as HeadersInit | undefined)
      for (const [key, value] of Object.entries(traceHeaders())) headers.set(key, value)
      const headerValues = Object.fromEntries(headers)
      return context.fetch<A>(url, {
        ...options,
        retry: 0,
        signal: AbortSignal.any([signal, context.signal, ...(callerSignal ? [callerSignal] : [])]),
        ...(Object.keys(headerValues).length ? { headers: headerValues } : {}),
      })
    },
    catch: error => error,
  }).pipe(Effect.withSpan(`HTTP ${method} ${url.replace(/\/(?:attempts|scaffold-sessions|practice-items)\/[^/]+/g, match => `${match.slice(0, match.lastIndexOf('/'))}/:id`)}`, {
    kind: 'client',
  }))
}

export const executeWorkflow = <A, E>(name: string, effect: Effect.Effect<A, E>) =>
  runBrowserEffect(effect, { name })

/** Stateless transport for component-local workflows that do not own Atom state. */
export function browserRequest<A>(
  url: string,
  options: Record<string, unknown> = {},
  fetch: WorkflowFetch = (path, request) => $fetch(path, request),
): Effect.Effect<A, unknown> {
  return workflowRequest<A>({
    fetch,
    signal: options.signal instanceof AbortSignal ? options.signal : new AbortController().signal,
  }, url, options)
}
