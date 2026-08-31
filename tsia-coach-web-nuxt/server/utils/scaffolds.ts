import type { H3Event } from 'h3'
import type { Scaffold } from '#shared/types/scaffolds'

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

export async function getScaffolds(event: H3Event): Promise<Scaffold[]> {
  return await $fetch<Scaffold[]>('/api/scaffolds', {
    baseURL: apiUrlFor(event),
  })
}

export async function getScaffoldById(
  event: H3Event,
  id: string,
): Promise<Scaffold> {
  return await $fetch<Scaffold>(
    `/api/scaffolds/${encodeURIComponent(id)}`,
    { baseURL: apiUrlFor(event) },
  )
}
