import { Effect } from 'effect'
import { getPracticeItemByIdEffect } from '#server/utils/practice-items'
import { routeParameter } from '#server/effect/input'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const id = yield* routeParameter(event, 'id', 'A practice item ID is required.')
  return yield* getPracticeItemByIdEffect(event, id)
})))
