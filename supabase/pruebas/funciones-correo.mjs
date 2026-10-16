// Prueba de las Edge Functions de correo contra el Supabase LOCAL.
// Requiere: npx supabase start  y  npx supabase functions serve --env-file <archivo>
// con SMTP_HOST=supabase_inbucket_Cheyn_Verde, SMTP_PORT=1025, SMTP_SECURE=false,
// APP_URLS=http://localhost:4202. Los correos quedan en Mailpit, nunca salen.
//
// Uso: node supabase/pruebas/funciones-correo.mjs
import { execSync } from 'node:child_process';
import { celularUnico } from './_comun.mjs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
const MAILPIT = status.MAILPIT_URL || status.INBUCKET_URL;
if (!API.startsWith('http://127.0.0.1') && !API.startsWith('http://localhost')) {
  throw new Error('Esta prueba solo corre contra el Supabase local.');
}

const sql = (q) =>
  execSync('docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -At -v ON_ERROR_STOP=1', { input: q, encoding: 'utf8' }).trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
let fallas = 0;
const paso = (n, ok, detalle = '') => {
  if (!ok) fallas++;
  console.log(`${ok ? 'OK ' : 'FALLA'}  ${n}${detalle ? ' — ' + detalle : ''}`);
};

async function call(path, { body, token, method = 'POST' } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { apikey: ANON, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || ANON) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
}
async function buzon(correo) {
  const l = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + correo)}`)).json();
  return l.messages ?? [];
}
async function cuerpo(id) {
  return (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()).HTML ?? '';
}
const password = 'Prueba-12345';
async function registrar(correo, telefono, extra = {}) {
  // Mismo redirect que usa register.ts para el enlace del primer correo.
  const r = await call(`/auth/v1/signup?redirect_to=${encodeURIComponent('http://localhost:4202/auth/login?confirmado=1')}`, {
    body: { email: correo, password, data: { full_name: 'Usuario Prueba', telefono, documento: '123', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá', acepta_terminos: true, acepta_politica_privacidad: true, ...extra } },
  });
  return r.body?.id ?? r.body?.user?.id;
}
async function confirmarYEntrar(correo) {
  sql(`update auth.users set email_confirmed_at = now() where email = '${correo}';`);
  const r = await call('/auth/v1/token?grant_type=password', { body: { email: correo, password } });
  return r.body?.access_token;
}

const t = Date.now();
const creados = [];

// ── send-registration-email ────────────────────────────────────────────────
console.log('\n== send-registration-email ==');
const c1 = `prueba.reg1.${t}@cheyn.test`;
// Celulares nuevos de la base de confianza (uno por cuenta: la base no permite repetidos).
const confianza1 = celularUnico(), confianza2 = celularUnico();
sql(`insert into public.base_confianza (telefono) values ('${confianza1}'), ('${confianza2}');`);
const id1 = await registrar(c1, confianza1); // está en base_confianza
creados.push(c1);
await espera(1500);
const inicial = await buzon(c1);
const plantilla = inicial.find((m) => m.Subject.includes('Confirma tu correo'));
let enlaceConfirmacion;
paso('primer correo = plantilla "Confirm signup" con el texto pedido', !!plantilla, plantilla?.Subject);
if (plantilla) {
  const html = await cuerpo(plantilla.ID);
  paso('  → texto del caso 6, con "Tu"', html.includes('Tu dirección de correo fue registrada correctamente.') &&
    html.includes('ingresar al sistema con el usuario y contraseña creada para conocer la oferta Cheyn Verde') && !html.includes('Tú '));
  enlaceConfirmacion = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/)?.[1]?.replace(/&amp;/g, '&');
}

// Ruta 1 sin correo confirmado: la plantilla ya fue el primer correo, la función no duplica.
const r1 = await call('/functions/v1/send-registration-email', {
  body: { nombre: 'X', correo: c1, telefono: '0000000000', token_referido: null, confirmation_url: 'https://sitio-malicioso.test/robar', user_id: id1 },
});
paso('responde 200 con el payload de siempre + user_id', r1.status === 200, JSON.stringify(r1.body));
paso('la respuesta ya no expone la ruta', r1.body && !('ruta' in r1.body));
await espera(1500);
paso('ruta 1 con confirmación pendiente: no duplica el primer correo', (await buzon(c1)).length === inicial.length);

const conf = enlaceConfirmacion ? await fetch(enlaceConfirmacion, { redirect: 'manual' }) : null;
const destino = conf?.headers.get('location')?.split('#')[0] ?? '';
paso('el enlace de confirmación lleva al login', destino.startsWith('http://localhost:4202/auth/login?confirmado=1'), destino);

// Ruta 1 con correo ya confirmado (confirmaciones desactivadas): bienvenida con enlace al login.
const c1b = `prueba.reg1b.${t}@cheyn.test`;
const id1b = await registrar(c1b, confianza2);
creados.push(c1b);
sql(`update auth.users set email_confirmed_at = now() where id = '${id1b}';`);
await call('/functions/v1/send-registration-email', {
  body: { correo: c1b, telefono: '0000000000', confirmation_url: 'https://sitio-malicioso.test/robar', user_id: id1b },
});
await espera(1500);
const msgs1 = await buzon(c1b);
const nuevo = msgs1.find((m) => m.Subject.includes('Bienvenido'));
paso('ruta 1 decidida por la base (el cliente mandó otro teléfono)', !!nuevo, nuevo?.Subject);
if (nuevo) {
  const html = await cuerpo(nuevo.ID);
  paso('el enlace del correo es del dominio permitido', html.includes('href="http://localhost:4202/auth/login"') && !html.includes('sitio-malicioso'));
}

const r1b = await call('/functions/v1/send-registration-email', { body: { correo: c1b, telefono: '1', user_id: id1b } });
await espera(1500);
paso('segunda llamada no reenvía el correo', r1b.status === 200 && (await buzon(c1b)).length === msgs1.length, `${(await buzon(c1b)).length} correos`);

const ajeno = `persona.ajena.${t}@cheyn.test`;
const r2 = await call('/functions/v1/send-registration-email', { body: { correo: ajeno, telefono: confianza1 } });
await espera(1000);
paso('correo sin perfil: no se envía nada y la respuesta es la misma', r2.status === 200 && (await buzon(ajeno)).length === 0, JSON.stringify(r2.body));

const c3 = `prueba.reg3.${t}@cheyn.test`;
const id3 = await registrar(c3, celularUnico());
creados.push(c3);
sql(`update public.perfiles set created_at = now() - interval '2 hours' where id = '${id3}';`);
await call('/functions/v1/send-registration-email', { body: { correo: c3, telefono: '1', user_id: id3 } });
await espera(1000);
paso('perfil de hace más de 30 min: no se envía', !(await buzon(c3)).some((m) => m.Subject.includes('Registro recibido')));

const c4 = `prueba.reg4.${t}@cheyn.test`;
const id4 = await registrar(c4, celularUnico());
creados.push(c4);
await call('/functions/v1/send-registration-email', { body: { correo: c4, telefono: confianza1, token_referido: 'CODIGO-FALSO', user_id: id4 } });
await espera(1500);
const m4 = (await buzon(c4)).find((m) => m.Subject.includes('Registro recibido'));
paso('ruta 3 aunque el cliente dijera teléfono de confianza y código', !!m4 && !(await cuerpo(m4.ID)).includes('código de invitado'), m4?.Subject);

// ── send-account-activation ────────────────────────────────────────────────
console.log('\n== send-account-activation ==');
const sinSesion = await call('/functions/v1/send-account-activation', { body: { correo: c4, confirmation_url: 'https://sitio-malicioso.test' } });
paso('sin sesión: rechazado', sinSesion.status === 401, `HTTP ${sinSesion.status}`);

const tokCliente = await confirmarYEntrar(c4);
const comoCliente = await call('/functions/v1/send-account-activation', { token: tokCliente, body: { correo: c4, confirmation_url: 'x' } });
paso('con sesión de cliente: rechazado', comoCliente.status === 403, `HTTP ${comoCliente.status}`);

const admin = `prueba.admin.${t}@cheyn.test`;
await registrar(admin, celularUnico());
creados.push(admin);
sql(`update public.perfiles set rol = 'admin', status = 'activo' where correo = '${admin}';`);
const tokAdmin = await confirmarYEntrar(admin);

const inactivo = await call('/functions/v1/send-account-activation', { token: tokAdmin, body: { correo: c4, confirmation_url: 'x' } });
paso('admin, pero el perfil destino no está activo: rechazado', inactivo.status === 400, `HTTP ${inactivo.status}`);

const externo = await call('/functions/v1/send-account-activation', { token: tokAdmin, body: { correo: ajeno, confirmation_url: 'x' } });
paso('admin, correo que no es de ningún perfil: rechazado', externo.status === 400, `HTTP ${externo.status}`);

sql(`update public.perfiles set status = 'activo' where id = '${id4}';`);
const ok = await call('/functions/v1/send-account-activation', { token: tokAdmin, body: { correo: c4, confirmation_url: 'https://sitio-malicioso.test/x' } });
await espera(1500);
const m5 = (await buzon(c4)).find((m) => m.Subject.includes('autorizado'));
paso('admin + perfil activo: enviado', ok.status === 200 && !!m5, `HTTP ${ok.status}`);
if (m5) {
  const html = await cuerpo(m5.ID);
  paso('enlace de activación del dominio permitido', html.includes('href="http://localhost:4202/auth/login"') && !html.includes('sitio-malicioso'));
}

console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
