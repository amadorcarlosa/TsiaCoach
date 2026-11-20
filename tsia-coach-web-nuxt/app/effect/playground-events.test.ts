import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { playgroundEventBatch, type PlaygroundEventBatch, type StartPlaygroundSession } from '#shared/effect/playground-events'
import {
  makePlaygroundEventLog,
  PlaygroundEventTransportError,
  type PlaygroundEventLog,
  type PlaygroundEventTransport,
} from './playground-events'

const wait = (millis: number) => new Promise(resolve => setTimeout(resolve, millis))
async function until(condition: () => boolean, timeout = 2000) {
  const started = Date.now()
  while (!condition()) {
    if (Date.now() - started > timeout) throw new Error('Timed out waiting for condition.')
    await wait(5)
  }
}

function fakeTransport(options: { failures?: PlaygroundEventTransportError[] } = {}) {
  const failures = [...(options.failures ?? [])]
  const sent: PlaygroundEventBatch[] = []
  const beacons: PlaygroundEventBatch[] = []
  const sessions: StartPlaygroundSession[] = []
  let attempts = 0
  const transport: PlaygroundEventTransport = {
    startSession: input => Effect.sync(() => {
      sessions.push(input)
      return `session_${sessions.length.toString().padStart(8, '0')}`
    }),
    send: batch => Effect.suspend(() => {
      attempts++
      const failure = failures.shift()
      if (failure) return Effect.fail(failure)
      sent.push(batch)
      return Effect.void
    }),
    beacon: batch => { beacons.push(batch); return true },
  }
  return { transport, sent, beacons, sessions, get attempts() { return attempts } }
}

const draft = (type = 'tile.added') => ({ type, outcome: 'applied' as const, data: { term: 'x' } })
let log: PlaygroundEventLog | undefined
afterEach(() => log?.dispose())

describe('playground event log', () => {
  it('sends a full batch without waiting for the timer', async () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 3, flushMillis: 60_000 })
    const recorder = log.recorder({ playground: 'algebra-tiles' })
    for (let index = 0; index < 3; index++) recorder.record(draft())

    await until(() => fake.sent.length === 1)
    expect(fake.sent[0]!.events.map(event => event.seq)).toEqual([0, 1, 2])
  })

  it('sends a partial batch when the timer runs out', async () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 25, flushMillis: 30 })
    log.recorder({ playground: 'base-ten' }).record(draft('block.placed'))

    await until(() => fake.sent.length === 1)
    expect(fake.sent[0]!.events).toHaveLength(1)
  })

  it('produces batches the server schema accepts', async () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 2, flushMillis: 20 })
    const recorder = log.recorder({ playground: 'algebra-tiles' })
    recorder.record(draft())
    recorder.record({ type: 'tile.moved', outcome: 'rejected', reason: 'Keep tiles inside the board without overlapping.', data: { delta: { x: 1, y: 0 } } })

    await until(() => fake.sent.length === 1)
    expect(playgroundEventBatch.safeParse(fake.sent[0]).success).toBe(true)
  })

  it('opens each session once and sends one request per session', async () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 4, flushMillis: 20 })
    const tiles = log.recorder({ playground: 'algebra-tiles' })
    const blocks = log.recorder({ playground: 'base-ten', attemptId: 'attempt-1' })
    tiles.record(draft())
    blocks.record(draft('block.placed'))
    tiles.record(draft())

    await until(() => fake.sent.length === 2)
    tiles.record(draft())
    await until(() => fake.sent.length === 3)
    expect(fake.sessions).toEqual([{ playground: 'algebra-tiles' }, { playground: 'base-ten', attemptId: 'attempt-1' }])
    expect(fake.sent.every(batch => batch.events.every(event => event.sessionId === batch.sessionId))).toBe(true)
    expect(fake.sent.find(batch => batch.events[0]!.playground === 'algebra-tiles')!.events.map(event => event.seq)).toEqual([0, 1])
  })

  it('retries transient failures and keeps the events', async () => {
    const fake = fakeTransport({ failures: [new PlaygroundEventTransportError({ transient: true, status: 503 })] })
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 1, flushMillis: 10, retryBaseMillis: 1 })
    log.recorder({ playground: 'algebra-tiles' }).record(draft())

    await until(() => fake.sent.length === 1)
    expect(fake.attempts).toBe(2)
  })

  it('drops a batch the server refuses instead of retrying it forever', async () => {
    const fake = fakeTransport({ failures: [new PlaygroundEventTransportError({ transient: false, status: 400 })] })
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 1, flushMillis: 10, retryBaseMillis: 1 })
    const recorder = log.recorder({ playground: 'algebra-tiles' })
    recorder.record(draft())
    await until(() => fake.attempts === 1)
    recorder.record(draft())

    await until(() => fake.sent.length === 1)
    expect(fake.attempts).toBe(2)
    expect(fake.sent[0]!.events[0]!.seq).toBe(1)
  })

  it('sends waiting events through the beacon when the page goes away', async () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 1, flushMillis: 10 })
    const recorder = log.recorder({ playground: 'algebra-tiles' })
    recorder.record(draft())
    await until(() => fake.sent.length === 1)

    const late = makePlaygroundEventLog({ transport: fake.transport, batchSize: 50, flushMillis: 60_000 })
    const lateRecorder = late.recorder({ playground: 'algebra-tiles' })
    lateRecorder.record(draft())
    await until(() => late.pendingCount === 1)
    // This session never opened, so the beacon has no session to name.
    late.flushBeacon()
    expect(fake.beacons).toHaveLength(0)
    late.dispose()

    recorder.record(draft())
    recorder.record(draft())
    log.flushBeacon()
    expect(fake.beacons.flatMap(batch => batch.events.map(event => event.seq))).toEqual([1, 2])
  })

  it('flush sends waiting events without waiting for the timer', async () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, batchSize: 25, flushMillis: 60_000 })
    const recorder = log.recorder({ playground: 'algebra-tiles' })
    recorder.record(draft())
    recorder.record(draft())

    await log.flush(2000)
    expect(fake.sent.flatMap(batch => batch.events.map(event => event.seq))).toEqual([0, 1])
    await expect(log.flush(10)).resolves.toBeUndefined()
  })

  it('never throws from record, even after disposal', () => {
    const fake = fakeTransport()
    log = makePlaygroundEventLog({ transport: fake.transport, id: () => { throw new Error('no crypto') } })
    const recorder = log.recorder({ playground: 'algebra-tiles' })
    expect(() => recorder.record(draft())).not.toThrow()
    log.dispose()
    expect(() => recorder.record(draft())).not.toThrow()
  })
})
