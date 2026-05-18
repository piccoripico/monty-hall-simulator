import { defineConfig } from '@playwright/test';

const port = 4174;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true
  },
  webServer: {
    command: 'node ./scripts/serve-dist.mjs',
    port,
    reuseExistingServer: !process.env.CI
  }
});

