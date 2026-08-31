import type { AgentRequest } from '#server/utils/agent'
import { postAgentRequest } from '#server/utils/agent'

function isAgentRequest(value: unknown): value is AgentRequest {
  if (!value || typeof value !== 'object') {
    return false
  }

  const request = value as Partial<AgentRequest>

  return typeof request.model === 'string'
    && typeof request.instructions === 'string'
    && typeof request.prompt === 'string'
    && Array.isArray(request.history)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<unknown>(event)

  if (!isAgentRequest(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid agent request body.'
    })
  }

  return await postAgentRequest(event, body)
})
