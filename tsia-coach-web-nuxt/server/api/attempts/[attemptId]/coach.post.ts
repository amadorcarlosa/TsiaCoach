import { Effect } from 'effect'
import { coachAttemptEffect, parseCoachTurnRequest } from '#server/utils/coaching'
import { parseInput, requestBody, routeParameter } from '#server/effect/input'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const attemptId = yield* routeParameter(event, 'attemptId', 'An attempt ID is required.')
  const body = yield* requestBody(event)
  const request = yield* parseInput(body, parseCoachTurnRequest)
  return yield* coachAttemptEffect(event, attemptId, request)
})))
