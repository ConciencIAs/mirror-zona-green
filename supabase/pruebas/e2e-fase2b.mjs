// Prueba E2E de la Fase 2b (árbol de referidos) contra el Supabase LOCAL.
// Requiere las migraciones 20261016140000 y 20261016140100 aplicadas en la
// base local y la app en http://localhost:4202 (ng serve --configuration local).
// Uso: node supabase/pruebas/e2e-fase2b.mjs [carpeta-capturas]
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
const s = String(t).slice(-5);
const password = 'Prueba-12345';
const creados = [];
async function crear(nombre, codigo, { admin = false } = {}) {
  const correo = `prueba.f2b.${nombre.toLowerCase()}.${t}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: `${nombre} ${s}`, telefono: celularUnico(), documento: '12345678', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá', ...(codigo ? { referido_por: codigo } : {}) } }),
  });
  const id = (await r.json()).id;
  creados.push(correo);
  sql(`update auth.users set email_confirmed_at = now() where id = '${id}';
       update public.perfiles set status = 'activo'${admin ? ", rol = 'admin'" : ''} where id = '${id}';`);
  await espera(1100);
  return { id, correo, nombre: `${nombre} ${s}` };
}

// Red de prueba: Ana → Beto → Caro, y Dani con un código que ya no existe.
const ana = await crear('Ana');
sql(`update public.perfiles set codigo_invitacion = 'ANA${s}' where id = '${ana.id}'`);
const beto = await crear('Beto', `ana${s}`); // en minúsculas: igual se resuelve
sql(`update public.perfiles set codigo_invitacion = 'BETO${s}' where id = '${beto.id}'`);
const caro = await crear('Caro', `BETO${s}`);
const dani = await crear('Dani', 'REVOCADO1');
const admin = await crear('Admin', null, { admin: true });

const browser = await chromium.launch();
async function contexto({ dark = false, mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((d) => {
    localStorage.setItem('zg_user_say_to_be_legal_age', 'true');
    localStorage.setItem('zg-dark', String(d));
  }, dark);
  return ctx;
}
async function entrar(page, correo) {
  await page.goto(`${APP}/auth/login`);
  await page.locator('input[placeholder="correo@ejemplo.com"]').fill(correo);
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill(password);
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
const pestana = (page, nombre) => page.getByRole('tab', { name: new RegExp(`^${nombre}`) }).click();

// ── 1. Panel de usuarios ───────────────────────────────────────────────────
console.log('\n== Panel de usuarios ==');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await entrar(page, admin.correo);
  await page.goto(`${APP}/admin`, { waitUntil: 'domcontentloaded' });
  const filaBeto = page.locator('tr', { hasText: beto.correo });
  await filaBeto.waitFor({ timeout: 10000 }).catch(() => {});
  paso('Beto aparece referido por Ana (relación guardada, código en minúsculas)', (await filaBeto.getByText(ana.nombre).count()) > 0);
  paso('Dani aparece como "No resuelto"', (await page.locator('tr', { hasText: dani.correo }).getByText('No resuelto').count()) > 0);
  await page.getByRole('link', { name: /Ver árbol de referidos/ }).click();
  paso('el enlace lleva al árbol', await page.waitForURL(/\/admin\/customer\/referidos/, { timeout: 8000 }).then(() => true, () => false));
  await ctx.close();
}

// ── 2. Árbol, ranking y no resueltos ───────────────────────────────────────
console.log('\n== Árbol de referidos ==');
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, admin.correo);
  await page.goto(`${APP}/admin/customer/referidos`, { waitUntil: 'domcontentloaded' });
  const nodoCaro = page.locator('li', { hasText: caro.correo });
  await nodoCaro.waitFor({ timeout: 10000 }).catch(() => {});
  if (!v.dark && !v.mobile) {
    const sangria = async (p) => parseInt(await page.locator('li', { hasText: p.correo }).first().evaluate((el) => el.style.paddingLeft), 10);
    const [ia, ib, ic] = [await sangria(ana), await sangria(beto), await sangria(caro)];
    paso('árbol: Ana → Beto → Caro en tres niveles', ia < ib && ib < ic, `sangrías ${ia}/${ib}/${ic}px`);
    const y = async (p) => (await page.locator('li', { hasText: p.correo }).first().boundingBox())?.y ?? -1;
    const [ya, yb, yc] = [await y(ana), await y(beto), await y(caro)];
    paso('  → en orden (Ana arriba de Beto, Beto arriba de Caro)', ya >= 0 && ya < yb && yb < yc, `${Math.round(ya)} < ${Math.round(yb)} < ${Math.round(yc)}`);
  }
  await capturar(page, '18-admin-arbol-referidos', v, page.getByText(ana.correo));

  await pestana(page, 'Ranking');
  const filaAna = page.locator('tr', { hasText: ana.correo });
  await filaAna.waitFor({ timeout: 5000 }).catch(() => {});
  if (!v.dark && !v.mobile) {
    const celdas = await filaAna.locator('td').allInnerTexts();
    paso('ranking: Ana con 1 directo y 2 en su red', celdas[2]?.trim() === '1' && celdas[3]?.trim() === '2', celdas.slice(2, 5).join(' / '));
  }
  await capturar(page, '19-admin-ranking-referidos', v, filaAna);

  await pestana(page, 'No resueltos');
  const tarjetaDani = page.locator('div.rounded-2xl', { hasText: dani.correo });
  await tarjetaDani.first().waitFor({ timeout: 5000 }).catch(() => {});
  await capturar(page, '20-admin-referidos-no-resueltos', v, tarjetaDani);
  if (!v.dark && !v.mobile) {
    paso('no resueltos: Dani con el código que usó', (await tarjetaDani.getByText('REVOCADO1').count()) > 0);
    await tarjetaDani.locator('p-select').click();
    await page.locator('.p-select-filter').fill(ana.nombre);
    await page.getByRole('option', { name: new RegExp(ana.correo.replace(/\./g, '\\.')) }).click();
    await tarjetaDani.getByPlaceholder(/Nota/).fill('Confirmado por WhatsApp (prueba)');
    await tarjetaDani.getByRole('button', { name: 'Asignar' }).click();
    paso('asignar a mano: guarda y avisa', await page.getByText('Referente asignado').first().waitFor({ timeout: 8000 }).then(() => true, () => false));
    const rel = sql(`select concat_ws(' | ', referente_id, estado, nota) from public.referidos where referido_id = '${dani.id}'`);
    paso('  → en la base: Dani referida por Ana, "asignado_manual", con la nota', rel === `${ana.id} | asignado_manual | Confirmado por WhatsApp (prueba)`, rel);
    await pestana(page, 'Árbol');
    const marca = page.locator('li', { hasText: dani.correo }).getByText('Asignado a mano');
    paso('  → en el árbol aparece bajo Ana como "Asignado a mano"', await marca.first().waitFor({ timeout: 8000 }).then(() => true, () => false));
  }
  await ctx.close();
}

// ── 3. Mi cuenta: solo el número ───────────────────────────────────────────
console.log('\n== Mi cuenta ==');
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, ana.correo);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  const conteo = page.getByText('personas se registraron con tu código');
  const visto = await conteo.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  if (!v.dark && !v.mobile) {
    paso('Ana ve "2 personas se registraron con tu código" (Beto y Dani)', visto && (await page.getByText('2 personas se registraron con tu código').count()) > 0);
    paso('  → sin nombres de sus referidos', (await page.getByText(beto.nombre).count()) === 0);
  }
  await capturar(page, '21-cuenta-conteo-referidos', v, conteo);
  await ctx.close();
}
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await entrar(page, caro.correo);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Mi Código de Referido').first().waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  paso('quien no tiene código no ve el conteo', (await page.getByText('con tu código').count()) === 0);
  await ctx.close();
}

// ── 4. Menú ────────────────────────────────────────────────────────────────
console.log('\n== Menú ==');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await entrar(page, admin.correo);
  await page.waitForTimeout(1500);
  await page.locator('header button:has(.pi-bars), header button[aria-label*="enú"]').last().click({ timeout: 5000 }).catch(() => {});
  const link = page.getByText('Árbol de referidos').first();
  paso('menú de admin: "Árbol de referidos"', await link.waitFor({ timeout: 8000 }).then(() => true, () => false));
  await ctx.close();
}

await browser.close();
console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
