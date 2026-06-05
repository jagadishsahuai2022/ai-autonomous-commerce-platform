import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  timeout: 120000, // 2 min per test - Next.js dev compile can take ~20s on first hit
  globalSetup: './e2e/global-setup.ts',
  reporter: [['html', { open: 'never' }], ['line']],
  use: {
    // Use IPv4 explicitly - on Windows, 'localhost' resolves to ::1 (IPv6)
    // which has connectivity issues with Docker Desktop port-forwarding in Chromium
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 30000,
    navigationTimeout: 90000,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
