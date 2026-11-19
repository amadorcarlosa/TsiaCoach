import { Effect } from 'effect'
import { getSampleItemByIdEffect } from '#server/utils/sample-items'
import { routeParameter } from '#server/effect/input'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const id = yield* routeParameter(event, 'id', 'A sample item ID is required.')
  return yield* getSampleItemByIdEffect(event, id)
})))
