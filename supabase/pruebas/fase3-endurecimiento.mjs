// Prueba de la Fase 3 (endurecimiento) contra el Supabase LOCAL, por API.
// Requiere 20261016150000_fase3_endurecimiento.sql y la pendiente
// 20261016150100_fase3_edad_minima.sql aplicadas en la base local, y los
// productos sintéticos de 01_local_auth_storage_datos_sinteticos.sql.
// Uso: node supabase/pruebas/fase3-endurecimiento.mjs
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

const PRODUCTO_UNIDADES = '00000000-0000-4000-8000-000000000002';
const PRODUCTO_GRAMOS = '00000000-0000-4000-8000-000000000001';
const t = Date.now();
const password = 'Prueba-12345';
const creados = [];

async function signup(nombre, extra = {}) {
  const correo = `prueba.f3.${nombre}.${t}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: `F3 ${nombre}`, telefono: celularUnico(), fecha_nacimiento: '1990-05-05', ...extra } }),
  });
  const body = await r.json();
  await espera(1100);
  return { status: r.status, correo, id: body.id ?? body.user?.id, body };
}
async function usuarioActivo(nombre) {
  const u = await signup(nombre);
  creados.push(u.correo);
  sql(`update auth.users set email_confirmed_at = now() where id = '${u.id}';
       update public.perfiles set status = 'activo' where id = '${u.id}';`);
  const tok = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.correo, password }),
  }).then((r) => r.json());
  return { ...u, token: tok.access_token };
}
async function rest(path, { method = 'GET', body, token, prefer } = {}) {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: r.status, body: json };
}
const agregar = (u, producto, cantidad, paquete = null) =>
  rest('/rest/v1/carrito', { method: 'POST', token: u.token, body: { usuario_id: u.id, producto_id: producto, cantidad, paquete_gramos: paquete } });
const checkout = (u) => rest('/rest/v1/rpc/procesar_checkout', { method: 'POST', token: u.token, body: { p_tipo_entrega: 'Envío', p_comentarios: 'prueba fase 3', p_direccion: 'Calle falsa 123' } });

// Stock conocido para la prueba.
sql(`update public.productos set stock_total = 5, status = 'activo', deleted_at = null where id = '${PRODUCTO_UNIDADES}';`);

console.log('\n== Carrito ==');
const ana = await usuarioActivo('ana');
for (const [cant, nombre] of [[-1, 'negativa'], [0, 'cero'], [0.5, 'fraccionaria']]) {
  const r = await agregar(ana, PRODUCTO_UNIDADES, cant);
  paso(`cantidad ${nombre} (${cant}): la base la rechaza`, r.status >= 400, `HTTP ${r.status} ${String(r.body?.message ?? '').slice(0, 50)}`);
}
const okCarrito = await agregar(ana, PRODUCTO_UNIDADES, 2);
paso('cantidad entera positiva: se acepta', okCarrito.status === 201, `HTTP ${okCarrito.status}`);

console.log('\n== Pedido ==');
const stockAntes = Number(sql(`select stock_total from public.productos where id = '${PRODUCTO_UNIDADES}'`));
const pedido = await checkout(ana);
const stockDespues = Number(sql(`select stock_total from public.productos where id = '${PRODUCTO_UNIDADES}'`));
paso('pedido normal: se crea con el total correcto', pedido.body?.success === true && Number(pedido.body?.total) === 20000, JSON.stringify(pedido.body).slice(0, 90));
paso('  → descuenta el stock (5 → 3)', stockAntes - stockDespues === 2, `${stockAntes} → ${stockDespues}`);
paso('  → no toca "reservado"', sql(`select coalesce(reservado,0) from public.productos where id = '${PRODUCTO_UNIDADES}'`) === '0');

const beto = await usuarioActivo('beto');
await agregar(beto, PRODUCTO_UNIDADES, 1);
sql(`update public.perfiles set status = 'bloqueado' where id = '${beto.id}';`);
const bloqueado = await checkout(beto);
paso('usuario bloqueado con carrito lleno: no puede pedir', bloqueado.body?.success === false && String(bloqueado.body?.error).includes('no está habilitada'), JSON.stringify(bloqueado.body).slice(0, 90));
const anon = await rest('/rest/v1/rpc/procesar_checkout', { method: 'POST', body: {} });
paso('visitante sin sesión: no puede llamar procesar_checkout', anon.status >= 400, `HTTP ${anon.status}`);

// Con cantidad negativa colada directo en la base (como si viniera de antes), el pedido también la rechaza.
const caro = await usuarioActivo('caro');
sql(`alter table public.carrito drop constraint carrito_cantidad_valida;
     insert into public.carrito (usuario_id, producto_id, cantidad) values ('${caro.id}', '${PRODUCTO_UNIDADES}', -3);`);
const negativo = await checkout(caro);
sql(`delete from public.carrito where usuario_id = '${caro.id}';
     alter table public.carrito add constraint carrito_cantidad_valida check (cantidad > 0 and cantidad = trunc(cantidad));`);
paso('procesar_checkout también rechaza una cantidad negativa', negativo.body?.success === false && String(negativo.body?.error).includes('Cantidad no válida'), JSON.stringify(negativo.body).slice(0, 80));

console.log('\n== Perfil ==');
const antes = sql(`select concat_ws('|', correo, created_at, coalesce(deleted_at::text,'-'), datos_adicionales::text) from public.perfiles where id = '${ana.id}'`);
const intento = await rest(`/rest/v1/perfiles?id=eq.${ana.id}`, {
  method: 'PATCH', token: ana.token,
  body: { correo: 'otro@cheyn.test', created_at: '2020-01-01T00:00:00Z', deleted_at: '2026-01-01T00:00:00Z', datos_adicionales: { acepta_terminos: false }, full_name: 'F3 Ana editada' },
});
const despues = sql(`select concat_ws('|', correo, created_at, coalesce(deleted_at::text,'-'), datos_adicionales::text) from public.perfiles where id = '${ana.id}'`);
paso('el usuario no puede cambiar correo, created_at, deleted_at ni datos_adicionales', intento.status < 300 && antes === despues);
paso('  → pero sí su nombre', sql(`select full_name from public.perfiles where id = '${ana.id}'`) === 'F3 Ana editada');
const insertAdmin = await rest('/rest/v1/perfiles', { method: 'POST', token: ana.token, body: { id: ana.id, correo: ana.correo, rol: 'admin', status: 'activo' } });
paso('crear su propio perfil como admin: lo rechaza la política', insertAdmin.status === 403 || String(insertAdmin.body?.message).includes('row-level security'), `HTTP ${insertAdmin.status}`);

console.log('\n== Calificaciones ==');
const resena = await rest('/rest/v1/product_reviews', { method: 'POST', token: ana.token, body: { product_id: PRODUCTO_UNIDADES, user_id: ana.id, rating: 4, comment: 'prueba fase 3' } });
const rating = sql(`select concat_ws('|', rating_count, rating_average) from public.productos where id = '${PRODUCTO_UNIDADES}'`);
paso('una reseña de cliente actualiza la calificación del producto', resena.status === 201 && rating.startsWith('1|4'), `HTTP ${resena.status}, productos: ${rating}`);
sql(`delete from public.product_reviews where comment = 'prueba fase 3';`);

console.log('\n== Edad mínima ==');
const hoy = new Date().toISOString().slice(0, 10);
const menor = await signup('menor', { fecha_nacimiento: hoy });
// Supabase Auth no reenvía el mensaje del trigger ("Database error saving new user");
// el formulario valida la edad antes de enviar, así que la persona ve el mensaje claro.
paso('registro con fecha de hoy: rechazado por la base', menor.status >= 400, `HTTP ${menor.status} ${String(menor.body?.msg ?? '').slice(0, 60)}`);
paso('  → no se creó la cuenta', sql(`select count(*) from auth.users where email = '${menor.correo}'`) === '0');
const cambio = await rest(`/rest/v1/perfiles?id=eq.${ana.id}`, { method: 'PATCH', token: ana.token, body: { fecha_nacimiento: hoy } });
paso('cambiar la fecha a una de menor de edad: rechazado', cambio.status >= 400, `HTTP ${cambio.status}`);
const mismo = await rest(`/rest/v1/perfiles?id=eq.${ana.id}`, { method: 'PATCH', token: ana.token, body: { fecha_nacimiento: '1990-05-05', ubicacion: 'Medellín' } });
paso('guardar con la misma fecha válida: permitido', mismo.status < 300);
const viejo = await usuarioActivo('viejo');
// Perfil existente con fecha mala: se prepara sin triggers (la regla nueva lo impediría).
sql(`begin; set local session_replication_role = replica;
     update public.perfiles set fecha_nacimiento = current_date where id = '${viejo.id}'; commit;`);
const otroCampo = await rest(`/rest/v1/perfiles?id=eq.${viejo.id}`, { method: 'PATCH', token: viejo.token, body: { ubicacion: 'Cali' } });
paso('perfil existente con fecha mala: puede guardar otros campos', otroCampo.status < 300 && sql(`select ubicacion from public.perfiles where id = '${viejo.id}'`) === 'Cali');

console.log('\n== "Reservado" ==');
sql(`update public.productos set reservado = 7 where id = '${PRODUCTO_GRAMOS}';`);
execSync('docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q', {
  input: (await import('node:fs')).readFileSync('supabase/migrations/20261016150000_fase3_endurecimiento.sql', 'utf8'), encoding: 'utf8',
});
paso('la migración respalda el valor anterior y lo pone en 0',
  sql(`select reservado from public.respaldo_fase3_reservado where producto_id = '${PRODUCTO_GRAMOS}'`) === '7' &&
  sql(`select reservado from public.productos where id = '${PRODUCTO_GRAMOS}'`) === '0');
sql(`delete from public.respaldo_fase3_reservado where producto_id = '${PRODUCTO_GRAMOS}';`);

// Limpieza: el pedido de prueba no debe afectar otras pruebas (p. ej. las métricas).
sql(`delete from public.ordenes where comentarios_usuario = 'prueba fase 3';
     update public.productos set stock_total = 5 where id = '${PRODUCTO_UNIDADES}';`);

console.log(`\nCuentas locales creadas: ${creados.join(', ')}`);
console.log(fallas ? `\n${fallas} FALLA(S)` : '\nTodo OK');
process.exit(fallas ? 1 : 0);
