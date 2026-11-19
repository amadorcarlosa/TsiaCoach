import { Effect } from 'effect'
import { getScaffoldByIdEffect } from '#server/utils/scaffolds'
import { routeParameter } from '#server/effect/input'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, Effect.gen(function* () {
  const id = yield* routeParameter(event, 'id', 'A scaffold ID is required.')
  return yield* getScaffoldByIdEffect(event, id)
})))
