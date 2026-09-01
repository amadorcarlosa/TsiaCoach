import { getPracticeItemById } from '#server/utils/practice-items'

/**
 * GET /api/practice-items/:id
 *
 * Returns a single practice item for the coaching flow.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A practice item ID is required.',
    })
  }

  return await getPracticeItemById(event, id)
})
