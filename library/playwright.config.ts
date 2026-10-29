import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'iphone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    // the real production server, as deployed — not `next dev`
    command: `node .next/standalone/server.js`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { ENABLE_DEV_PAGES: '1', PORT: String(PORT), HOSTNAME: '127.0.0.1', DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://media:media@127.0.0.1:5432/media_test' },
    timeout: 120_000,
  },
});
