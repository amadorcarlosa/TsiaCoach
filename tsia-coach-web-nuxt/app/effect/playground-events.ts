import { Data, Effect, Fiber, Queue, Schedule } from 'effect'
import { trace } from '@opentelemetry/api'
import {
  MAX_EVENTS_PER_BATCH,
  type PlaygroundEvent,
  type PlaygroundEventBatch,
  type PlaygroundEventData,
  type SceneSummary,
  type StartPlaygroundSession,
} from '#shared/effect/playground-events'
import { workflowFeature, type WorkflowContext } from './registry'

/** What a scene reports; the log adds identity, order, time and session. */
export type PlaygroundEventDraft = {
  type: string
  outcome: 'applied' | 'rejected'
  reason?: string
  data: PlaygroundEventData
  sceneSummary?: SceneSummary
}

export interface PlaygroundRecorder {
  readonly playground: StartPlaygroundSession['playground']
  /** Synchronous and infallible: logging never fails or delays the UI. */
  record(draft: PlaygroundEventDraft): void
}

export class PlaygroundEventTransportError extends Data.TaggedError('PlaygroundEventTransportError')<{
  /** Worth retrying: network failure, 408/425/429 or a server error. */
  readonly transient: boolean
  readonly status?: number
}> {}

export interface PlaygroundEventTransport {
  startSession(input: StartPlaygroundSession): Effect.Effect<string, PlaygroundEventTransportError>
  send(batch: PlaygroundEventBatch): Effect.Effect<void, PlaygroundEventTransportError>
  /** Best effort while the page goes away; there is no response to wait for. */
  beacon(batch: PlaygroundEventBatch): boolean
}

type Session = {
  readonly input: StartPlaygroundSession
  seq: number
  id?: string
}
type Unsent = Omit<PlaygroundEvent, 'sessionId'>
type Queued = { readonly session: Session; readonly event: Unsent }

export type PlaygroundEventLogOptions = {
  transport: PlaygroundEventTransport
  batchSize?: number
  flushMillis?: number
  /** Events beyond this wait-list are dropped, never buffered without bound. */
  maxQueued?: number
  retries?: number
  retryBaseMillis?: number
  now?: () => Date
  id?: () => string
  traceId?: () => string | undefined
}

export type PlaygroundEventLog = ReturnType<typeof makePlaygroundEventLog>

function activeTraceId(): string | undefined {
  const id = trace.getActiveSpan()?.spanContext().traceId
  return id && /^[0-9a-f]{32}$/.test(id) && !/^0+$/.test(id) ? id : undefined
}

/**
 * A queue drained by one fiber. Batches go out at `batchSize` events or after
 * `flushMillis`, whichever comes first, one request per session. Transient
 * failures retry with backoff and keep their events; refused batches drop.
 * Event IDs make every resend idempotent on the server.
 */
export function makePlaygroundEventLog(options: PlaygroundEventLogOptions) {
  const batchSize = Math.min(options.batchSize ?? 25, MAX_EVENTS_PER_BATCH)
  const flushMillis = options.flushMillis ?? 2000
  const tick = Math.max(1, Math.min(100, flushMillis))
  const now = options.now ?? (() => new Date())
  const newId = options.id ?? (() => crypto.randomUUID())
  const traceId = options.traceId ?? activeTraceId
  const queue = Effect.runSync(Queue.dropping<Queued>(options.maxQueued ?? 1000))
  // Taken from the queue but not yet delivered; the beacon can still send these.
  let pending: Queued[] = []
  let disposed = false
  // Set by flush(): stop waiting for a full batch and send now.
  let urgent = false

  const retryPolicy = {
    schedule: Schedule.exponential(`${options.retryBaseMillis ?? 250} millis`),
    times: options.retries ?? 3,
    while: (error: PlaygroundEventTransportError) => error.transient,
  }

  const ensureSession = (session: Session) => session.id
    ? Effect.succeed(session.id)
    : options.transport.startSession(session.input).pipe(
        Effect.retry(retryPolicy),
        Effect.tap(id => Effect.sync(() => { session.id = id })),
      )

  const settle = (items: readonly Queued[]) => {
    const done = new Set(items)
    pending = pending.filter(item => !done.has(item))
  }

  function groups(items: readonly Queued[]) {
    const bySession = new Map<Session, Queued[]>()
    for (const item of items) {
      const group = bySession.get(item.session) ?? []
      group.push(item)
      bySession.set(item.session, group)
    }
    return bySession
  }

  const deliver = (items: readonly Queued[]) => Effect.forEach([...groups(items)], ([session, group]) =>
    ensureSession(session).pipe(
      Effect.flatMap(sessionId => options.transport.send({
        sessionId,
        events: group.map(item => ({ ...item.event, sessionId })),
      }).pipe(Effect.retry(retryPolicy))),
      Effect.matchEffect({
        onSuccess: () => Effect.sync(() => settle(group)),
        // A refused session or batch will be refused again; keep only what may still land.
        onFailure: error => Effect.sync(() => { if (!error.transient) settle(group) }),
      }),
    ), { discard: true })

  const takeUpTo = (max: number) => Queue.takeBetween(queue, 0, max)

  const drain = Effect.gen(function* () {
    while (true) {
      if (!pending.length) pending.push(...(yield* Queue.takeBetween(queue, 1, batchSize)))
      const started = Date.now()
      while (!urgent && pending.length < batchSize && Date.now() - started < flushMillis) {
        yield* Effect.sleep(`${tick} millis`)
        pending.push(...(yield* takeUpTo(batchSize - pending.length)))
      }
      // One early send per flush request; a flush during delivery triggers the next send.
      urgent = false
      if (pending.length < batchSize) pending.push(...(yield* takeUpTo(batchSize - pending.length)))
      yield* deliver(pending.slice(0, batchSize))
    }
  })

  const fiber = Effect.runFork(drain)

  function recorder(input: StartPlaygroundSession): PlaygroundRecorder {
    const session: Session = { input: { ...input }, seq: 0 }
    return {
      playground: input.playground,
      record(draft) {
        if (disposed) return
        try {
          const trace = traceId()
          const event: Unsent = {
            id: newId(),
            playground: input.playground,
            seq: session.seq++,
            at: now().toISOString(),
            ...(trace ? { traceId: trace } : {}),
            type: draft.type,
            outcome: draft.outcome,
            ...(draft.reason ? { reason: draft.reason } : {}),
            data: draft.data,
            ...(draft.sceneSummary ? { sceneSummary: draft.sceneSummary } : {}),
          }
          Queue.offerUnsafe(queue, { session, event })
        } catch { /* The action log is never allowed to break a playground. */ }
      },
    }
  }

  /** Sends whatever is waiting through the beacon. Sessions not yet opened cannot be named, so their events drop. */
  function flushBeacon(): void {
    try {
      const waiting = [...pending, ...Effect.runSync(Queue.clear(queue))]
      pending = []
      for (const [session, group] of groups(waiting)) {
        const sessionId = session.id
        if (!sessionId) continue
        for (let start = 0; start < group.length; start += MAX_EVENTS_PER_BATCH) {
          options.transport.beacon({
            sessionId,
            events: group.slice(start, start + MAX_EVENTS_PER_BATCH).map(item => ({ ...item.event, sessionId })),
          })
        }
      }
    } catch { /* Best effort during unload. */ }
  }

  /**
   * Sends what is waiting now instead of at the next timer, and resolves once
   * it has gone or after `timeoutMillis`. Never rejects.
   */
  async function flush(timeoutMillis = 1000): Promise<void> {
    if (disposed) return
    const idle = () => !pending.length && Effect.runSync(Queue.size(queue)) === 0
    if (idle()) return
    urgent = true
    const started = Date.now()
    while (!idle() && !disposed && Date.now() - started < timeoutMillis) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }

  function dispose(): void {
    if (disposed) return
    flushBeacon()
    disposed = true
    Effect.runFork(Fiber.interrupt(fiber))
    Queue.shutdownUnsafe(queue)
  }

  return {
    recorder,
    flush,
    flushBeacon,
    dispose,
    /** For tests: events taken from the queue but not yet delivered. */
    get pendingCount() { return pending.length },
  }
}

const transient = (status: number) => status === 408 || status === 425 || status === 429 || status >= 500

function postJson(url: string, body: unknown) {
  return Effect.tryPromise({
    try: signal => fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    }),
    catch: () => new PlaygroundEventTransportError({ transient: true }),
  }).pipe(Effect.flatMap(response => response.ok
    ? Effect.succeed(response)
    : Effect.fail(new PlaygroundEventTransportError({ transient: transient(response.status), status: response.status }))))
}

/** Same-origin Nuxt routes; the Nuxt server forwards to the API. */
export const browserPlaygroundEventTransport: PlaygroundEventTransport = {
  startSession: input => postJson('/api/playground-sessions', input).pipe(
    Effect.flatMap(response => Effect.tryPromise({
      try: () => response.json() as Promise<{ sessionId?: unknown }>,
      catch: () => new PlaygroundEventTransportError({ transient: false }),
    })),
    Effect.flatMap(body => typeof body.sessionId === 'string'
      ? Effect.succeed(body.sessionId)
      : Effect.fail(new PlaygroundEventTransportError({ transient: false }))),
  ),
  send: batch => postJson('/api/playground-events', batch).pipe(Effect.asVoid),
  beacon: batch => {
    try {
      return navigator.sendBeacon('/api/playground-events', new Blob([JSON.stringify(batch)], { type: 'application/json' }))
    } catch { return false }
  },
}

/** One log per Nuxt app, disposed with its workflow context. Null when off or during SSR. */
export function playgroundEventLogFor(
  context: WorkflowContext,
  enabled: boolean,
  transport: PlaygroundEventTransport = browserPlaygroundEventTransport,
): PlaygroundEventLog | null {
  if (!enabled || import.meta.server || typeof window === 'undefined') return null
  return workflowFeature(context, 'playground-events', () => {
    const log = makePlaygroundEventLog({ transport })
    const hide = () => log.flushBeacon()
    window.addEventListener('pagehide', hide)
    context.cleanups.add(() => {
      window.removeEventListener('pagehide', hide)
      log.dispose()
    })
    return log
  })
}
