import { defineConfig } from '@playwright/test'

const external = process.env.PLAYGROUND_URL
const baseURL = external ?? 'http://127.0.0.1:3117'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['playground-editing.spec.ts', 'fraction-authoring.spec.ts'],
  outputDir: './output/playwright/playground',
  workers: 1,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    contextOptions: { reducedMotion: 'reduce' },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: external ? undefined : {
    command: 'pnpm dev --host 127.0.0.1 --port 3117',
    url: `${baseURL}/dev/playground`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
