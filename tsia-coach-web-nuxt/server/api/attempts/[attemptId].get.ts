import { getAttempt } from '#server/utils/attempts'

/**
 * GET /api/attempts/:attemptId
 *
 * Returns the latest projection for an attempt.
 */
export default defineEventHandler(async (event) => {
  const attemptId = getRouterParam(event, 'attemptId')

  if (!attemptId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'An attempt ID is required.',
    })
  }

  return await getAttempt(event, attemptId)
})
