// Prueba de la Fase 2b (trazabilidad de referidos) contra el Supabase LOCAL,
// por API. Requiere la migración 20261016140000_fase2b_referidos.sql aplicada.
// Uso: node supabase/pruebas/referidos.mjs
import { execSync } from 'node:child_process';
import { celularUnico } from './_comun.mjs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
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

const t = Date.now();
const password = 'Prueba-12345';
const creados = [];
async function crear(nombre, codigo, { activo = true, admin = false } = {}) {
  const correo = `prueba.ref2.${nombre}.${t}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: `Ref ${nombre}`, telefono: celularUnico(), ...(codigo ? { referido_por: codigo } : {}) } }),
  });
  const id = (await r.json()).id;
  creados.push(correo);
  sql(`update auth.users set email_confirmed_at = now() where id = '${id}';
       update public.perfiles set status = '${activo ? 'activo' : 'inactivo'}'${admin ? ", rol = 'admin'" : ''} where id = '${id}';`);
  await espera(1100);
  return { id, correo };
}
const darCodigo = (p, codigo) => sql(`update public.perfiles set codigo_invitacion = '${codigo}' where id = '${p.id}'`);
const relacion = (p) => sql(`select concat_ws(' | ', coalesce(referente_id::text, '∅'), estado, coalesce(alerta, '-')) from public.referidos where referido_id = '${p.id}'`);
async function token(p) {
  const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: p.correo, password }),
  });
  return (await r.json()).access_token;
}
async function rpc(fn, body, tok) {
  const r = await fetch(`${API}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tok || ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}),
  });
  const txt = await r.text();
  try { return { status: r.status, body: JSON.parse(txt) }; } catch { return { status: r.status, body: txt }; }
}

const sufijo = String(t).slice(-5);
console.log('\n== Registro con código ==');
const A = await crear('A');
darCodigo(A, `RA${sufijo}`);
const B = await crear('B', ` ra${sufijo} `);
paso('código en minúsculas y con espacios: se resuelve al referente', relacion(B) === `${A.id} | resuelto | -`, relacion(B));
darCodigo(B, `RB${sufijo}`);
const C = await crear('C', `RB${sufijo}`);
paso('tercer nivel: C referido por B', relacion(C).startsWith(B.id), relacion(C));
const D = await crear('D', 'CODIGOFALSO');
paso('código inexistente: queda "no_resuelto" sin referente', relacion(D) === '∅ | no_resuelto | -', relacion(D));
const inactivo = await crear('Inactivo', null, { activo: false });
darCodigo(inactivo, `RI${sufijo}`);
const E = await crear('E', `RI${sufijo}`);
paso('código de un perfil inactivo: no se resuelve', relacion(E).startsWith('∅ | no_resuelto'), relacion(E));
const sinCodigo = await crear('SinCodigo', null);
paso('registro sin código: no crea relación', sql(`select count(*) from public.referidos where referido_id = '${sinCodigo.id}'`) === '0');

console.log('\n== Historial de códigos ==');
darCodigo(A, `RA2${sufijo}`);
const hist = sql(`select string_agg(codigo || ':' || (activo_hasta is null), ',' order by id) from public.codigos_invitacion_historial where perfil_id = '${A.id}'`);
paso('cambiar el código cierra el anterior y abre el nuevo', hist === `RA${sufijo}:false,RA2${sufijo}:true`, hist);
paso('la relación de B no se pierde al cambiar el código de A', relacion(B).startsWith(A.id), relacion(B));

console.log('\n== Permisos ==');
const tokB = await token(B);
paso('usuario normal: no puede ver el árbol', (await rpc('arbol_referidos', {}, tokB)).status >= 400);
const lecturaB = await fetch(`${API}/rest/v1/referidos?select=referido_id`, { headers: { apikey: ANON, Authorization: `Bearer ${tokB}` } }).then((r) => r.json());
paso('usuario normal: la tabla de referidos le aparece vacía', Array.isArray(lecturaB) && lecturaB.length === 0, JSON.stringify(lecturaB).slice(0, 60));
const insertB = await fetch(`${API}/rest/v1/referidos`, {
  method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${tokB}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ referido_id: B.id, referente_id: C.id, codigo_usado: 'x' }),
});
paso('usuario normal: no puede escribir relaciones', insertB.status >= 400, `HTTP ${insertB.status}`);
const conteoB = await rpc('mis_referidos_conteo', {}, tokB);
paso('usuario normal: ve cuántos registró con su código (B → 1)', conteoB.body === 1, JSON.stringify(conteoB.body));
paso('visitante sin sesión: no puede pedir el conteo', (await rpc('mis_referidos_conteo', {})).status >= 400);

console.log('\n== Admin ==');
const admin = await crear('Admin', null, { admin: true });
const tokAdmin = await token(admin);
const arbol = await rpc('arbol_referidos', {}, tokAdmin);
const nodoC = Array.isArray(arbol.body) ? arbol.body.find((n) => n.perfil_id === C.id) : null;
paso('árbol: C aparece en el nivel 3 con la ruta A → B → C', nodoC?.nivel === 3 && nodoC?.ruta?.join() === [A.id, B.id, C.id].join(), nodoC ? `nivel ${nodoC.nivel}` : JSON.stringify(arbol.body).slice(0, 80));
const ranking = await rpc('ranking_referentes', {}, tokAdmin);
const filaA = Array.isArray(ranking.body) ? ranking.body.find((n) => n.perfil_id === A.id) : null;
paso('ranking: A tiene 1 directo y 2 en su red', filaA?.directos === 1 && filaA?.red_total === 2, filaA ? `directos ${filaA.directos}, red ${filaA.red_total}` : '');

const asignar = await rpc('admin_asignar_referente', { p_referido: D.id, p_referente: A.id, p_nota: 'Prueba: confirmado por WhatsApp' }, tokAdmin);
paso('asignar a mano el referente de un no resuelto', asignar.status < 300 && relacion(D) === `${A.id} | asignado_manual | -`, relacion(D));
const ciclo = await rpc('admin_asignar_referente', { p_referido: A.id, p_referente: C.id }, tokAdmin);
paso('impide ciclos (A no puede quedar referido por C, que está en su red)', ciclo.status >= 400 && String(ciclo.body?.message).includes('formaría un ciclo'), ciclo.body?.message);
const propio = await rpc('admin_asignar_referente', { p_referido: A.id, p_referente: A.id }, tokAdmin);
paso('impide que alguien sea su propio referente', propio.status >= 400, propio.body?.message);
const comoUsuario = await rpc('admin_asignar_referente', { p_referido: D.id, p_referente: B.id }, tokB);
paso('un usuario normal no puede asignar', comoUsuario.status >= 400 && relacion(D).startsWith(A.id));

console.log('\n== Alerta: más de 20 registros en 24 h con el mismo código ==');
const relleno = sql(`select string_agg(id::text, ',') from (select p.id from public.perfiles p
  where not exists (select 1 from public.referidos r where r.referido_id = p.id) and p.id <> '${A.id}' limit 20) x`).split(',');
sql(`insert into public.referidos (referido_id, referente_id, codigo_usado) select unnest(array['${relleno.join("','")}']::uuid[]), '${A.id}', 'relleno-prueba';`);
const G = await crear('G', `RA2${sufijo}`);
paso('el registro 21 queda marcado con alerta', relacion(G) === `${A.id} | resuelto | mas_de_20_en_24h`, relacion(G));
sql(`delete from public.referidos where codigo_usado = 'relleno-prueba';`); // solo filas sintéticas de la base local

console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
