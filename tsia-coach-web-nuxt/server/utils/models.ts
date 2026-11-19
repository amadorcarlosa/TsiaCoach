import { Effect } from 'effect'
import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

export type FoundryDeploymentResponse = components['schemas']['FoundryDeploymentResponse']

export function getModelsEffect(event: H3Event) {
  return backendApiFor(event).request<FoundryDeploymentResponse[]>({
    path: '/api/models',
    connectionMessage: 'Could not reach the model API.',
    fallbackMessage: 'Could not load models.',
  }).pipe(Effect.withSpan('Models.list'))
}

export function getModels(event: H3Event): Promise<FoundryDeploymentResponse[]> {
  return runServerEffect(event, getModelsEffect(event))
}
