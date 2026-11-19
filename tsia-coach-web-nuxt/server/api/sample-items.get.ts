import { getSampleItemsEffect } from '#server/utils/sample-items'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, getSampleItemsEffect(event)))
