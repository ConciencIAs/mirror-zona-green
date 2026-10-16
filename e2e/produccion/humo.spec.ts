// Prueba 10 — Control rápido de PRODUCCIÓN, solo lectura: no inicia sesión, no
// crea cuentas, no escribe nada. Detecta en minutos un despliegue roto o un
// permiso abierto por error.
import { expect, test, type Page } from '@playwright/test';

// Valores públicos (están en el código del sitio): URL y clave publicable.
const SUPABASE = process.env['SUPABASE_URL_PRODUCCION'] ?? 'https://rvxxszdtocnhmdsrfkoi.supabase.co';
const CLAVE_PUBLICA = process.env['SUPABASE_CLAVE_PUBLICA'] ?? 'sb_publishable_jQAIJF1SMsm_HWFbn3M7oQ_0TtPB6tT';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('zg_user_say_to_be_legal_age', 'true'));
});

/** Abre una ruta y separa los errores reales de los avisos de la CSP (modo observación). */
async function abrir(page: Page, ruta: string) {
  const errores: string[] = [];
  const avisosCsp: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/Content Security Policy|\[Report Only\]/i.test(m.text())) avisosCsp.push(m.text());
    else errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
  const respuesta = await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  return { respuesta, errores, avisosCsp };
}

test('la portada carga sin errores de JavaScript', async ({ page }, info) => {
  const { respuesta, errores, avisosCsp } = await abrir(page, '/');
  expect(respuesta?.status()).toBe(200);
  await expect(page.locator('header')).toBeVisible();
  expect(errores, errores.join('\n')).toEqual([]);
  // Los avisos de la CSP no fallan la prueba: se adjuntan para revisarlos antes de activarla.
  if (avisosCsp.length) info.annotations.push({ type: 'avisos CSP', description: [...new Set(avisosCsp)].join('\n') });
});

test('encabezados de seguridad presentes', async ({ request }) => {
  const r = await request.get('/');
  const h = r.headers();
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('SAMEORIGIN');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['content-security-policy-report-only'] ?? h['content-security-policy']).toContain("default-src 'self'");
  expect(h['strict-transport-security']).toBeTruthy();
});

test('Tailwind del CDN con versión fija e integridad, aceptado por el navegador', async ({ page, request }) => {
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/@tailwindcss\/browser@\d+\.\d+\.\d+\/dist\/index\.global\.js"\s+integrity="sha384-[A-Za-z0-9+/=]+"/);
  const { errores } = await abrir(page, '/');
  expect(errores.filter((e) => /integrity|digest/i.test(e))).toEqual([]);
  const genera = await page.evaluate(() => [...document.querySelectorAll('style')].some((s) => s.textContent?.includes('tailwindcss')));
  expect(genera).toBe(true);
});

test('login y registro cargan con sus campos', async ({ page }) => {
  await abrir(page, '/auth/login');
  await expect(page.locator('input[placeholder="correo@ejemplo.com"]')).toBeVisible();
  await expect(page.locator('input[placeholder="Ingresa tu contraseña"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await abrir(page, '/auth/register');
  await expect(page.getByText('Debes ser mayor de 18 años.')).toBeVisible();
  await expect(page.locator('form button[type="submit"]').first()).toBeVisible();
});

test('las páginas privadas piden iniciar sesión', async ({ page }) => {
  for (const ruta of ['/seleccion', '/customer/perfil', '/admin', '/lab']) {
    await abrir(page, ruta);
    await expect(page, `ruta ${ruta}`).toHaveURL(/\/auth\/login/);
  }
});

test('la API pública no entrega datos privados', async ({ request }) => {
  const h = { apikey: CLAVE_PUBLICA, Authorization: `Bearer ${CLAVE_PUBLICA}` };
  const correos = await request.get(`${SUPABASE}/rest/v1/usuarios_publicos?select=correo&limit=1`, { headers: h });
  expect(await correos.json()).toEqual([]);
  const costo = await request.get(`${SUPABASE}/rest/v1/productos?select=costo&limit=1`, { headers: h });
  expect(costo.status()).toBeGreaterThanOrEqual(400);
  const perfiles = await request.get(`${SUPABASE}/rest/v1/perfiles?select=correo&limit=1`, { headers: h });
  expect(await perfiles.json()).toEqual([]);
  const checkout = await request.post(`${SUPABASE}/rest/v1/rpc/procesar_checkout`, { headers: h, data: {} });
  expect(checkout.status()).toBeGreaterThanOrEqual(400);
});
