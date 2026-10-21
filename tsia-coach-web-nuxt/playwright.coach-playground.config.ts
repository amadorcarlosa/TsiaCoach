import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'coach-playground.spec.ts',
  workers: 1,
  reporter: 'list',
  outputDir: '../output/coach-playground-tests',
  use: { baseURL: 'http://127.0.0.1:3000', screenshot: 'only-on-failure' },
  webServer: {
    command: 'pnpm exec nuxt dev --host 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000/admin/chat',
    reuseExistingServer: true,
    timeout: 120000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
})
