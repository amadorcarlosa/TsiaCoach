import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'
import type { PracticeItemPrompt } from '#shared/types/sample-items'

type ProblemDetails = components['schemas']['ProblemDetails']

function apiUrlFor(event: H3Event): string {
  const { apiUrl } = useRuntimeConfig(event)

  if (!apiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'NUXT_API_URL is not configured. Start the application through Aspire.',
    })
  }

  return apiUrl
}

async function forwardProblemAwareResponse<T>(
  request: () => Promise<{ status: number; _data: unknown }>,
  fallbackStatusMessage: string,
): Promise<T> {
  let response

  try {
    response = await request()
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not reach the practice item API.',
      cause: error,
    })
  }

  if (response.status < 200 || response.status >= 300) {
    const problem = response._data as ProblemDetails | undefined

    throw createError({
      statusCode: response.status,
      statusMessage: problem?.title || fallbackStatusMessage,
      data: problem,
    })
  }

  return response._data as T
}

export async function getPracticeItems(
  event: H3Event,
): Promise<PracticeItemPrompt[]> {
  return await forwardProblemAwareResponse(
    () => $fetch.raw<PracticeItemPrompt[]>(
      '/api/practice-items',
      {
        baseURL: apiUrlFor(event),
        method: 'GET',
        ignoreResponseError: true,
      },
    ),
    'Could not load practice items.',
  )
}

export async function getPracticeItemById(
  event: H3Event,
  id: string,
): Promise<PracticeItemPrompt> {
  return await forwardProblemAwareResponse(
    () => $fetch.raw<PracticeItemPrompt>(
      `/api/practice-items/${encodeURIComponent(id)}`,
      {
        baseURL: apiUrlFor(event),
        method: 'GET',
        ignoreResponseError: true,
      },
    ),
    'Could not load practice item.',
  )
}
