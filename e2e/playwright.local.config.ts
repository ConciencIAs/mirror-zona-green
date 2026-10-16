import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de funcionamiento contra el Supabase LOCAL (Docker). Las mismas que
 * corren en GitHub Actions en cada PR (.github/workflows/pruebas.yml).
 *
 *   npx supabase start
 *   bash supabase/pruebas/preparar-base-local.sh      (solo con una base vacía)
 *   npm run e2e
 *
 * Una sola tarea a la vez: todas comparten la misma base y los límites de
 * inicio de sesión de Supabase Auth.
 */
export default defineConfig({
  testDir: './local',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI']
    ? [['list'], ['html', { open: 'never', outputFolder: '../e2e-informe' }]]
    : 'list',
  outputDir: '../e2e-resultados',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4202',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx ng serve --configuration local --port 4202',
    cwd: '..',
    url: 'http://localhost:4202',
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
