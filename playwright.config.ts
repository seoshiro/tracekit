import { defineConfig } from '@playwright/test';
const live = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 30000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: live || 'http://127.0.0.1:4183/tracekit/',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: live
    ? undefined
    : {
        command: 'npm run preview',
        url: 'http://127.0.0.1:4183/tracekit/',
        reuseExistingServer: false,
        timeout: 30000,
      },
});
