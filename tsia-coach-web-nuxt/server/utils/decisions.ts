import { Effect, Schema } from 'effect'
import type { H3Event } from 'h3'
import type { JevResult } from '#shared/jev'
import { backendApiFor } from '#server/effect/backend'
import { problemTitle } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

export const DecisionRequestSchema = Schema.Struct({
  instructions: Schema.String,
  state: Schema.Record(Schema.String, Schema.Unknown),
})
export type DecisionRequest = typeof DecisionRequestSchema.Type

export function postDecisionEffect(event: H3Event, request: DecisionRequest) {
  return backendApiFor(event).request<JevResult>({
    path: '/api/decisions', method: 'POST',
    body: { state: request.state, instructions: request.instructions },
    timeout: 35_000,
    missingStatus: 503,
    missingMessage: 'Start through Aspire to connect the decision API.',
    connectionMessage: 'Could not reach the decision API.',
    fallbackMessage: 'Jev request failed.',
    responseMessage: (_status, problem) => problemTitle(problem) ?? 'Jev request failed.',
    includeProblem: false,
  }).pipe(Effect.withSpan('Decisions.evaluate'))
}

export function postDecision(event: H3Event, request: DecisionRequest): Promise<JevResult> {
  return runServerEffect(event, postDecisionEffect(event, request))
}
