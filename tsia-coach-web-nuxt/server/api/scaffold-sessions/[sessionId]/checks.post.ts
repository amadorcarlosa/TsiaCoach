import { Effect, Schema } from 'effect'
import { checkScaffoldSessionEffect, parseScaffoldSubmission } from '#server/utils/scaffold-sessions'
import { requestBody, routeParameter } from '#server/effect/input'
import { httpError } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const sessionId = yield* routeParameter(event, 'sessionId', 'A scaffold session ID is required.')
  const body = yield* requestBody(event)
  const submission = yield* Effect.try({
    try: () => parseScaffoldSubmission(body),
    catch: error => Schema.isSchemaError(error)
      ? httpError({ statusCode: 400, statusMessage: 'The scaffold response is malformed.' })
      : error,
  })
  return yield* checkScaffoldSessionEffect(event, sessionId, submission)
})))
