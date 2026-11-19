import { Effect } from 'effect'
import type { H3Event } from 'h3'
import type { RodDefinitionResponse } from '#shared/types/rods'
import type { AlgebraTileDefinitionResponse } from '#shared/types/algebra-tiles'
import type { BaseTenBlockDefinitionResponse } from '#shared/types/base-ten-blocks'
import { backendApiFor } from '#server/effect/backend'
import { runServerEffect } from '#server/effect/runtime'

function catalogEffect<T>(event: H3Event, path: string, name: string, missingMessage: string) {
  return backendApiFor(event).request<T[]>({
    path, missingStatus: 503, missingMessage,
    connectionMessage: `Could not reach the ${name} catalog API.`,
    fallbackMessage: `Could not load the ${name} catalog.`,
  }).pipe(Effect.withSpan(`Catalog.${name}`))
}

export function getRodCatalog(event: H3Event): Promise<RodDefinitionResponse[]> {
  return runServerEffect(event, catalogEffect<RodDefinitionResponse>(event, '/api/rods', 'rods',
    'Configure NUXT_API_URL to load the domain rod catalog.'))
}

export function getAlgebraTileCatalog(event: H3Event): Promise<AlgebraTileDefinitionResponse[]> {
  return runServerEffect(event, catalogEffect<AlgebraTileDefinitionResponse>(event, '/api/algebra-tiles', 'algebra-tiles',
    'Configure NUXT_API_URL to load the domain algebra tile catalog.'))
}

export function getBaseTenBlockCatalog(event: H3Event): Promise<BaseTenBlockDefinitionResponse[]> {
  return runServerEffect(event, catalogEffect<BaseTenBlockDefinitionResponse>(event, '/api/base-ten-blocks', 'base-ten-blocks',
    'Configure NUXT_API_URL to load the domain base block catalog.'))
}
