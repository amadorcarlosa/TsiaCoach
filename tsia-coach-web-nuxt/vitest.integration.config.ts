import { defineConfig } from 'vitest/config'
import { existsSync } from 'node:fs'
import { loadEnvFile } from 'node:process'
import unitConfig from './vitest.config.ts'

if (existsSync('.env')) loadEnvFile('.env')

export default defineConfig({
  ...unitConfig,
  test: {
    ...unitConfig.test,
    include: [
      'app/components/rod/**/*.integration.test.ts',
      'app/components/basetenblocks/**/*.integration.test.ts',
      'app/components/algebratiles/**/*.integration.test.ts',
    ],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    hookTimeout: 10_000,
  },
})
