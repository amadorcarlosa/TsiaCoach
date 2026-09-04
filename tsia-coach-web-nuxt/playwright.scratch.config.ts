import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: 'C:/Users/amado/AppData/Local/Temp/claude/C--Users-amado-code-TsiaCoach/45028f48-38b0-4426-95b1-750f0601740a/scratchpad/test-results',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: 'line',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'off' },
})
