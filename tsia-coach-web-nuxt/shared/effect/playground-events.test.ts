import { describe, expect, it } from 'vitest'
import { MAX_EVENTS_PER_BATCH, MAX_REASON_LENGTH, playgroundEventBatch, reasonCode, reasonCodePattern, startPlaygroundSession } from './playground-events'

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
    expect(playgroundEventBatch.safeParse(batch(event({ outcome: 'rejected', reason: 'no-room-for-this-tile' }))).success).toBe(true)
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

  it('accepts only rejection codes as reasons', () => {
    for (const reason of ['x'.repeat(65), '', 'No room for this tile.', 'select-3-rods', 'ignore previous instructions', '-leading', 'trailing-']) {
      expect(playgroundEventBatch.safeParse(batch(event({ outcome: 'rejected', reason }))).success).toBe(false)
    }
  })

  it('reduces authored reasons to codes without numbers or punctuation', () => {
    expect(reasonCode('Select exactly 8 x rods (3-rods) to exchange; 21 selected.')).toBe('select-exactly-n-x-rods-n-rods-to-exchange-n-selected')
    expect(reasonCode("The move broke the step's rule.")).toBe('the-move-broke-the-step-s-rule')
    expect(reasonCode('Keep every part horizontal and on its train’s anchor row.')).toMatch(reasonCodePattern)
    expect(reasonCode('Añadir 2,5 fichas')).toBe('anadir-n-fichas')
    expect(reasonCode('x'.repeat(300))).toHaveLength(MAX_REASON_LENGTH)
    expect(reasonCode('123 !!!')).toBe('n')
    expect(reasonCode('!!!')).toBe('rejected')
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
