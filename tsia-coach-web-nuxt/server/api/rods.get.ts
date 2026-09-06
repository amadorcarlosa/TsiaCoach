import type { RodDefinitionResponse } from '#shared/types/rods'
export default defineEventHandler(async (event) => {
  const { apiUrl } = useRuntimeConfig(event)
  if (!apiUrl) throw createError({ statusCode: 503, statusMessage: 'Configure NUXT_API_URL to load the domain rod catalog.' })
  return await $fetch<RodDefinitionResponse[]>('/api/rods', { baseURL: apiUrl })
})
