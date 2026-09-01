import { startScaffoldSession } from '#server/utils/scaffold-sessions'

export default defineEventHandler(async (event) => {
  const attemptId = getRouterParam(event, 'attemptId')

  if (!attemptId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'An attempt ID is required.',
    })
  }

  return await startScaffoldSession(event, attemptId)
})
