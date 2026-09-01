import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'dotnet run --project ../TsiaCoach.WebApi/TsiaCoach.WebApi.csproj --no-build --urls http://127.0.0.1:5145',
      url: 'http://127.0.0.1:5145/health',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        endpoint: 'https://example.openai.azure.com',
        foundryResource: 'example',
      },
    },
    {
      command: 'pnpm dev --host 127.0.0.1 --port 3000',
      url: 'http://127.0.0.1:3000/sample-Items',
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NUXT_API_URL: 'http://127.0.0.1:5145',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
