import { defineConfig } from '@playwright/test';

// Report requests made by the extension's service worker too, so the
// network-silence test can see them.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';

export default defineConfig({
  testDir: 'test/e2e',
  globalSetup: './test/e2e/support/global-setup.js',
  // Each test launches its own Chromium with the extension, so they can run in parallel.
  fullyParallel: true,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [['list']],
  webServer: {
    command: 'node test/server.js',
    url: 'http://localhost:3000/health',
    reuseExistingServer: !process.env.CI,
  },
});
