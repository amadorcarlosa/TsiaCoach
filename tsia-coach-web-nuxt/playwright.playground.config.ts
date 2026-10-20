import { defineConfig } from '@playwright/test'

const external = process.env.PLAYGROUND_URL
const baseURL = external ?? 'http://127.0.0.1:3117'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['playground-editing.spec.ts', 'fraction-authoring.spec.ts', 'shared-authoring.spec.ts', 'mathtabla.spec.ts', 'level-goals.spec.ts', 'level-files.spec.ts'],
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
    // nuxt dev directly: `pnpm dev` first runs test:sync, whose contract tests
    // need API environment settings this browser-only suite does not provide.
    command: 'pnpm exec nuxt dev --host 127.0.0.1 --port 3117',
    url: `${baseURL}/dev/playground`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})


