import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL
if (!baseURL) {
  throw new Error('Set PLAYWRIGHT_BASE_URL to the web-nuxt endpoint discovered with aspire describe. This configuration never starts servers.')
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'effect-aspire.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  outputDir: '../output/effect-aspire',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    reducedMotion: 'reduce',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
