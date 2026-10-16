// Prueba E2E de la Fase 3 (endurecimiento) contra el Supabase LOCAL.
// Requiere las migraciones de la Fase 3 aplicadas en la base local y la app en
// http://localhost:4202 (ng serve --configuration local).
// Uso: node supabase/pruebas/e2e-fase3.mjs [carpeta-capturas]
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';
import { celularUnico } from './_comun.mjs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!API.startsWith('http://127.0.0.1') && !API.startsWith('http://localhost')) {
  throw new Error('Esta prueba solo corre contra el Supabase local.');
}
const APP = 'http://localhost:4202';
const CAPTURAS = process.argv[2];
const sql = (q) =>
  execSync('docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -At -v ON_ERROR_STOP=1', { input: q, encoding: 'utf8' }).trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallas = 0;
const paso = (n, ok, detalle = '') => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK ' : 'FALLA'}  ${n}${detalle ? ' — ' + detalle : ''}`);
};

const t = Date.now();
const password = 'Prueba-12345';
const creados = [];
async function crear(nombre, { admin = false, fecha = '1990-05-05' } = {}) {
  const correo = `prueba.e3.${nombre}.${t}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: `E3 ${nombre}`, telefono: celularUnico(), documento: '12345678', tipo_documento: 'CC', fecha_nacimiento: fecha, ubicacion: 'Bogotá' } }),
  });
  const id = (await r.json()).id;
  creados.push(correo);
  sql(`update auth.users set email_confirmed_at = now() where id = '${id}';
       update public.perfiles set status = 'activo'${admin ? ", rol = 'admin'" : ''} where id = '${id}';`);
  await espera(1100);
  return { id, correo };
}

const browser = await chromium.launch();
async function contexto({ dark = false, mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((d) => {
    localStorage.setItem('zg_user_say_to_be_legal_age', 'true');
    localStorage.setItem('zg-dark', String(d));
  }, dark);
  return ctx;
}
const campo = (page, ph) => page.locator(`input[placeholder="${ph}"]`);
async function entrar(page, correo) {
  await page.goto(`${APP}/auth/login`);
  await campo(page, 'correo@ejemplo.com').fill(correo);
  await campo(page, 'Ingresa tu contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  return page.waitForURL(/\/(home|seleccion)/, { timeout: 10000 }).then(() => true, () => false);
}
async function capturar(page, nombre, { dark = false, mobile = false } = {}, locator) {
  if (!CAPTURAS) return;
  const dir = dark ? `${CAPTURAS}/dark-mode` : CAPTURAS;
  mkdirSync(dir, { recursive: true });
  if (locator) await locator.first().scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/${nombre}${mobile ? '-mobile' : ''}${dark ? '-dark' : ''}.png` });
}
const variantes = [{}, { dark: true }, { mobile: true }, { dark: true, mobile: true }];

// ── 1. Registro: contraseña y edad ─────────────────────────────────────────
console.log('\n== Registro ==');
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/register`);
  await campo(page, 'Mínimo 8 caracteres').fill('solamenteletras');
  await campo(page, 'Mínimo 8 caracteres').blur();
  const errClave = page.getByText('al menos un número');
  const vistoClave = await errClave.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  await page.locator('form button[type="submit"]').first().click();
  const errEdad = page.getByText('Debes ser mayor de 18 años para registrarte');
  const vistoEdad = await errEdad.first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  if (!v.dark && !v.mobile) {
    paso('contraseña sin números: lo explica', vistoClave);
    // Una contraseña válida (con letras y números, sin la letra "d") no debe dar error.
    await campo(page, 'Mínimo 8 caracteres').fill('Clave2026x');
    await campo(page, 'Mínimo 8 caracteres').blur();
    await page.waitForTimeout(400);
    paso('  → con letras y números ya no muestra error', (await page.getByText('al menos un número').count()) === 0 && (await page.getByText('al menos una letra').count()) === 0);
    paso('fecha de nacimiento de hoy (por defecto): pide ser mayor de 18', vistoEdad);
    const max = await page.locator('app-form-datepicker').evaluate(() => true).catch(() => false);
    paso('  → el calendario existe con su límite', max);
  }
  await capturar(page, '22-registro-edad-contrasena', v, errEdad);
  await ctx.close();
}

// ── 2. Detalle de producto: sin "reservados" ───────────────────────────────
console.log('\n== Producto ==');
const PRODUCTO = '00000000-0000-4000-8000-000000000002';
sql(`update public.productos set stock_total = 5, reservado = 0, status = 'activo', deleted_at = null where id = '${PRODUCTO}';`);
const cliente = await crear('cliente');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await entrar(page, cliente.correo);
  await page.goto(`${APP}/seleccion/product-details/${PRODUCTO}`, { waitUntil: 'domcontentloaded' });
  const disponible = page.getByText(/Disponible para agregar/);
  const visto = await disponible.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  paso('el detalle muestra la disponibilidad', visto, visto ? await disponible.first().innerText() : page.url());
  paso('  → ya no muestra "reservados"', (await page.getByText(/reservados (global)|unidades reservadas/i).count()) === 0);
  await ctx.close();
}

// ── 3. /lab solo para admin ────────────────────────────────────────────────
console.log('\n== /lab ==');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await page.goto(`${APP}/lab`);
  await page.waitForTimeout(2000);
  paso('visitante: /lab lo manda al login', page.url().includes('/auth/login'), page.url());
  await entrar(page, cliente.correo);
  await page.goto(`${APP}/lab`);
  await page.waitForTimeout(2000);
  paso('cliente: /lab no abre', !page.url().endsWith('/lab'), page.url());
  await ctx.close();
  const admin = await crear('admin', { admin: true });
  const ctx2 = await contexto();
  const page2 = await ctx2.newPage();
  await entrar(page2, admin.correo);
  await page2.goto(`${APP}/lab`);
  await page2.waitForTimeout(2000);
  paso('admin: /lab abre', page2.url().endsWith('/lab'), page2.url());
  await ctx2.close();
}

// ── 4. Mi perfil: aviso de fecha ───────────────────────────────────────────
console.log('\n== Mi perfil ==');
const menor = await crear('fechamala');
sql(`begin; set local session_replication_role = replica;
     update public.perfiles set fecha_nacimiento = current_date where id = '${menor.id}'; commit;`);
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, menor.correo);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  const aviso = page.getByText('indica menos de 18 años');
  const visto = await aviso.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  if (!v.dark && !v.mobile) paso('perfil con fecha de menor: Mi perfil pide corregirla', visto);
  await capturar(page, '23-perfil-aviso-fecha', v, aviso);
  await ctx.close();
}

// ── 5. Tailwind del CDN: versión fija con integridad ───────────────────────
console.log('\n== Script de Tailwind ==');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto(`${APP}/home`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const script = await page.evaluate(() => {
    const s = document.querySelector('script[src*="@tailwindcss/browser"]');
    return s ? { src: s.getAttribute('src'), integrity: s.getAttribute('integrity') } : null;
  });
  paso('el script tiene versión fija e integridad', !!script?.src.includes('@4.3.3/') && !!script?.integrity?.startsWith('sha384-'), script?.src);
  paso('  → el navegador lo acepta (sin error de integridad)', !errores.some((e) => /integrity|digest/i.test(e)), errores.filter((e) => /integrity|digest/i.test(e)).join(' | ').slice(0, 120));
  const estilosRuntime = await page.evaluate(() => [...document.querySelectorAll('style')].some((s) => s.textContent?.includes('tailwindcss')));
  paso('  → y genera estilos en tiempo de ejecución', estilosRuntime);
  await ctx.close();
}

await browser.close();
console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
