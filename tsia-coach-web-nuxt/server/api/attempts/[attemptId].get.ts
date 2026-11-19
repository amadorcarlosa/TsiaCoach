import { Effect } from 'effect'
import { getAttemptEffect } from '#server/utils/attempts'
import { routeParameter } from '#server/effect/input'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const attemptId = yield* routeParameter(event, 'attemptId', 'An attempt ID is required.')
  return yield* getAttemptEffect(event, attemptId)
})))
