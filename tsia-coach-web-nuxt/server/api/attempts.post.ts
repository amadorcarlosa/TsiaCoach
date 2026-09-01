import type { StartAttemptRequest } from '#server/types/schema'
import { startAttempt } from '#server/utils/attempts'

/**
 * POST /api/attempts
 *
 * Starts an attempt session for a practice item.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)

  if (
    !body
    || typeof body !== 'object'
    || typeof (body as Partial<StartAttemptRequest>).practiceItemId !== 'string'
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A practice item ID is required.',
    })
  }

  return await startAttempt(event, { practiceItemId: body.practiceItemId })
})
