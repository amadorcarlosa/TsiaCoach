import { getPracticeItemsEffect } from '#server/utils/practice-items'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, getPracticeItemsEffect(event)))
