import { getPracticeItems } from '#server/utils/practice-items'

/**
 * GET /api/practice-items
 *
 * Returns all practice items for the coaching flow.
 */
export default defineEventHandler(async (event) => {
  return await getPracticeItems(event)
})
