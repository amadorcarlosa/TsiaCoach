import { checkAttempt } from '#server/utils/attempts'
import type { CheckAnswerRequest } from '#server/types/schema'

/**
 * POST /api/attempts/:attemptId/checks
 *
 * Checks a selected answer for an attempt.
 */
export default defineEventHandler(async (event) => {
  const attemptId = getRouterParam(event, 'attemptId')

  if (!attemptId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'An attempt ID is required.',
    })
  }

  const body = await readBody<unknown>(event)
  if (
    !body
    || typeof body !== 'object'
    || typeof (body as Partial<CheckAnswerRequest>).selectedAnswerId !== 'string'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A selected answer ID is required.',
    })
  }

  return await checkAttempt(event, attemptId, {
    selectedAnswerId: body.selectedAnswerId,
  })
})
