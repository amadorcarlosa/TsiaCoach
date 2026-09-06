import { defineConfig } from 'vitest/config'
import unitConfig from './vitest.config.ts'

export default defineConfig({
  ...unitConfig,
  test: {
    ...unitConfig.test,
    include: ['app/components/rod/*.integration.test.ts'],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    hookTimeout: 10_000,
  },
})
