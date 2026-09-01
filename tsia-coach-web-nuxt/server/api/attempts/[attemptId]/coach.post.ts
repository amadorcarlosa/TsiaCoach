import { coachAttempt, parseCoachTurnRequest } from '#server/utils/coaching'

/**
 * POST /api/attempts/:attemptId/coach
 *
 * Requests one server-validated coaching move for an attempt.
 * The browser supplies only the coaching event; everything else
 * (phase, diagnosis, history, model configuration) stays server-side.
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
  const request = parseCoachTurnRequest(body)

  return await coachAttempt(event, attemptId, request)
})
