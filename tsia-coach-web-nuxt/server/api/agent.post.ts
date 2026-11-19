import { Effect } from 'effect'
import { isAgentRequest, postAgentRequestEffect } from '#server/utils/agent'
import { requestBody } from '#server/effect/input'
import { httpError } from '#server/effect/errors'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const body = yield* requestBody(event)
  if (!isAgentRequest(body)) {
    return yield* Effect.fail(httpError({ statusCode: 400, statusMessage: 'Invalid agent request body.' }))
  }
  return yield* postAgentRequestEffect(event, body)
})))
