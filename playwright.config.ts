import { defineConfig, devices } from '@playwright/test';

// Tests de bout en bout contre un faux Supabase (e2e/mock-supabase.mjs).
// Prérequis : un build fait avec les variables E2E_ENV ci-dessous
// (`pnpm test:e2e` s'en charge). Un seul worker : le faux Supabase a un
// état partagé, remis à zéro avant chaque test.
const MOCK = 'http://127.0.0.1:54321';
export const E2E_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: MOCK,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'e2e-service',
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
  NEXT_PUBLIC_WHATSAPP_NUMBER: '221770000000',
  NEXT_TELEMETRY_DISABLED: '1',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL: 'http://localhost:3100',
    locale: 'fr-FR',
    timezoneId: 'Africa/Dakar',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'unitaires', testMatch: /.*\.unit\.spec\.ts/ },
    { name: 'mobile', testMatch: /.*\.e2e\.spec\.ts/, use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'node e2e/mock-supabase.mjs', url: `${MOCK}/__log`, reuseExistingServer: !process.env.CI },
    {
      command: 'pnpm start -p 3100',
      url: 'http://localhost:3100',
      reuseExistingServer: !process.env.CI,
      env: E2E_ENV,
      timeout: 60_000,
    },
  ],
});
