import type { components } from '~~/server/types/schema'

export type AgentTurnRequest = components['schemas']['AgentRequest']
export type AgentTurnResult = components['schemas']['AgentResponse']
export type TurnDto = components['schemas']['TurnDto']

export type UserTurn = {
  id: string
  kind: 'user'
  text: string
}

export type AssistantTurn = {
  id: string
  kind: 'assistant'
  text: string
  model: string
  inputTokens: number | string
  outputTokens: number | string
}

export type ErrorTurn = {
  id: string
  kind: 'error'
  text: string
}

export type ChatTurn = UserTurn | AssistantTurn | ErrorTurn

type FetchFailure = {
  status?: number
  statusCode?: number
  statusMessage?: string
  message?: string
  data?: unknown
}

export class AgentRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'AgentRequestError'
    this.status = status
  }
}

function textFromPayload(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const payload = value as Record<string, unknown>

  if (typeof payload.detail === 'string' && payload.detail) {
    return payload.detail
  }

  if (typeof payload.statusMessage === 'string' && payload.statusMessage) {
    return payload.statusMessage
  }

  if (typeof payload.message === 'string' && payload.message) {
    return payload.message
  }

  return textFromPayload(payload.data)
}

function describeFailure(error: unknown): AgentRequestError {
  const failure = error as FetchFailure
  const status = failure.statusCode ?? failure.status ?? 0
  const detail = textFromPayload(failure.data)
    ?? failure.statusMessage
    ?? failure.message
    ?? 'Agent request failed.'

  return new AgentRequestError(
    status ? `Agent request failed (${status}): ${detail}` : detail,
    status
  )
}

export function toHistory(turns: ChatTurn[]): TurnDto[] {
  return turns.flatMap<TurnDto>((turn) => {
    if (turn.kind === 'error') {
      return []
    }

    if (turn.kind === 'assistant') {
      return [{
        role: 'assistant',
        model: turn.model,
        message: turn.text
      }]
    }

    return [{
      role: 'user',
      message: turn.text
    }]
  })
}

export async function requestAgentTurn(
  request: AgentTurnRequest
): Promise<AgentTurnResult> {
  try {
    const response = await $fetch<AgentTurnResult>('/api/agent', {
      method: 'POST',
      body: request
    })

    if (typeof response.text !== 'string') {
      throw new AgentRequestError(
        'Agent response did not include any text.',
        0
      )
    }

    return response
  } catch (error) {
    if (error instanceof AgentRequestError) {
      throw error
    }

    throw describeFailure(error)
  }
}
