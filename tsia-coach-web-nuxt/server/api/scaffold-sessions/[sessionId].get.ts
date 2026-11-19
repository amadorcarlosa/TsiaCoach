import { Effect } from 'effect'
import { getScaffoldSessionEffect } from '#server/utils/scaffold-sessions'
import { routeParameter } from '#server/effect/input'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const sessionId = yield* routeParameter(event, 'sessionId', 'A scaffold session ID is required.')
  return yield* getScaffoldSessionEffect(event, sessionId)
})))
