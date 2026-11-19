import { Effect, Schema } from 'effect'
import type { H3Event } from 'h3'
import type { ScaffoldSession, ScaffoldStepSubmission } from '#shared/types/scaffolds'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

const positiveInteger = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0))
const nonnegativeInteger = Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
const identifier = Schema.Trim.check(Schema.isMinLength(1))
const quantityReference = Schema.Union([
  Schema.Struct({ type: Schema.Literal('semanticQuantity'), semanticEntityId: identifier }),
  Schema.Struct({ type: Schema.Literal('latentExpression'), latentMathId: identifier }),
])

export const ScaffoldSubmissionSchema = Schema.Union([
  Schema.Struct({ type: Schema.Literal('matchEquivalentLength'), unitRodCount: nonnegativeInteger }),
  Schema.Struct({
    type: Schema.Literal('classifyByFit'),
    classifications: Schema.Array(Schema.Struct({
      length: positiveInteger,
      classification: Schema.Literals(['flush', 'oneUnitLeftover']),
    })),
  }),
  Schema.Struct({ type: Schema.Literal('nameFitClassification'), domain: Schema.Literals(['integers', 'oddIntegers', 'evenIntegers']) }),
  Schema.Struct({
    type: Schema.Literal('traverseAllGaps'),
    traversals: Schema.Array(Schema.Struct({ from: positiveInteger, to: positiveInteger, resourceId: identifier })),
  }),
  Schema.Struct({ type: Schema.Literal('joinQuantities'), parts: Schema.Array(quantityReference) }),
  Schema.Struct({ type: Schema.Literal('enterScalar'), value: Schema.Number.check(Schema.isFinite()) }),
  Schema.Struct({ type: Schema.Literal('buildExpression'), mathObjectId: identifier }),
  Schema.Struct({ type: Schema.Literal('selectAnswerChoice'), answerChoiceId: identifier }),
  Schema.Struct({ type: Schema.Literal('placePieces'), pieces: Schema.Array(Schema.Struct({ length: positiveInteger, x: nonnegativeInteger, y: nonnegativeInteger })) }),
  Schema.Struct({ type: Schema.Literal('moveRows'), movedRows: Schema.Array(nonnegativeInteger) }),
  Schema.Struct({ type: Schema.Literal('selectRows'), rows: Schema.Array(nonnegativeInteger) }),
])

export function parseScaffoldSubmission(body: unknown): ScaffoldStepSubmission {
  return Schema.decodeUnknownSync(ScaffoldSubmissionSchema, { onExcessProperty: 'error' })(body) as ScaffoldStepSubmission
}

export function startScaffoldSessionEffect(event: H3Event, attemptId: string) {
  return backendApiFor(event).request<ScaffoldSession>({
    path: `/api/attempts/${encodeURIComponent(attemptId)}/scaffold-sessions`, method: 'POST',
    connectionMessage: 'Could not reach the scaffold-session API.',
    fallbackMessage: 'This attempt is not authorized to open a scaffold.',
  }).pipe(Effect.withSpan('ScaffoldSessions.start'))
}

export function getScaffoldSessionEffect(event: H3Event, sessionId: string) {
  return backendApiFor(event).request<ScaffoldSession>({
    path: `/api/scaffold-sessions/${encodeURIComponent(sessionId)}`,
    connectionMessage: 'Could not reach the scaffold-session API.',
    fallbackMessage: 'Could not load the scaffold session.',
  }).pipe(Effect.withSpan('ScaffoldSessions.get'))
}

export function checkScaffoldSessionEffect(event: H3Event, sessionId: string, submission: ScaffoldStepSubmission) {
  return backendApiFor(event).request<ScaffoldSession>({
    path: `/api/scaffold-sessions/${encodeURIComponent(sessionId)}/checks`, method: 'POST', body: submission,
    connectionMessage: 'Could not reach the scaffold-session API.',
    fallbackMessage: 'Could not check the scaffold response.',
  }).pipe(Effect.withSpan('ScaffoldSessions.check'))
}

export function startScaffoldSession(event: H3Event, attemptId: string): Promise<ScaffoldSession> {
  return runServerEffect(event, startScaffoldSessionEffect(event, attemptId))
}
export function getScaffoldSession(event: H3Event, sessionId: string): Promise<ScaffoldSession> {
  return runServerEffect(event, getScaffoldSessionEffect(event, sessionId))
}
export function checkScaffoldSession(event: H3Event, sessionId: string, submission: ScaffoldStepSubmission): Promise<ScaffoldSession> {
  return runServerEffect(event, checkScaffoldSessionEffect(event, sessionId, submission))
}
