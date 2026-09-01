import { getScaffoldSession } from '#server/utils/scaffold-sessions'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'sessionId')

  if (!sessionId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A scaffold session ID is required.',
    })
  }

  return await getScaffoldSession(event, sessionId)
})
