import { defineConfig, devices } from '@playwright/test';

/**
 * Control rápido de producción, SOLO LECTURA: abre páginas públicas sin
 * iniciar sesión, no crea cuentas ni pedidos. Corre después de cada despliegue
 * o una vez al día (.github/workflows/pruebas.yml).
 *
 *   npm run e2e:produccion
 */
export default defineConfig({
  testDir: './produccion',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 1,
  reporter: 'list',
  outputDir: '../e2e-resultados',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env['URL_PRODUCCION'] ?? 'https://mirror-zona-green.vercel.app',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
