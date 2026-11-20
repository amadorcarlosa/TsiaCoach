import { Schema } from 'effect'
import { integer, nonnegativeInteger, schema } from './schema'

/**
 * Learner action log: committed playground actions, never pointer frames.
 * Product data, kept apart from tracing; `traceId` exists only to correlate.
 * Every field is allowlisted. Strings are identifier tokens, so a payload cannot
 * carry free text. `reason` is a rejection code (see `reasonCode`), never a sentence.
 */

export const playgrounds = [
  'bar-rod', 'array-rod', 'fraction-rod', 'math-tabla', 'systems',
  'rod-count-systems', 'base-ten', 'algebra-tiles', 'scaffold', 'rod-canvas',
] as const
export type PlaygroundName = typeof playgrounds[number]

const rodEventTypes = [
  'piece.created', 'piece.moved', 'piece.deleted', 'piece.duplicated',
  'rods.grouped', 'rods.ungrouped', 'regroup-ones', 'regroup-addends', 'regroup-factors',
  'regroup-area', 'make-rectangle', 'zero-pair.cancelled', 'rotated',
  'material-role.changed', 'board.transformed',
] as const
const systemsEventTypes = [
  ...rodEventTypes,
  'arrange.x-then-y', 'count.rod-added', 'count.rod-removed',
  'denomination.converted', 'system.correctness-evaluated',
  'conversion.started', 'conversion.cancelled', 'exchange.selected', 'hint.requested',
] as const

/** Event types each playground may emit. The envelope refuses any other pairing. */
export const playgroundEventTypes = {
  'bar-rod': rodEventTypes,
  'array-rod': rodEventTypes,
  'fraction-rod': rodEventTypes,
  'math-tabla': rodEventTypes,
  'rod-canvas': rodEventTypes,
  'systems': systemsEventTypes,
  'rod-count-systems': systemsEventTypes,
  'base-ten': [
    'block.placed', 'block.moved', 'block.deleted', 'block.rotated', 'block.duplicated',
    'exchange.regrouped',
  ],
  'algebra-tiles': [
    'tile.added', 'tile.moved', 'tile.rotated', 'tile.duplicated', 'tile.deleted',
    'tile.sign-flipped', 'zero-pair.cancelled',
  ],
  'scaffold': ['step.checked', 'step.advanced', 'coach.asked'],
} as const satisfies Record<PlaygroundName, readonly string[]>

export type PlaygroundEventType<P extends PlaygroundName = PlaygroundName> = typeof playgroundEventTypes[P][number]

export const MAX_EVENTS_PER_BATCH = 100
export const MAX_BATCH_BYTES = 256 * 1024
export const MAX_REASON_LENGTH = 64
const MAX_IDS = 100

/** Lowercase words joined by hyphens; no digits, spaces or punctuation. */
export const reasonCodePattern = /^[a-z](?:[a-z-]{0,62}[a-z])?$/

/**
 * Reduces authored rejection text to a code such as `select-exactly-n-x-rods`.
 * Numbers become `n`, so counts and names typed into a scene never leave the
 * browser, and the code is too constrained to carry instructions to the coach.
 */
export function reasonCode(text: string): string {
  const code = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\d+(?:[.,]\d+)*/g, ' n ')
    .replace(/[^a-z]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_REASON_LENGTH)
    .replace(/-+$/, '')
  return reasonCodePattern.test(code) ? code : 'rejected'
}

/** Identifier-shaped text only: no spaces, so no sentences. */
const token = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/))
const uuid = Schema.String.check(Schema.isPattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i))
/** Server-issued and opaque. */
export const sessionIdSchema = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{8,64}$/))
const isoTimestamp = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,7})?Z$/),
)
const traceId = Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/))
const tokens = Schema.Array(token).check(Schema.isMaxLength(MAX_IDS))
const point = Schema.Struct({ x: integer, y: integer })

/** One allowlist for every event type; each type fills the fields that apply to it. */
export const playgroundEventDataSchema = Schema.Struct({
  pieceIds: Schema.optionalKey(tokens),
  createdIds: Schema.optionalKey(tokens),
  /** Piece descriptions such as `rod-3`, `x`, `ten`. */
  pieceKinds: Schema.optionalKey(tokens),
  delta: Schema.optionalKey(point),
  value: Schema.optionalKey(integer),
  values: Schema.optionalKey(Schema.Array(integer).check(Schema.isMaxLength(MAX_IDS))),
  count: Schema.optionalKey(nonnegativeInteger),
  variant: Schema.optionalKey(token),
  term: Schema.optionalKey(token),
  sign: Schema.optionalKey(Schema.Literals(['positive', 'negative'])),
  denomination: Schema.optionalKey(token),
  pose: Schema.optionalKey(token),
  orientation: Schema.optionalKey(token),
  materialRole: Schema.optionalKey(token),
  shape: Schema.optionalKey(Schema.Struct({ width: nonnegativeInteger, depth: nonnegativeInteger })),
  satisfied: Schema.optionalKey(Schema.Boolean),
  /** A scaffold step, for scaffold events. */
  stepId: Schema.optionalKey(token),
  /** A length in characters; the text itself is never recorded. */
  length: Schema.optionalKey(nonnegativeInteger),
})
export type PlaygroundEventData = typeof playgroundEventDataSchema.Type

/** Small derived state, such as rods by value or tile totals. Never the scene. */
export const sceneSummarySchema = Schema.Record(token, integer).check(Schema.isMaxProperties(40))
export type SceneSummary = typeof sceneSummarySchema.Type

const envelope = Schema.Struct({
  id: uuid,
  sessionId: sessionIdSchema,
  playground: Schema.Literals(playgrounds),
  seq: nonnegativeInteger,
  at: isoTimestamp,
  traceId: Schema.optionalKey(traceId),
  type: token,
  outcome: Schema.Literals(['applied', 'rejected']),
  reason: Schema.optionalKey(Schema.String.check(Schema.isPattern(reasonCodePattern))),
  data: playgroundEventDataSchema,
  sceneSummary: Schema.optionalKey(sceneSummarySchema),
})

export const playgroundEventSchema = envelope.check(Schema.makeFilter<typeof envelope.Type>(event =>
  (playgroundEventTypes[event.playground] as readonly string[]).includes(event.type)
    || `${event.playground} does not record ${event.type} events.`))
export type PlaygroundEvent = typeof playgroundEventSchema.Type

const batch = Schema.Struct({
  sessionId: sessionIdSchema,
  events: Schema.Array(playgroundEventSchema).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_EVENTS_PER_BATCH)),
})

/** One session per request; every event must belong to it. */
export const playgroundEventBatchSchema = batch.check(Schema.makeFilter<typeof batch.Type>(value =>
  value.events.every(event => event.sessionId === value.sessionId)
    || 'Every event must belong to the batch session.'))
export type PlaygroundEventBatch = typeof playgroundEventBatchSchema.Type

export const playgroundEventBatch = schema(playgroundEventBatchSchema, { strict: true })

const link = Schema.optionalKey(Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_.:-]{1,128}$/)))

/** Opens a session; the links tie it to learner state the API already owns. */
export const startPlaygroundSessionSchema = Schema.Struct({
  playground: Schema.Literals(playgrounds),
  attemptId: link,
  scaffoldSessionId: link,
  levelId: link,
  /** Present when the learner opted in; absent when the deployment does not ask. */
  consent: Schema.optionalKey(Schema.Literal('granted')),
})
export type StartPlaygroundSession = typeof startPlaygroundSessionSchema.Type
export const startPlaygroundSession = schema(startPlaygroundSessionSchema, { strict: true })

export const playgroundSessionResponseSchema = Schema.Struct({ sessionId: sessionIdSchema })
