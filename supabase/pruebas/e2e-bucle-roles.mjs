// Reproduce el congelamiento al iniciar sesión con un usuario ACTIVO desde un
// navegador que abrió la app sin sesión (la tabla roles solo la leen usuarios
// autenticados, así que app_roles quedaba vacío y homeGuard/roleGuard hacían
// un bucle /home ↔ /seleccion). Solo contra el Supabase LOCAL.
// Uso: node supabase/pruebas/e2e-bucle-roles.mjs [puerto=4202]
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!API.startsWith('http://127.0.0.1') && !API.startsWith('http://localhost')) {
  throw new Error('Esta prueba solo corre contra el Supabase local.');
}
const APP = `http://localhost:${process.argv[2] || 4202}`;
const sql = (q) =>
  execSync('docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -At -v ON_ERROR_STOP=1', { input: q, encoding: 'utf8' }).trim();

let fallas = 0;
const paso = (n, ok, detalle = '') => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK ' : 'FALLA'}  ${n}${detalle ? ' — ' + detalle : ''}`);
};

const t = Date.now();
const password = 'Prueba-12345';
async function crear(correo, rol, estado) {
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: 'Usuario Roles', telefono: '3004440000', documento: '1', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá' } }),
  });
  const id = (await r.json()).id;
  sql(`update auth.users set email_confirmed_at = now() where id = '${id}';
       update public.perfiles set rol = '${rol}', status = '${estado}' where id = '${id}';`);
  return correo;
}

const casos = [
  ['cliente activo', await crear(`prueba.roles.c.${t}@cheyn.test`, 'customer', 'activo'), /\/seleccion/],
  ['admin activo', await crear(`prueba.roles.a.${t}@cheyn.test`, 'admin', 'activo'), /\/seleccion/],
  ['cliente inactivo', await crear(`prueba.roles.i.${t}@cheyn.test`, 'customer', 'inactivo'), /\/home/],
  // Quien ya visitó el sitio actual tiene app_roles = [] guardado.
  ['cliente activo con app_roles=[] ya guardado', await crear(`prueba.roles.v.${t}@cheyn.test`, 'customer', 'activo'), /\/seleccion/, true],
];

const browser = await chromium.launch();
for (const [nombre, correo, destino, rolesVacios] of casos) {
  const ctx = await browser.newContext();
  await ctx.addInitScript((vacios) => {
    localStorage.setItem('zg_user_say_to_be_legal_age', 'true');
    if (vacios) localStorage.setItem('app_roles', '[]');
  }, !!rolesVacios);
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/login`);
  await page.waitForTimeout(1500); // app.ts ya intentó leer roles sin sesión
  const rolesSinSesion = await page.evaluate(() => localStorage.getItem('app_roles'));
  await page.locator('input[placeholder="correo@ejemplo.com"]').fill(correo);
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const llego = await page.waitForURL(destino, { timeout: 10000 }).then(() => true, () => false);
  const responde = await Promise.race([
    page.evaluate(() => true),
    new Promise((ok) => setTimeout(() => ok(false), 3000)),
  ]);
  paso(`${nombre}: entra sin congelarse`, llego && responde, `app_roles sin sesión=${rolesSinSesion ?? 'null'}; url=${responde ? page.url() : 'página bloqueada'}`);

  // Recargar (o abrir un enlace directo) con la sesión abierta no debe mandar al login.
  if (llego && responde) {
    await page.waitForTimeout(1500);
    for (const ruta of ['/customer/perfil', '/seleccion']) {
      if (ruta === '/seleccion' && !destino.source.includes('seleccion')) continue;
      await page.goto(`${APP}${ruta}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      const url = page.url().replace(APP, '');
      paso(`  → recargar ${ruta} mantiene la sesión`, url.startsWith(ruta), url);
    }
  }
  await ctx.close().catch(() => {});
}
await browser.close().catch(() => {});
console.log(`\nCuentas locales: ${casos.map((c) => c[1]).join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
