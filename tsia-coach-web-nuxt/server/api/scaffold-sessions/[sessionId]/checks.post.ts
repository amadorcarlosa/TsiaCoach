import { ZodError } from 'zod'
import {
  checkScaffoldSession,
  parseScaffoldSubmission,
} from '#server/utils/scaffold-sessions'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A scaffold session ID is required.',
    })
  }

  try {
    const submission = parseScaffoldSubmission(await readBody<unknown>(event))
    return await checkScaffoldSession(event, sessionId, submission)
  }
  catch (error) {
    if (error instanceof ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'The scaffold response is malformed.',
      })
    }

    throw error
  }
})
