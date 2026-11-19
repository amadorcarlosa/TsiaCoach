import { getScaffoldsEffect } from '#server/utils/scaffolds'
import { runServerEffect } from '#server/effect/runtime'

export default defineEventHandler(event => runServerEffect(event, getScaffoldsEffect(event)))
