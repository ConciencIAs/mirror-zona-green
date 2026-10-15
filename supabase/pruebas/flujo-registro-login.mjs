// Prueba del flujo registro → confirmación de correo → login contra el
// Supabase LOCAL (npx supabase start). Nunca apunta a producción: las
// llaves se leen de `npx supabase status`, que solo describe el entorno local.
//
// Uso: node supabase/pruebas/flujo-registro-login.mjs [correo] [telefono]
import { execSync } from 'node:child_process';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
const MAILPIT = status.MAILPIT_URL || status.INBUCKET_URL;
if (!API.startsWith('http://127.0.0.1') && !API.startsWith('http://localhost')) {
  throw new Error('Esta prueba solo corre contra el Supabase local.');
}

const correo = (process.argv[2] || `prueba.${Date.now()}@cheyn.test`).toLowerCase();
const telefono = process.argv[3] || '3001112233';
const password = 'Prueba-12345';
const h = { apikey: ANON, 'Content-Type': 'application/json' };
const paso = (n, ok, detalle = '') => console.log(`${ok ? 'OK ' : 'FALLA'}  ${n}${detalle ? ' — ' + detalle : ''}`);

async function rest(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { ...h, Authorization: 'Bearer ' + (opts.token || ANON), ...(opts.headers || {}) } });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t }; }
}

// 1. Registro (lo mismo que hace register.ts)
const signup = await rest('/auth/v1/signup', {
  method: 'POST',
  body: JSON.stringify({
    email: correo, password,
    data: { full_name: 'Usuario Prueba', telefono, documento: '123', tipo_documento: 'CC', fecha_nacimiento: '1990-01-01', ubicacion: 'Bogotá', acepta_terminos: true, acepta_politica_privacidad: true },
  }),
});
paso('registro con contraseña', signup.status === 200, `HTTP ${signup.status}`);

// 2. Confirmación desde el buzón local (Mailpit)
await new Promise((r) => setTimeout(r, 1500));
const lista = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent('to:' + correo)}`)).json();
const msg = lista.messages?.[0];
paso('correo de confirmación recibido en el buzón local', !!msg, msg?.Subject);
if (msg) {
  const cuerpo = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
  const enlace = (cuerpo.HTML || cuerpo.Text).match(/https?:\/\/[^"\s]+\/auth\/v1\/verify[^"\s]*/)?.[0]?.replace(/&amp;/g, '&');
  const conf = await fetch(enlace, { redirect: 'manual' });
  paso('enlace de confirmación', conf.status === 303 || conf.status === 302, `redirige a ${conf.headers.get('location')?.split('#')[0]}`);
}

// 3. Lo que ve el login ANTES de autenticar (código actual: lectura de usuarios_publicos)
const up = await rest(`/rest/v1/usuarios_publicos?select=correo&correo=eq.${encodeURIComponent(correo)}`);
paso('login actual: el correo está en usuarios_publicos', Array.isArray(up.body) && up.body.length === 1, JSON.stringify(up.body));

// 4. Lo que ve el login corregido (RPC existe_correo, si existe)
const ex = await rest('/rest/v1/rpc/existe_correo', { method: 'POST', body: JSON.stringify({ p_correo: correo }) });
paso('login corregido: existe_correo()', ex.body === true, `HTTP ${ex.status} ${JSON.stringify(ex.body)}`);

// 5. Autenticación real
const login = await rest('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: correo, password }) });
paso('signInWithPassword', login.status === 200, `HTTP ${login.status}`);
if (login.status === 200) {
  const perfil = await rest(`/rest/v1/perfiles?select=status,origen_autorizacion,full_name&id=eq.${login.body.user.id}`, { token: login.body.access_token });
  paso('perfil legible por su dueño', perfil.body?.length === 1, JSON.stringify(perfil.body?.[0]));
}
console.log(`\ncorreo de prueba: ${correo}`);
