import { defineConfig, devices } from '@playwright/test';
import { E2E_ENV, ORIGIN, PORT } from './tests/e2e/env';


export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1, // the specs share one seeded database
  reporter: [['list']],
  use: { baseURL: ORIGIN, serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    // API-only security specs need no second viewport
    { name: 'iphone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }, testIgnore: /security\.spec|upload-api\.spec|upload\.spec/ },
  ],
  webServer: {
    // the real production server, as deployed — not `next dev`
    command: `node .next/standalone/server.js`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { ENABLE_DEV_PAGES: '1', PORT: String(PORT), HOSTNAME: '127.0.0.1', ...E2E_ENV },
    timeout: 120_000,
  },
});
