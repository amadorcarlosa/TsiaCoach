import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['base-ten-playground.spec.ts', 'playground-editing.spec.ts'],
  workers: 1,
  outputDir: './output/playwright/base-ten',
  use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, baseURL: 'http://127.0.0.1:3123', hasTouch: true, reducedMotion: 'reduce', contextOptions: { reducedMotion: 'reduce', hasTouch: true }, screenshot: 'only-on-failure' },
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 3123',
    url: 'http://127.0.0.1:3123/dev/playground',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
