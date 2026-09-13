
import type {BaseTenBlockDefinitionResponse} from "#shared/types/base-ten-blocks.ts";

export default defineEventHandler(async  (event )=>{
    
    const{apiUrl}=useRuntimeConfig(event)
    if(!apiUrl)throw createError({ 
        statusCode: 503, 
        statusMessage: 'Configure NUXT_API_URL to load the domain base block catalog.' 
    })
    return await $fetch<BaseTenBlockDefinitionResponse[]>(`/api/base-ten-blocks`, { baseURL: apiUrl })
})
