import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'

export type AgentRequest = components['schemas']['AgentRequest']
export type AgentResponse = components['schemas']['AgentResponse']
type ProblemDetails = components['schemas']['ProblemDetails']

export async function postAgentRequest(
  event: H3Event,
  agentRequest: AgentRequest
): Promise<AgentResponse> {
  const { apiUrl } = useRuntimeConfig(event)

  if (!apiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_API_URL is not configured. Start the application through Aspire.'
    })
  }

  let response

  try {
    response = await $fetch.raw<AgentResponse | ProblemDetails>('/api/agent', {
      baseURL: apiUrl,
      method: 'POST',
      body: agentRequest,
      ignoreResponseError: true
    })
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Could not reach the agent API.',
      cause: error
    })
  }

  if (response.status < 200 || response.status >= 300) {
    const problem = response._data as ProblemDetails | undefined

    throw createError({
      statusCode: response.status,
      statusMessage: problem?.title || 'Could not run the agent.',
      data: problem
    })
  }

  const payload = response._data as AgentResponse | undefined

  if (!payload || typeof payload.text !== 'string') {
    throw createError({
      statusCode: 502,
      statusMessage: 'The agent API returned an invalid response.'
    })
  }

  return payload
}
