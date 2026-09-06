import { defineConfig, devices } from '@playwright/test'

// Separate outputs and ports keep tests independent of the IDE's running API.
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['grid-3d.spec.ts', 'grid-2d.spec.ts'],
  outputDir: './output/playwright/grid-3d',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:3115' },
  webServer: [{
    command: 'dotnet build ../TsiaCoach.WebApi/TsiaCoach.WebApi.csproj --no-restore -o ../artifacts/grid-test-api && dotnet ../artifacts/grid-test-api/TsiaCoach.WebApi.dll --urls http://127.0.0.1:5158',
    url: 'http://127.0.0.1:5158/api/rods',
    env: { ASPNETCORE_ENVIRONMENT: 'Development', endpoint: 'https://example.openai.azure.com', foundryResource: 'example' },
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  }, {
    command: 'pnpm dev --host 127.0.0.1 --port 3115',
    url: 'http://127.0.0.1:3115/dev/grid-3d',
    env: { NUXT_API_URL: 'http://127.0.0.1:5158' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  }],
})
