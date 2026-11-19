import { Effect, Schema } from 'effect'
import type { H3Event } from 'h3'
import type { CoachTurnRequest, CoachTurnResponse } from '#shared/types/coaching'
import { backendApiFor } from '#server/effect/backend'
import { httpError, problemTitle } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

const text = Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(500))
export const CoachTurnRequestSchema = Schema.Union([
  Schema.Struct({ event: Schema.Literal('helpRequested') }),
  Schema.Struct({ event: Schema.Literal('probeAnswered'), answer: text }),
  Schema.Struct({ event: Schema.Literal('diagnosisRequested') }),
  Schema.Struct({ event: Schema.Literal('explainCorrect') }),
  Schema.Struct({
    event: Schema.Literal('stepQuestionAsked'),
    stepId: Schema.Trim.check(Schema.isMinLength(1)),
    question: text,
  }),
])

export function parseCoachTurnRequest(body: unknown): CoachTurnRequest {
  try {
    return Schema.decodeUnknownSync(CoachTurnRequestSchema, { onExcessProperty: 'error' })(body)
  } catch {
    throw httpError({ statusCode: 400, statusMessage: 'A valid coaching event is required.' })
  }
}

export function coachAttemptEffect(event: H3Event, attemptId: string, request: CoachTurnRequest) {
  const body: CoachTurnRequest = request.event === 'probeAnswered'
    ? { event: request.event, answer: request.answer }
    : request.event === 'stepQuestionAsked'
      ? { event: request.event, stepId: request.stepId, question: request.question }
      : { event: request.event }

  return backendApiFor(event).request<CoachTurnResponse>({
    path: `/api/attempts/${encodeURIComponent(attemptId)}/coach`,
    method: 'POST', body,
    connectionMessage: 'Coaching is temporarily unavailable.',
    fallbackMessage: 'Coaching is temporarily unavailable.',
    includeProblem: false,
    responseMessage: safeCoachingStatusMessage,
  }).pipe(Effect.withSpan('Coaching.turn'))
}

export function coachAttempt(event: H3Event, attemptId: string, request: CoachTurnRequest): Promise<CoachTurnResponse> {
  return runServerEffect(event, coachAttemptEffect(event, attemptId, request))
}

function safeCoachingStatusMessage(status: number, problem: unknown): string {
  switch (status) {
    case 400: return 'The coaching request was not valid.'
    case 404: return 'Attempt not found.'
    case 409: return problemTitle(problem) || 'Coaching is not available in the current attempt phase.'
    case 429: return 'The coach is busy. Try again in a moment.'
    case 499: return 'The coaching request was cancelled.'
    default: return 'Coaching is temporarily unavailable.'
  }
}
