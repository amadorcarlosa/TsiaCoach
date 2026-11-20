import { Effect, Schema } from 'effect'
import type { H3Event } from 'h3'
import {
  playgroundSessionResponseSchema,
  type PlaygroundEventBatch,
  type StartPlaygroundSession,
} from '#shared/effect/playground-events'
import { backendApiFor } from './backend'

/**
 * Browser-facing gate for the learner action log. Like the telemetry proxy it
 * is closed unless the feature is on, and only same-origin JSON gets through.
 */
export function playgroundEventPolicy(input: {
  enabled: boolean
  origin: string | undefined
  requestOrigin: string
  contentType: string | undefined
}): { status: 200 | 403 | 404 | 415 } {
  if (!input.enabled) return { status: 404 }
  if (input.origin !== input.requestOrigin) return { status: 403 }
  if (input.contentType?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return { status: 415 }
  return { status: 200 }
}

/**
 * Fixed-window event budget per session. Counters are bounded: the oldest
 * window is evicted first, so a flood of fresh session IDs cannot grow memory.
 */
export function createSessionRateLimiter(options: {
  limit: number
  windowMillis: number
  maxSessions: number
  now?: () => number
}) {
  const now = options.now ?? Date.now
  const windows = new Map<string, { started: number; used: number }>()
  return {
    take(sessionId: string, count: number): boolean {
      const time = now()
      let window = windows.get(sessionId)
      if (!window || time - window.started >= options.windowMillis) {
        windows.delete(sessionId)
        window = { started: time, used: 0 }
        if (windows.size >= options.maxSessions) {
          const oldest = windows.keys().next().value
          if (oldest !== undefined) windows.delete(oldest)
        }
        windows.set(sessionId, window)
      }
      if (window.used + count > options.limit) return false
      window.used += count
      return true
    },
  }
}

/** Generous for a learner (about ten actions a second), tight for a script. */
export const playgroundEventLimiter = createSessionRateLimiter({ limit: 600, windowMillis: 60_000, maxSessions: 10_000 })

/**
 * Session starts per client, so rotating sessions cannot dodge the event
 * budget. Forwarded addresses can be forged, so a global cap backs it up.
 */
export function createSessionStartLimiter(options: {
  perClient: number
  global: number
  windowMillis: number
  maxClients: number
  now?: () => number
}) {
  const clients = createSessionRateLimiter({ limit: options.perClient, windowMillis: options.windowMillis, maxSessions: options.maxClients, now: options.now })
  const all = createSessionRateLimiter({ limit: options.global, windowMillis: options.windowMillis, maxSessions: 1, now: options.now })
  return {
    /** Takes one start for `client`, or returns false when either budget is spent. */
    take: (client: string): boolean => clients.take(client, 1) && all.take('all', 1),
  }
}

/** Roomy enough for a classroom behind one address. */
export const playgroundSessionStartLimiter = createSessionStartLimiter({ perClient: 120, global: 1200, windowMillis: 60_000, maxClients: 10_000 })

export function startPlaygroundSessionEffect(event: H3Event, request: StartPlaygroundSession) {
  return backendApiFor(event).request({
    path: '/api/playground-sessions',
    method: 'POST',
    body: request,
    validate: Schema.is(playgroundSessionResponseSchema),
    connectionMessage: 'Could not reach the playground sessions API.',
    fallbackMessage: 'Could not start a playground session.',
    includeProblem: false,
  }).pipe(Effect.map(response => ({ sessionId: response.sessionId })), Effect.withSpan('PlaygroundSessions.start'))
}

/** Forwards once. The browser owns retries; event IDs keep them idempotent. */
export function appendPlaygroundEventsEffect(event: H3Event, batch: PlaygroundEventBatch) {
  return backendApiFor(event).request<unknown>({
    path: `/api/playground-sessions/${encodeURIComponent(batch.sessionId)}/events`,
    method: 'POST',
    body: batch,
    connectionMessage: 'Could not reach the playground sessions API.',
    fallbackMessage: 'Could not record playground events.',
    includeProblem: false,
  }).pipe(Effect.asVoid, Effect.withSpan('PlaygroundSessions.appendEvents'))
}
