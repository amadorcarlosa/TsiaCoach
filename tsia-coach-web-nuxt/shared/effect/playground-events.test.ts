import { describe, expect, it } from 'vitest'
import { MAX_EVENTS_PER_BATCH, playgroundEventBatch, startPlaygroundSession } from './playground-events'

const sessionId = 'session_0123456789'
const event = (overrides: Record<string, unknown> = {}) => ({
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  sessionId,
  playground: 'algebra-tiles',
  seq: 0,
  at: '2026-11-19T12:00:00.000Z',
  type: 'tile.added',
  outcome: 'applied',
  data: { term: 'x', sign: 'positive', createdIds: ['algebra-tile-1'] },
  sceneSummary: { x: 1, tiles: 1 },
  ...overrides,
})
const batch = (...events: unknown[]) => ({ sessionId, events })

describe('playground event schema', () => {
  it('accepts an allowlisted event', () => {
    expect(playgroundEventBatch.safeParse(batch(event())).success).toBe(true)
    expect(playgroundEventBatch.safeParse(batch(event({ outcome: 'rejected', reason: 'No room for this tile.' }))).success).toBe(true)
  })

  it('refuses unknown fields at every level', () => {
    expect(playgroundEventBatch.safeParse({ ...batch(event()), learner: 'Ana' }).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ email: 'a@b.c' }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ data: { note: 'free text' } }))).success).toBe(false)
  })

  it('refuses free text in identifier fields', () => {
    expect(playgroundEventBatch.safeParse(batch(event({ data: { term: 'my name is Ana' } }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ data: { pieceIds: ['a b'] } }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ sceneSummary: { 'has spaces': 1 } }))).success).toBe(false)
  })

  it('bounds rejection reasons', () => {
    expect(playgroundEventBatch.safeParse(batch(event({ outcome: 'rejected', reason: 'x'.repeat(201) }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ outcome: 'rejected', reason: '' }))).success).toBe(false)
  })

  it('pairs each event type with its playground', () => {
    expect(playgroundEventBatch.safeParse(batch(event({ type: 'block.placed' }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ playground: 'base-ten', type: 'block.placed', data: {} }))).success).toBe(true)
  })

  it('keeps a batch to one session and a bounded size', () => {
    expect(playgroundEventBatch.safeParse(batch(event({ sessionId: 'another_session_1' }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch()).success).toBe(false)
    const many = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, (_, seq) => event({ seq }))
    expect(playgroundEventBatch.safeParse(batch(...many)).success).toBe(false)
  })

  it('validates identity, order and time formats', () => {
    expect(playgroundEventBatch.safeParse(batch(event({ id: 'not-a-uuid' }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ seq: -1 }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ at: 'yesterday' }))).success).toBe(false)
    expect(playgroundEventBatch.safeParse(batch(event({ traceId: 'abc' }))).success).toBe(false)
  })

  it('opens sessions only for known playgrounds with well-formed links', () => {
    expect(startPlaygroundSession.safeParse({ playground: 'base-ten', attemptId: 'attempt-1' }).success).toBe(true)
    expect(startPlaygroundSession.safeParse({ playground: 'chess' }).success).toBe(false)
    expect(startPlaygroundSession.safeParse({ playground: 'base-ten', attemptId: 'has spaces' }).success).toBe(false)
    expect(startPlaygroundSession.safeParse({ playground: 'base-ten', userId: 'u1' }).success).toBe(false)
  })
})
