import { Effect, Schema } from 'effect'
import { CheckAnswerRequestSchema, checkAttemptEffect } from '#server/utils/attempts'
import { requestBody, routeParameter } from '#server/effect/input'
import { httpError } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const attemptId = yield* routeParameter(event, 'attemptId', 'An attempt ID is required.')
  const body = yield* requestBody(event)
  if (!Schema.is(CheckAnswerRequestSchema)(body)) {
    return yield* Effect.fail(httpError({ statusCode: 400, statusMessage: 'A selected answer ID is required.' }))
  }
  return yield* checkAttemptEffect(event, attemptId, { selectedAnswerId: body.selectedAnswerId })
})))
