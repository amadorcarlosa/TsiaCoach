import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'
import type { AttemptProjection } from '#shared/types/sample-items'

type ProblemDetails = components['schemas']['ProblemDetails']
type StartAttemptRequest = components['schemas']['StartAttemptRequest']
type CheckAnswerRequest = components['schemas']['CheckAnswerRequest']

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
      statusMessage: 'Could not reach the attempts API.',
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

export async function startAttempt(
  event: H3Event,
  request: StartAttemptRequest,
): Promise<AttemptProjection> {
  const body: StartAttemptRequest = {
    practiceItemId: request.practiceItemId,
  }

  return await forwardProblemAwareResponse(
    () => $fetch.raw<AttemptProjection>(
      '/api/attempts',
      {
        baseURL: apiUrlFor(event),
        method: 'POST',
        body,
        ignoreResponseError: true,
      },
    ),
    'Could not start attempt.',
  )
}

export async function getAttempt(
  event: H3Event,
  attemptId: string,
): Promise<AttemptProjection> {
  return await forwardProblemAwareResponse(
    () => $fetch.raw<AttemptProjection>(
      `/api/attempts/${encodeURIComponent(attemptId)}`,
      {
        baseURL: apiUrlFor(event),
        method: 'GET',
        ignoreResponseError: true,
      },
    ),
    'Could not load attempt.',
  )
}

export async function checkAttempt(
  event: H3Event,
  attemptId: string,
  request: CheckAnswerRequest,
): Promise<AttemptProjection> {
  const body: CheckAnswerRequest = {
    selectedAnswerId: request.selectedAnswerId,
  }

  return await forwardProblemAwareResponse(
    () => $fetch.raw<AttemptProjection>(
      `/api/attempts/${encodeURIComponent(attemptId)}/checks`,
      {
        baseURL: apiUrlFor(event),
        method: 'POST',
        body,
        ignoreResponseError: true,
      },
    ),
    'Could not check selected answer.',
  )
}
