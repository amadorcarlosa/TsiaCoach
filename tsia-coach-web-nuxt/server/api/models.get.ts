import { getModelsEffect } from '#server/utils/models'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, getModelsEffect(event)))
