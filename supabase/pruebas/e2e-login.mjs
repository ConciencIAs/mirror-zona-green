// Prueba E2E del login en el navegador contra el Supabase LOCAL.
// Requiere: npx supabase start, node supabase/pruebas/generar-environment-local.mjs
//           npx ng serve --configuration local --port 4202
// Uso: node supabase/pruebas/e2e-login.mjs [carpeta-capturas]
import { execSync } from 'node:child_process';
import { celularUnico } from './_comun.mjs';
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!API.startsWith('http://127.0.0.1') && !API.startsWith('http://localhost')) {
  throw new Error('Esta prueba solo corre contra el Supabase local.');
}
const APP = `http://localhost:${process.env.PUERTO || 4202}`;
const CAPTURAS = process.argv[2];
const sql = (q) =>
  execSync('docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -At -v ON_ERROR_STOP=1', { input: q, encoding: 'utf8' }).trim();

let fallas = 0;
const paso = (n, ok, detalle = '') => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK ' : 'FALLA'}  ${n}${detalle ? ' — ' + detalle : ''}`);
};

const password = 'Prueba-12345';
async function registrar(correo) {
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: 'Usuario E2E', telefono: celularUnico(), documento: '123', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá', acepta_terminos: true, acepta_politica_privacidad: true } }),
  });
  return (await r.json()).id;
}

const t = Date.now();
const cuenta = `prueba.e2e.${t}@cheyn.test`;
const idCuenta = await registrar(cuenta); // queda sin confirmar
const desconocido = `nadie.${t}@cheyn.test`;

const browser = await chromium.launch();

async function abrirLogin({ dark = false, mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } });
  await ctx.addInitScript((d) => {
    localStorage.setItem('zg_user_say_to_be_legal_age', 'true');
    localStorage.setItem('zg-dark', String(d));
  }, dark);
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/login`);
  await page.locator('input[placeholder="correo@ejemplo.com"]').waitFor();
  return { ctx, page };
}
async function intentar(page, correo, clave) {
  await page.locator('input[placeholder="correo@ejemplo.com"]').fill(correo);
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill(clave);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
}
async function capturar(page, nombre, { dark, mobile }) {
  if (!CAPTURAS) return;
  const dir = dark ? `${CAPTURAS}/dark-mode` : CAPTURAS;
  mkdirSync(dir, { recursive: true });
  await page.locator('.bg-red-50').last().scrollIntoViewIfNeeded({ timeout: 1000 }).catch(() => {});
  await page.waitForTimeout(700); // fin de animaciones (modal, toast)
  // Captura del viewport: con fullPage el navbar fijo queda pintado a mitad de página.
  await page.screenshot({ path: `${dir}/${nombre}${mobile ? '-mobile' : ''}${dark ? '-dark' : ''}.png` });
}
const variantes = [{}, { dark: true }, { mobile: true }, { dark: true, mobile: true }];

// 1. Correo sin cuenta → ofrece registro
for (const v of variantes) {
  const { ctx, page } = await abrirLogin(v);
  await intentar(page, desconocido, 'cualquiera1');
  const modal = page.getByText('No se encontró una cuenta con este correo');
  const visto = await modal.waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!v.dark && !v.mobile) paso('correo sin cuenta: ofrece crear cuenta', visto);
  await capturar(page, '03-login-correo-sin-cuenta', v);
  if (!v.dark && !v.mobile && visto) {
    await page.locator('.p-dialog').getByRole('button', { name: 'Aceptar' }).click();
    await page.waitForURL(/\/auth\/register/, { timeout: 8000 }).catch(() => {});
    paso('  → lleva al registro con el correo', page.url().includes('/auth/register') && decodeURIComponent(page.url()).includes(desconocido), page.url());
    await page.waitForTimeout(800);
    const valores = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
    paso('  → el formulario de registro trae el correo prellenado', valores.includes(desconocido));
  }
  await ctx.close();
}

// 2. Cuenta sin confirmar → pide confirmar
for (const v of variantes) {
  const { ctx, page } = await abrirLogin(v);
  await intentar(page, cuenta, password);
  const visto = await page.getByText('Debes confirmar tu correo').waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!v.dark && !v.mobile) paso('cuenta sin confirmar: mensaje claro', visto);
  await capturar(page, '04-login-sin-confirmar', v);
  await ctx.close();
}

sql(`update auth.users set email_confirmed_at = now() where id = '${idCuenta}';`);

// 3. Contraseña equivocada
for (const v of variantes) {
  const { ctx, page } = await abrirLogin(v);
  await intentar(page, cuenta, 'Equivocada-999');
  const visto = await page.getByText('La contraseña no es correcta').waitFor({ timeout: 8000 }).then(() => true, () => false);
  if (!v.dark && !v.mobile) paso('contraseña equivocada: mensaje claro', visto);
  await capturar(page, '05-login-clave-incorrecta', v);
  await ctx.close();
}

// 4. El caso del bug: cuenta válida SIN fila en usuarios_publicos
sql(`delete from public.usuarios_publicos where uid = '${idCuenta}';`); // solo en la base local
{
  const { ctx, page } = await abrirLogin();
  await intentar(page, cuenta, password);
  const entro = await page.waitForURL(/\/home/, { timeout: 10000 }).then(() => true, () => false);
  paso('cuenta sin fila en usuarios_publicos entra (antes se rechazaba)', entro, page.url());
  const aviso = await page.getByText('pendiente de autorización').waitFor({ timeout: 5000 }).then(() => true, () => false);
  paso('  → perfil inactivo: avisa que está pendiente', aviso);

  // 5. El admin activa la cuenta: al recargar, el perfil se relee de la base
  sql(`update public.perfiles set status = 'activo' where id = '${idCuenta}';`);
  await page.reload();
  await page.waitForTimeout(3000);
  const perfil = await page.evaluate(() => localStorage.getItem('user-profile'));
  paso('al recargar, la activación del admin se refleja', !!perfil && perfil.includes('"status":"activo"'));

  // 6. Sesión cerrada en el servidor: al recargar no queda perfil fantasma
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith('sb-')) localStorage.removeItem(k);
  });
  await page.reload();
  await page.waitForTimeout(3000);
  const fantasma = await page.evaluate(() => localStorage.getItem('user-profile'));
  paso('sin sesión, el perfil guardado se limpia', !fantasma || !fantasma.includes(cuentaId()), fantasma?.slice(0, 60));
  await ctx.close();
}
function cuentaId() { return idCuenta; }

// 7. Cuenta bloqueada
sql(`update public.perfiles set status = 'bloqueado' where id = '${idCuenta}';`);
{
  const { ctx, page } = await abrirLogin();
  await intentar(page, cuenta, password);
  const visto = await page.getByText('Tu cuenta no está habilitada').waitFor({ timeout: 8000 }).then(() => true, () => false);
  const sesion = await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')));
  paso('cuenta bloqueada: no entra y se cierra la sesión', visto && !sesion);
  await ctx.close();
}

await browser.close();
console.log(`\nCuenta local de prueba: ${cuenta}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
