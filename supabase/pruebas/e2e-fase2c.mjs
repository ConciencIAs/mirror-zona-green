// Prueba E2E de la Fase 2c (un celular por persona) contra el Supabase LOCAL.
// Requiere las migraciones 20261016130000, 20261016130100 y la pendiente
// 20261016130200 aplicadas en la base local, y la app en
// http://localhost:4202 (ng serve --configuration local).
// Uso: node supabase/pruebas/e2e-fase2c.mjs [carpeta-capturas]
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
async function crear(nombre, telefono, { activo = true, admin = false } = {}) {
  const correo = `prueba.f2c.${nombre}.${t}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: `F2c ${nombre}`, telefono, documento: '12345678', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá' } }),
  });
  const id = (await r.json()).id;
  creados.push(correo);
  sql(`update auth.users set email_confirmed_at = now() where id = '${id}';
       update public.perfiles set status = '${activo ? 'activo' : 'inactivo'}'${admin ? ", rol = 'admin'" : ''} where id = '${id}';`);
  await espera(1100);
  return { id, correo };
}
const perfil = (correo) => sql(`select concat_ws(' | ', coalesce(telefono, '∅'), coalesce(telefono_normalizado, '∅'), status) from public.perfiles where correo = '${correo}'`);

// Casos que existen en producción, recreados con datos inventados.
const celularDuenio = celularUnico();
const duenio = await crear('duenio', celularDuenio);
const corto = await crear('corto', '3005550');
const retirado = await crear('retirado', celularUnico());
sql(`update public.perfiles set telefono = null,
       datos_adicionales = datos_adicionales || '{"telefono_retirado_motivo":"celular repetido (fase 2c)"}'::jsonb
     where id = '${retirado.id}';`);
const sinCelular = await crear('sincelular', '');
const admin = await crear('admin', celularUnico(), { admin: true });

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

const CELULAR_PH = '3001234567 o +54 9 11 1234 5678';
async function llenarRegistro(page, correo, celular) {
  await page.goto(`${APP}/auth/register`);
  await campo(page, 'Juan Pérez').fill('Persona Fase 2c');
  await campo(page, 'correo@ejemplo.com').fill(correo);
  await campo(page, 'Mínimo 8 caracteres').fill(password);
  await campo(page, 'Repite tu contraseña').fill(password);
  await campo(page, CELULAR_PH).fill(celular);
  await page.locator('app-form-input:has-text("Documento") input').fill('12345678');
  await campo(page, 'Ciudad, dirección...').fill('Bogotá');
  await page.locator('p-checkbox').nth(0).click();
  await page.locator('p-checkbox').nth(1).click();
}
const enviarRegistro = (page) => page.locator('form button[type="submit"]').first().click();

// ── 1. Registro ─────────────────────────────────────────────────────────────
console.log('\n== Registro ==');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/register`);
  const cel = campo(page, CELULAR_PH);
  await cel.fill('12345');
  await cel.blur();
  paso('celular inválido: lo explica al salir del campo', await page.getByText('Ingresa un celular válido').first().isVisible());
  await ctx.close();
}
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  const correo = `prueba.f2c.repite${v.dark ? 'd' : ''}${v.mobile ? 'm' : ''}.${t}@cheyn.test`;
  // El mismo celular del dueño, escrito con indicativo y espacios.
  const otroFormato = `+57 ${celularDuenio.slice(0, 3)} ${celularDuenio.slice(3, 6)} ${celularDuenio.slice(6)}`;
  await llenarRegistro(page, correo, otroFormato);
  await enviarRegistro(page);
  const aviso = page.getByText('Este celular ya está registrado');
  const visto = await aviso.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  await capturar(page, '15-registro-celular-repetido', v, aviso);
  if (!v.dark && !v.mobile) {
    paso('celular de otra cuenta (otro formato): lo rechaza con el mensaje acordado', visto);
    paso('  → no se creó la cuenta', sql(`select count(*) from auth.users where email = '${correo}'`) === '0');
  }
  await ctx.close();
}
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  const correo = `prueba.f2c.extranjero.${t}@cheyn.test`;
  const extranjero = `+44 7700 ${String(t).slice(-6)}`;
  await llenarRegistro(page, correo, extranjero);
  await enviarRegistro(page);
  const ok = await page.getByText('Cuenta creada').first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  creados.push(correo);
  paso('celular extranjero con indicativo: crea la cuenta', ok);
  paso('  → se guarda completo, con su indicativo', perfil(correo).startsWith(`+447700${String(t).slice(-6)}`), perfil(correo));
  await ctx.close();
}
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  const correo = `prueba.f2c.guiones.${t}@cheyn.test`;
  const nuevo = celularUnico();
  await llenarRegistro(page, correo, `${nuevo.slice(0, 3)}-${nuevo.slice(3, 6)}-${nuevo.slice(6)}`);
  await enviarRegistro(page);
  await page.getByText('Cuenta creada').first().waitFor({ timeout: 15000 }).catch(() => {});
  creados.push(correo);
  paso('celular colombiano con guiones: se guarda como +57…', perfil(correo).startsWith(`+57${nuevo}`), perfil(correo));
  await ctx.close();
}

// ── 2. Mi perfil ───────────────────────────────────────────────────────────
console.log('\n== Mi perfil ==');
// La variante de escritorio cambia el celular: va al final para que las demás vean el aviso.
for (const v of [...variantes.slice(1), variantes[0]]) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, retirado.correo);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  const aviso = page.getByText('coincidía con el de otra cuenta');
  const visto = await aviso.first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  await capturar(page, '16-perfil-aviso-celular', v, aviso);
  if (!v.dark && !v.mobile) {
    paso('celular retirado por repetido: Mi perfil pide uno nuevo', visto);
    await page.getByRole('button', { name: 'Actualizar celular' }).click();
    const input = campo(page, CELULAR_PH);
    await input.fill(celularDuenio);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    paso('  → si escribe el celular de otra cuenta, lo rechaza', await page.getByText('Este celular ya está registrado').first().waitFor({ timeout: 8000 }).then(() => true, () => false));
    const propio = celularUnico();
    await input.fill(`+57 ${propio}`);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.getByText('Perfil actualizado').first().waitFor({ timeout: 8000 }).catch(() => {});
    paso('  → con un celular libre, se guarda normalizado', perfil(retirado.correo).startsWith(`+57${propio}`), perfil(retirado.correo));
    paso('  → y el aviso desaparece', !(await aviso.first().isVisible()));
  }
  await ctx.close();
}
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  await entrar(page, corto.correo);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  paso('celular corto (inválido): Mi perfil pide revisarlo', await page.getByText('no parece válido').first().waitFor({ timeout: 10000 }).then(() => true, () => false));
  await ctx.close();
}

// ── 2b. Fecha de nacimiento: sin desfase de zona horaria ───────────────────
console.log('\n== Fecha de nacimiento ==');
for (const zona of ['America/Bogota', 'Asia/Tokyo']) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, timezoneId: zona });
  await ctx.addInitScript(() => localStorage.setItem('zg_user_say_to_be_legal_age', 'true'));
  const page = await ctx.newPage();
  await entrar(page, duenio.correo);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  const muestra = await page.getByText('1 de enero de 1990').first().waitFor({ timeout: 10000 }).then(() => true, () => false);
  paso(`${zona}: Mi perfil muestra 1 de enero de 1990 (antes, 31 de diciembre)`, muestra);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await page.getByText('Perfil actualizado').first().waitFor({ timeout: 8000 }).catch(() => {});
  const guardada = sql(`select fecha_nacimiento from public.perfiles where id = '${duenio.id}'`);
  paso(`${zona}: al guardar, la fecha sigue siendo 1990-01-01`, guardada === '1990-01-01', guardada);
  await ctx.close();
}

// ── 3. Panel de admin ──────────────────────────────────────────────────────
console.log('\n== Panel de admin ==');
// Para ver la etiqueta "Repetido" hace falta un repetido: se quita la regla un
// momento (solo en la base local) y se restituye al final.
sql(`drop index if exists public.perfiles_telefono_unico;
     update public.perfiles set telefono = '${celularDuenio}' where id = '${corto.id}';`);
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, admin.correo);
  await page.goto(`${APP}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByText(duenio.correo).first().waitFor({ timeout: 10000 }).catch(() => {});
  if (!v.dark && !v.mobile) {
    const fila = (correo) => page.locator('tr', { hasText: correo });
    paso('etiqueta "Repetido" en los dos perfiles con el mismo celular',
      (await fila(duenio.correo).getByText('Repetido').count()) > 0 && (await fila(corto.correo).getByText('Repetido').count()) > 0);
    paso('etiqueta "Sin celular" en el perfil sin celular', (await fila(sinCelular.correo).getByText('Sin celular').count()) > 0);
    paso('etiqueta "Inválido" no aparece en perfiles válidos', (await fila(admin.correo).getByText('Inválido').count()) === 0);
  }
  await capturar(page, '17-admin-alertas-celular', v, page.getByText('Repetido'));
  await ctx.close();
}
sql(`update public.perfiles set telefono = '3005550' where id = '${corto.id}';
     create unique index if not exists perfiles_telefono_unico on public.perfiles (telefono_normalizado)
       where telefono_normalizado is not null and deleted_at is null;`);
paso('regla única restituida en la base local', sql(`select count(*) from pg_indexes where indexname = 'perfiles_telefono_unico'`) === '1');

await browser.close();
console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
