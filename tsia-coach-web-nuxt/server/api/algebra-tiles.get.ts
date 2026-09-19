import type { AlgebraTileDefinitionResponse } from '#shared/types/algebra-tiles'

export default defineEventHandler(async (event) => {
  const { apiUrl } = useRuntimeConfig(event)
  if (!apiUrl) throw createError({
    statusCode: 503,
    statusMessage: 'Configure NUXT_API_URL to load the domain algebra tile catalog.',
  })
  return await $fetch<AlgebraTileDefinitionResponse[]>('/api/algebra-tiles', { baseURL: apiUrl })
})
