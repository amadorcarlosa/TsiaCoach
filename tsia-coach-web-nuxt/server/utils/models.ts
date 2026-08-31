import type { H3Event } from 'h3'
import type { components } from '#server/types/schema'

export type FoundryDeploymentResponse =
  components['schemas']['FoundryDeploymentResponse']

export async function getModels(
  event: H3Event,
): Promise<FoundryDeploymentResponse[]> {
  const { apiUrl } = useRuntimeConfig(event)

  if (!apiUrl) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'NUXT_API_URL is not configured. Start the application through Aspire.',
    })
  }

  return await $fetch<FoundryDeploymentResponse[]>('/api/models', {
    baseURL: apiUrl,
  })
}
