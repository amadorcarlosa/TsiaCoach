import type { H3Event } from 'h3'
import type { SampleItem } from '#shared/types/sample-items'



export async function getSampleItems(
    event: H3Event,
): Promise<SampleItem[]> {
    const { apiUrl } = useRuntimeConfig(event)

    if (!apiUrl) {
        throw createError({
            statusCode: 500,
            statusMessage:
                'NUXT_API_URL is not configured. Start the application through Aspire.',
        })
    }

    return await $fetch<SampleItem[]>('/api/sample-questions', {
        baseURL: apiUrl,
    })
}

export async function getSampleItemById(
    event: H3Event,
    id: string,
): Promise<SampleItem> {
    const { apiUrl } = useRuntimeConfig(event)

    if (!apiUrl) {
        throw createError({
            statusCode: 500,
            statusMessage:
                'NUXT_API_URL is not configured. Start the application through Aspire.',
        })
    }

    return await $fetch<SampleItem>(
        `/api/sample-questions/${encodeURIComponent(id)}`,
        {
            baseURL: apiUrl,
        },
    )
}