// modules/api-types.ts
import { defineNuxtModule } from '@nuxt/kit'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'

export default defineNuxtModule({
    meta: { name: 'api-types' },

    setup(_options, nuxt) {
        nuxt.hook('build:before', () => {
            const apiUrl = process.env.NUXT_API_URL ?? process.env.API_URL

            if (!apiUrl) {
                console.warn('[api-types] no API url, using committed schema.d.ts')
                return
            }

            try {
                mkdirSync('server/types', { recursive: true })
                execSync(
                    `pnpm exec openapi-typescript ${apiUrl}/openapi/v1.json -o server/types/schema.d.ts`,
                    { stdio: 'inherit' },
                )
            } catch {
                console.warn('[api-types] generation failed, using committed schema.d.ts')
            }
        })
    },
})