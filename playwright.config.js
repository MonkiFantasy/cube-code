import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    browserName: 'chromium',
    channel: undefined,
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || '/usr/bin/chromium',
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ]
});
