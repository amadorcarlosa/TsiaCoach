import type { H3Event } from 'h3'
import { z } from 'zod'
import type { components } from '#server/types/schema'
import type {
  CoachTurnRequest,
  CoachTurnResponse,
} from '#shared/types/coaching'

type ProblemDetails = components['schemas']['ProblemDetails']

const MAX_PROBE_ANSWER_LENGTH = 500

const coachTurnRequest = z.object({
  event: z.enum(['helpRequested', 'probeAnswered', 'diagnosisRequested', 'explainCorrect']),
  answer: z.string().trim().min(1).max(MAX_PROBE_ANSWER_LENGTH).optional(),
}).strict().refine(
  request => request.event === 'probeAnswered'
    ? request.answer !== undefined
    : request.answer === undefined,
  { message: 'An answer is required for probeAnswered and not allowed otherwise.' },
)

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

export function parseCoachTurnRequest(body: unknown): CoachTurnRequest {
  const parsed = coachTurnRequest.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'A valid coaching event is required.',
    })
  }

  return parsed.data
}

export async function coachAttempt(
  event: H3Event,
  attemptId: string,
  request: CoachTurnRequest,
): Promise<CoachTurnResponse> {
  const body: CoachTurnRequest = request.event === 'probeAnswered'
    ? { event: request.event, answer: request.answer }
    : { event: request.event }

  let response

  try {
    response = await $fetch.raw<CoachTurnResponse>(
      `/api/attempts/${encodeURIComponent(attemptId)}/coach`,
      {
        baseURL: apiUrlFor(event),
        method: 'POST',
        body,
        ignoreResponseError: true,
      },
    )
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Coaching is temporarily unavailable.',
      cause: error,
    })
  }

  if (response.status < 200 || response.status >= 300) {
    const problem = response._data as ProblemDetails | undefined

    throw createError({
      statusCode: response.status,
      statusMessage: safeCoachingStatusMessage(response.status, problem),
    })
  }

  return response._data as CoachTurnResponse
}

function safeCoachingStatusMessage(
  status: number,
  problem: ProblemDetails | undefined,
): string {
  switch (status) {
    case 400:
      return 'The coaching request was not valid.'
    case 404:
      return 'Attempt not found.'
    case 409:
      return problem?.title
        || 'Coaching is not available in the current attempt phase.'
    case 429:
      return 'The coach is busy. Try again in a moment.'
    case 499:
      return 'The coaching request was cancelled.'
    default:
      return 'Coaching is temporarily unavailable.'
  }
}
