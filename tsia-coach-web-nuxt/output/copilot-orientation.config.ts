import config from '../playwright.config'

export default {
  ...config,
  testDir: '../tests/e2e',
  outputDir: './copilot-orientation-validation',
  webServer: undefined,
  use: { ...config.use, baseURL: 'http://localhost:3000' },
}
