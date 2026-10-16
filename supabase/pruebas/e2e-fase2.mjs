// Prueba E2E de la Fase 2 contra el Supabase LOCAL (ver LEEME.md).
// Requiere la app en http://localhost:4202 (ng serve --configuration local) y la
// migración 20261016120000_fase2_menu_metricas.sql aplicada en la base local.
// Uso: node supabase/pruebas/e2e-fase2.mjs [carpeta-capturas]
import { execSync } from 'node:child_process';
import { celularUnico } from './_comun.mjs';
import { mkdirSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
const MAILPIT = status.MAILPIT_URL || status.INBUCKET_URL;
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
async function registrar(correo) {
  const r = await fetch(`${API}/auth/v1/signup?redirect_to=${encodeURIComponent(APP + '/auth/login?confirmado=1')}`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: 'Usuario Fase 2', telefono: celularUnico(), documento: '123', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá', acepta_terminos: true, acepta_politica_privacidad: true } }),
  });
  creados.push(correo);
  return (await r.json()).id;
}
async function buzon(correo) {
  const l = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + correo)}`)).json();
  return l.messages ?? [];
}
async function enlaceConfirmacion(correo) {
  const m = (await buzon(correo)).find((x) => x.Subject.includes('Confirma tu correo'));
  if (!m) return null;
  const html = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()).HTML ?? '';
  return html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replace(/&amp;/g, '&') ?? null;
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
// La vista se actualiza un instante después del clic (zoneless): se espera el estado.
const tipoEs = (input, tipo) =>
  input.evaluate((el, t) => new Promise((ok) => { const f = () => (el.type === t ? ok(true) : setTimeout(f, 50)); f(); setTimeout(() => ok(false), 3000); }), tipo);
const campo = (page, ph) => page.locator(`input[placeholder="${ph}"]`);
async function entrar(page, correo, clave) {
  await page.goto(`${APP}/auth/login`);
  await campo(page, 'correo@ejemplo.com').fill(correo);
  await campo(page, 'Ingresa tu contraseña').fill(clave);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  // Un usuario activo termina en /seleccion; uno inactivo, en /home.
  return page.waitForURL(/\/(home|seleccion)/, { timeout: 10000 }).then(() => true, () => false);
}
async function capturar(page, nombre, { dark = false, mobile = false } = {}, locator) {
  if (!CAPTURAS) return;
  const dir = dark ? `${CAPTURAS}/dark-mode` : CAPTURAS;
  mkdirSync(dir, { recursive: true });
  if (locator) await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/${nombre}${mobile ? '-mobile' : ''}${dark ? '-dark' : ''}.png` });
}
const variantes = [{}, { dark: true }, { mobile: true }, { dark: true, mobile: true }];

// ── 1. Mostrar / ocultar contraseña ────────────────────────────────────────
console.log('\n== Mostrar contraseña ==');
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/login`);
  const input = campo(page, 'Ingresa tu contraseña');
  await input.fill('MiClave-Visible');
  const boton = page.getByRole('button', { name: 'Mostrar contraseña' });
  if (!v.dark && !v.mobile) paso('el campo empieza oculto', (await input.getAttribute('type')) === 'password');
  await boton.click();
  if (!v.dark && !v.mobile) {
    paso('el ojo muestra la contraseña', await tipoEs(input, 'text'));
    paso('  → el botón cambia a "Ocultar contraseña" (accesible)', await page.getByRole('button', { name: 'Ocultar contraseña' }).waitFor({ timeout: 3000 }).then(() => true, () => false));
  }
  await capturar(page, '07-login-mostrar-contrasena', v, input);
  if (!v.dark && !v.mobile) {
    await page.getByRole('button', { name: 'Ocultar contraseña' }).click();
    paso('  → y la vuelve a ocultar', await tipoEs(input, 'password'));
  }
  await ctx.close();
}

// ── 1b. Errores de validación: solo tras tocar el campo o enviar ──────────
console.log('\n== Validación ==');
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  const visible = (t) => page.getByText(t).first().isVisible();
  await page.goto(`${APP}/auth/login`);
  await page.waitForTimeout(1500);
  paso('login recién abierto: sin errores en rojo', !(await visible('Ingresa un correo válido')));
  const correo = campo(page, 'correo@ejemplo.com');
  await correo.fill('no-es-correo');
  await page.waitForTimeout(300);
  paso('  → mientras escribe tampoco', !(await visible('Ingresa un correo válido')));
  await correo.blur();
  await page.waitForTimeout(400);
  paso('  → al salir del campo sí muestra el error', await visible('Ingresa un correo válido'));
  await page.goto(`${APP}/auth/register`);
  await page.waitForTimeout(1500);
  paso('registro recién abierto: sin errores en rojo', !(await visible('Nombre demasiado corto')));
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForTimeout(800);
  paso('  → al enviarlo vacío, los errores aparecen en cada campo', await visible('Nombre demasiado corto'));
  await ctx.close();
}

// ── 2. Primer correo → login (caso 6) ──────────────────────────────────────
console.log('\n== Primer correo lleva al login ==');
const nuevo = `prueba.f2.${t}@cheyn.test`;
await registrar(nuevo);
await espera(1500);
const enlace = await enlaceConfirmacion(nuevo);
paso('llega la plantilla "Confirma tu correo"', !!enlace);
for (const v of variantes) {
  if (!enlace) break;
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  if (!v.dark && !v.mobile) {
    await page.goto(enlace);
    await page.waitForURL(/\/auth\/login\?confirmado=1/, { timeout: 10000 }).catch(() => {});
    paso('el enlace abre el login', page.url().includes('/auth/login?confirmado=1'), page.url().split('#')[0]);
    const aviso = page.getByText('Tu correo fue confirmado');
    paso('  → muestra "Tu correo fue confirmado…"', await aviso.waitFor({ timeout: 8000 }).then(() => true, () => false));
    paso('  → el correo viene escrito', (await campo(page, 'correo@ejemplo.com').inputValue()) === nuevo);
    await page.waitForTimeout(1500);
    const estado = await page.evaluate(() => ({
      token: Object.keys(localStorage).some((k) => k.startsWith('sb-') && k.endsWith('-auth-token')),
      perfil: localStorage.getItem('user-profile') ?? '',
    }));
    paso('  → no queda sesión abierta: se entra con contraseña', !estado.token && !estado.perfil.includes(nuevo));
    await capturar(page, '08-login-correo-confirmado', v, page.getByText('Tu correo fue confirmado'));
    await campo(page, 'Ingresa tu contraseña').fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    paso('  → con su contraseña entra', await page.waitForURL(/\/home/, { timeout: 10000 }).then(() => true, () => false));
  } else {
    // El enlace es de un solo uso: para las demás variantes se muestra el mismo estado.
    await page.goto(`${APP}/auth/login?confirmado=1`);
    await page.getByText('Tu correo fue confirmado').waitFor({ timeout: 8000 }).catch(() => {});
    await capturar(page, '08-login-correo-confirmado', v, page.getByText('Tu correo fue confirmado'));
  }
  await ctx.close();
}

// ── 3. Reenviar correo de confirmación ─────────────────────────────────────
console.log('\n== Reenviar confirmación ==');
const sinConfirmar = `prueba.f2r.${t}@cheyn.test`;
await registrar(sinConfirmar);
await espera(1500);
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await page.goto(`${APP}/auth/login`);
  await campo(page, 'correo@ejemplo.com').fill(sinConfirmar);
  await campo(page, 'Ingresa tu contraseña').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  const boton = page.getByRole('button', { name: 'Reenviar correo de confirmación' });
  const visible = await boton.waitFor({ timeout: 8000 }).then(() => true, () => false);
  await capturar(page, '09-login-reenviar-confirmacion', v, boton);
  if (!v.dark && !v.mobile) {
    paso('cuenta sin confirmar: ofrece reenviar el correo', visible);
    const antes = (await buzon(sinConfirmar)).length;
    await boton.click();
    await page.getByText('Te enviamos de nuevo').waitFor({ timeout: 8000 }).catch(() => {});
    await espera(1500);
    paso('  → llega un correo nuevo', (await buzon(sinConfirmar)).length === antes + 1, `${antes} → ${(await buzon(sinConfirmar)).length}`);
  }
  await ctx.close();
}

// ── 4. Cambiar contraseña en Mi perfil ─────────────────────────────────────
console.log('\n== Cambiar contraseña ==');
const usuario = `prueba.f2p.${t}@cheyn.test`;
const idUsuario = await registrar(usuario);
sql(`update auth.users set email_confirmed_at = now() where id = '${idUsuario}'; update public.perfiles set status = 'activo' where id = '${idUsuario}';`);
const nueva = 'Nueva-Clave-678';
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, usuario, !v.dark && !v.mobile ? password : nueva);
  await page.goto(`${APP}/customer/perfil`, { waitUntil: 'domcontentloaded' });
  const abrir = page.getByRole('button', { name: /Cambiar contraseña/ }).first();
  await abrir.waitFor({ timeout: 10000 });
  await abrir.click();
  const actual = campo(page, 'Tu contraseña actual');
  if (!v.dark && !v.mobile) {
    await actual.fill('equivocada-1');
    await campo(page, 'Mínimo 8 caracteres').fill(nueva);
    await campo(page, 'Repite la nueva contraseña').fill(nueva);
    await page.locator('form').getByRole('button', { name: 'Cambiar contraseña' }).click();
    const err = page.getByText('La contraseña actual no es correcta');
    paso('contraseña actual equivocada: no cambia', await err.waitFor({ timeout: 8000 }).then(() => true, () => false));
    await capturar(page, '10-perfil-cambiar-contrasena', v, err);

    await actual.fill(password);
    await page.locator('form').getByRole('button', { name: 'Cambiar contraseña' }).click();
    paso('  → con la actual correcta: cambia', await page.getByText('Contraseña actualizada').waitFor({ timeout: 10000 }).then(() => true, () => false));
  } else {
    await actual.fill('equivocada-1');
    await page.locator('form').getByRole('button', { name: 'Cambiar contraseña' }).click();
    const err = page.getByText('La contraseña actual no es correcta');
    await err.waitFor({ timeout: 8000 }).catch(() => {});
    await capturar(page, '10-perfil-cambiar-contrasena', v, err);
  }
  await ctx.close();
}
{
  const ctx = await contexto();
  const page = await ctx.newPage();
  paso('  → la contraseña anterior ya no sirve', !(await entrar(page, usuario, password)));
  paso('  → la nueva sí', await entrar(page, usuario, nueva));
  await ctx.close();
}

// ── 5. Admin: orden de usuarios, menú y métricas ───────────────────────────
console.log('\n== Admin ==');
const admin = `prueba.f2admin.${t}@cheyn.test`;
const idAdmin = await registrar(admin);
sql(`update auth.users set email_confirmed_at = now() where id = '${idAdmin}';
     update public.perfiles set rol = 'admin', status = 'activo', created_at = now() - interval '10 days' where id = '${idAdmin}';`);
// Órdenes sintéticas: una válida de 50.000 y una cancelada de 30.000.
const item = (n, sub) => `{"sku":"PRUEBA-${n}","nombre":"PRUEBA ${n}","subtotal":${sub},"es_por_gramos":false,"paquete_gramos":null,"precio_unitario":${sub},"cantidad_comprada":1,"total_gramos_entregados":null}`;
sql(`delete from public.ordenes where correo_cliente like 'prueba.f2%@cheyn.test';
     insert into public.ordenes (usuario_id, lista_productos, precio_total, status, correo_cliente, nombre_cliente) values
     ('${idUsuario}', '[${item('A', 50000)}]', 50000, 'aporte', '${usuario}', 'Usuario Fase 2'),
     ('${idUsuario}', '[${item('B', 30000)}]', 30000, 'cancelado', '${usuario}', 'Usuario Fase 2');`);
for (const v of variantes) {
  const ctx = await contexto(v);
  const page = await ctx.newPage();
  await entrar(page, admin, password);
  await page.goto(`${APP}/admin`, { waitUntil: 'domcontentloaded' });
  await page.getByText(usuario).first().waitFor({ timeout: 10000 }).catch(() => {});
  if (!v.dark && !v.mobile) {
    // Correos en el orden en que se muestran, comparados con su fecha en la base.
    const texto = await page.locator('body').innerText();
    const mostrados = [...new Set(texto.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [])].filter((c) => c.endsWith('@cheyn.test'));
    const fechas = mostrados.map((c) => sql(`select extract(epoch from created_at) from public.perfiles where correo = '${c}'`));
    const ordenado = fechas.every((f, i) => i === 0 || Number(fechas[i - 1]) >= Number(f));
    paso('usuarios: los más recientes primero', mostrados.length >= 3 && ordenado,
      `${mostrados.length} filas; primera: ${mostrados[0]}`);
  }
  await capturar(page, '11-admin-usuarios-recientes', v);

  await page.goto(`${APP}/admin/marketplace/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Ticket Prom.').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  if (!v.dark && !v.mobile) {
    const texto = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
    paso('métricas: ventas sin la orden cancelada ($50.000, no $80.000)', /\$\s?50[.,]000/.test(texto) && !/\$\s?80[.,]000/.test(texto));
    paso('  → la cancelación sí se cuenta (50,0%)', /50[.,]0\s?%/.test(texto));
    paso('  → estado "Aporte" con nombre legible', texto.includes('Aporte'));
  }
  await capturar(page, '12-admin-metricas', v);

  if (!v.dark && !v.mobile) {
    await page.goto(`${APP}/home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const menu = page.getByRole('button', { name: /men[uú]/i }).or(page.locator('header button:has(.pi-bars), header button[aria-label*="enú"]')).last();
    await menu.click({ timeout: 5000 }).catch(() => {});
    const link = page.getByText('Métricas de ventas').first();
    const hay = await link.waitFor({ timeout: 8000 }).then(() => true, () => false);
    paso('menú de admin: enlace "Métricas de ventas"', hay);
    await capturar(page, '13-menu-admin-metricas', v, link);
    if (hay) {
      await link.click();
      paso('  → abre /admin/marketplace/dashboard', await page.waitForURL(/\/admin\/marketplace\/dashboard/, { timeout: 8000 }).then(() => true, () => false));
    }
  }
  await ctx.close();
}
sql(`delete from public.ordenes where correo_cliente like 'prueba.f2%@cheyn.test';`);

await browser.close();
console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
