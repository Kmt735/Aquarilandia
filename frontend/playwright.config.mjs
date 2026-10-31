import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './testes/e2e', testMatch: '**/*.spec.mjs', workers: 1,
  timeout: 30000, expect: { timeout: 10000 },
  reporter: [['list']], outputDir: 'test-results',
  use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
})
