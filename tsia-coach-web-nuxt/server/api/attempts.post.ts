import { Effect, Schema } from 'effect'
import { StartAttemptRequestSchema, startAttemptEffect } from '#server/utils/attempts'
import { requestBody } from '#server/effect/input'
import { httpError } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const body = yield* requestBody(event)
  if (!Schema.is(StartAttemptRequestSchema)(body)) {
    return yield* Effect.fail(httpError({ statusCode: 400, statusMessage: 'A practice item ID is required.' }))
  }
  return yield* startAttemptEffect(event, { practiceItemId: body.practiceItemId })
})))
