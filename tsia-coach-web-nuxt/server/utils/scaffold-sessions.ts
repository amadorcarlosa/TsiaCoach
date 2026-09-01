import type { H3Event } from 'h3'
import { z } from 'zod'
import type { components } from '#server/types/schema'
import type {
  ScaffoldSession,
  ScaffoldStepSubmission,
} from '#shared/types/scaffolds'

type ProblemDetails = components['schemas']['ProblemDetails']

const fitClassification = z.enum(['flush', 'oneUnitLeftover'])
const integerDomain = z.enum(['integers', 'oddIntegers', 'evenIntegers'])

const quantityReference = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('semanticQuantity'),
    semanticEntityId: z.string().trim().min(1),
  }).strict(),
  z.object({
    type: z.literal('latentExpression'),
    latentMathId: z.string().trim().min(1),
  }).strict(),
])

const scaffoldSubmission = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('matchEquivalentLength'),
    unitRodCount: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    type: z.literal('classifyByFit'),
    classifications: z.array(z.object({
      length: z.number().int().positive(),
      classification: fitClassification,
    }).strict()),
  }).strict(),
  z.object({
    type: z.literal('nameFitClassification'),
    domain: integerDomain,
  }).strict(),
  z.object({
    type: z.literal('traverseAllGaps'),
    traversals: z.array(z.object({
      from: z.number().int().positive(),
      to: z.number().int().positive(),
      resourceId: z.string().trim().min(1),
    }).strict()),
  }).strict(),
  z.object({
    type: z.literal('joinQuantities'),
    parts: z.array(quantityReference),
  }).strict(),
  z.object({
    type: z.literal('enterScalar'),
    value: z.number().finite(),
  }).strict(),
  z.object({
    type: z.literal('buildExpression'),
    mathObjectId: z.string().trim().min(1),
  }).strict(),
  z.object({
    type: z.literal('selectAnswerChoice'),
    answerChoiceId: z.string().trim().min(1),
  }).strict(),
])

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

async function forwardSessionResponse(
  request: () => Promise<{ status: number, _data?: unknown }>,
  fallbackStatusMessage: string,
): Promise<ScaffoldSession> {
  let response

  try {
    response = await request()
  }
  catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not reach the scaffold-session API.',
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

  return response._data as ScaffoldSession
}

export function parseScaffoldSubmission(body: unknown): ScaffoldStepSubmission {
  return scaffoldSubmission.parse(body) as ScaffoldStepSubmission
}

export async function startScaffoldSession(
  event: H3Event,
  attemptId: string,
): Promise<ScaffoldSession> {
  return await forwardSessionResponse(
    () => $fetch.raw<ScaffoldSession>(
      `/api/attempts/${encodeURIComponent(attemptId)}/scaffold-sessions`,
      {
        baseURL: apiUrlFor(event),
        method: 'POST',
        ignoreResponseError: true,
      },
    ),
    'This attempt is not authorized to open a scaffold.',
  )
}

export async function getScaffoldSession(
  event: H3Event,
  sessionId: string,
): Promise<ScaffoldSession> {
  return await forwardSessionResponse(
    () => $fetch.raw<ScaffoldSession>(
      `/api/scaffold-sessions/${encodeURIComponent(sessionId)}`,
      {
        baseURL: apiUrlFor(event),
        method: 'GET',
        ignoreResponseError: true,
      },
    ),
    'Could not load the scaffold session.',
  )
}

export async function checkScaffoldSession(
  event: H3Event,
  sessionId: string,
  submission: ScaffoldStepSubmission,
): Promise<ScaffoldSession> {
  return await forwardSessionResponse(
    () => $fetch.raw<ScaffoldSession>(
      `/api/scaffold-sessions/${encodeURIComponent(sessionId)}/checks`,
      {
        baseURL: apiUrlFor(event),
        method: 'POST',
        body: submission,
        ignoreResponseError: true,
      },
    ),
    'Could not check the scaffold response.',
  )
}
