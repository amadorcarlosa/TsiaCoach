import { Effect, Schema } from 'effect'
import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

export type AgentRequest = components['schemas']['AgentRequest']
export type AgentResponse = components['schemas']['AgentResponse']

export const AgentRequestSchema = Schema.Struct({
  model: Schema.String,
  instructions: Schema.String,
  prompt: Schema.String,
  history: Schema.Array(Schema.Unknown),
})

export function isAgentRequest(value: unknown): value is AgentRequest {
  return Schema.is(AgentRequestSchema)(value)
}

export function postAgentRequestEffect(event: H3Event, agentRequest: AgentRequest) {
  return backendApiFor(event).request<AgentResponse>({
    path: '/api/agent', method: 'POST',
    body: { model: agentRequest.model, instructions: agentRequest.instructions, prompt: agentRequest.prompt, history: agentRequest.history },
    connectionMessage: 'Could not reach the agent API.',
    fallbackMessage: 'Could not run the agent.',
    validate: (body): body is AgentResponse => !!body && typeof body === 'object'
      && 'text' in body && typeof body.text === 'string',
    invalidResponseMessage: 'The agent API returned an invalid response.',
  }).pipe(Effect.withSpan('Agent.turn'))
}

export function postAgentRequest(event: H3Event, agentRequest: AgentRequest): Promise<AgentResponse> {
  return runServerEffect(event, postAgentRequestEffect(event, agentRequest))
}
