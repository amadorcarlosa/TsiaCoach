import { Effect, Schema } from 'effect'
import { DecisionRequestSchema, postDecisionEffect } from '#server/utils/decisions'
import { requestBody } from '#server/effect/input'
import { httpError } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const input = yield* requestBody(event)
  if (!Schema.is(DecisionRequestSchema)(input)) {
    return yield* Effect.fail(httpError({ statusCode: 400, statusMessage: 'Provide a board state and decision instructions.' }))
  }
  return yield* postDecisionEffect(event, input)
})))
