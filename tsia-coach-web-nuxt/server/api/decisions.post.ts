import type { JevResult } from '#shared/jev'

export default defineEventHandler(async (event) => {
  const input = await readBody(event)
  if (!input || typeof input.instructions !== 'string' || !input.state || typeof input.state !== 'object' || Array.isArray(input.state)) {
    throw createError({ statusCode: 400, statusMessage: 'Provide a board state and decision instructions.' })
  }
  const { apiUrl } = useRuntimeConfig(event)
  if (!apiUrl) throw createError({ statusCode: 503, statusMessage: 'Start through Aspire to connect the decision API.' })
  try {
    const response = await $fetch.raw<JevResult & { title?: string }>('/api/decisions', {
      baseURL: apiUrl, method: 'POST', body: { state: input.state, instructions: input.instructions }, ignoreResponseError: true, timeout: 35000,
    })
    if (response.status >= 400) throw createError({ statusCode: response.status, statusMessage: response._data?.title ?? 'Jev request failed.' })
    return response._data
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 502, statusMessage: 'Could not reach the decision API.' })
  }
})
