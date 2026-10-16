// Fase 3b — 10 compras simultáneas del mismo producto por gramos, en sus
// distintas presentaciones, contra el Supabase LOCAL (nunca producción).
//
// Camino real: carrito en la base → Edge Function create-order → RPC
// procesar_checkout con la sesión de cada usuario.
//
// Requiere: npx supabase start, npx supabase functions serve, y los productos
// sintéticos de 01_local_auth_storage_datos_sinteticos.sql.
// Uso: node supabase/pruebas/concurrencia-compras.mjs [rondas=5] [archivo-resultados.json]
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { celularUnico } from './_comun.mjs';

const status = JSON.parse(execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)[0]);
const API = status.API_URL;
const ANON = status.PUBLISHABLE_KEY || status.ANON_KEY;
if (!API.startsWith('http://127.0.0.1') && !API.startsWith('http://localhost')) {
  throw new Error('Esta prueba solo corre contra el Supabase local.');
}
const RONDAS = Number(process.argv[2] || 5);
const SALIDA = process.argv[3];
const sql = (q) =>
  execSync('docker exec -i supabase_db_Cheyn_Verde psql -U postgres -d postgres -At -v ON_ERROR_STOP=1', { input: q, encoding: 'utf8' }).trim();
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const GRAMOS = '00000000-0000-4000-8000-000000000001'; // "PRUEBA material seleccionado"
const UNIDADES = '00000000-0000-4000-8000-000000000002';
const PRESENTACIONES = [
  { gramos: 5, precio: 20000, stock: 4 },
  { gramos: 10, precio: 38000, stock: 3 },
  { gramos: 20, precio: 70000, stock: 2 },
  { gramos: 40, precio: 130000, stock: 1 },
];
const STOCK_GRAMOS = PRESENTACIONES.reduce((t, p) => t + p.gramos * p.stock, 0); // 130
const STOCK_UNIDADES = 10;
const PRECIO_UNIDADES = 10000;

// Carrito de cada uno de los 10 compradores. El orden de las filas importa:
// U3 y U7 tienen los dos productos en orden inverso (provoca bloqueo mutuo si
// la base no bloquea siempre en el mismo orden).
const CARRITOS = [
  [{ p: GRAMOS, g: 5, c: 1 }],
  [{ p: GRAMOS, g: 5, c: 1 }],
  [{ p: GRAMOS, g: 5, c: 1 }, { p: UNIDADES, g: null, c: 1 }],
  [{ p: GRAMOS, g: 5, c: 1 }],
  [{ p: GRAMOS, g: 5, c: 1 }],
  [{ p: GRAMOS, g: 10, c: 1 }],
  [{ p: UNIDADES, g: null, c: 1 }, { p: GRAMOS, g: 10, c: 1 }],
  [{ p: GRAMOS, g: 10, c: 1 }],
  [{ p: GRAMOS, g: 20, c: 2 }],
  [{ p: GRAMOS, g: 20, c: 1 }, { p: GRAMOS, g: 40, c: 1 }],
];

function preparar() {
  sql(`update public.productos set status = 'activo', deleted_at = null, es_por_gramos = true,
         presentaciones = '${JSON.stringify(PRESENTACIONES)}'::jsonb, stock_total = ${STOCK_GRAMOS}
       where id = '${GRAMOS}';
       update public.productos set status = 'activo', deleted_at = null, es_por_gramos = false,
         stock_total = ${STOCK_UNIDADES}, precio = ${PRECIO_UNIDADES}
       where id = '${UNIDADES}';
       delete from public.ordenes where comentarios_usuario like 'concurrencia-%';`);
}

const t = Date.now();
const password = 'Prueba-12345';
async function crearComprador(i) {
  const correo = `prueba.conc${i}.${t}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: correo, password, data: { full_name: `Comprador ${i}`, telefono: celularUnico(), fecha_nacimiento: '1990-01-01' } }),
  });
  const id = (await r.json()).id;
  sql(`update auth.users set email_confirmed_at = now() where id = '${id}';
       update public.perfiles set status = 'activo' where id = '${id}';`);
  await espera(400);
  const tok = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password }),
  }).then((x) => x.json());
  if (!tok.access_token) throw new Error(`No se pudo iniciar sesión con ${correo}: ${JSON.stringify(tok).slice(0, 120)}`);
  return { i, id, correo, token: tok.access_token };
}

function llenarCarrito(u, items) {
  sql(`delete from public.carrito where usuario_id = '${u.id}';`);
  // Una fila por vez para respetar el orden de inserción.
  for (const it of items) {
    sql(`insert into public.carrito (usuario_id, producto_id, cantidad, paquete_gramos)
         values ('${u.id}', '${it.p}', ${it.c}, ${it.g === null ? 'null' : it.g});`);
  }
}

async function confirmar(u, ronda) {
  const inicio = performance.now();
  const r = await fetch(`${API}/functions/v1/create-order`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ datosEntrega: { tipo_entrega: 'Envío', comentarios: `concurrencia-r${ronda}-u${u.i}`, direccion: 'Local' } }),
  });
  const body = await r.json().catch(() => ({}));
  return { u: u.i, status: r.status, ms: Math.round(performance.now() - inicio), body };
}

function estado() {
  const prod = JSON.parse(sql(`select json_build_object('pres', presentaciones, 'total', stock_total) from public.productos where id = '${GRAMOS}'`));
  const unidades = Number(sql(`select stock_total from public.productos where id = '${UNIDADES}'`));
  return { pres: prod.pres, total: Number(prod.total), unidades };
}

async function ronda(n, compradores) {
  preparar();
  compradores.forEach((u, k) => llenarCarrito(u, CARRITOS[k]));
  // Todos a la vez.
  const resultados = await Promise.all(compradores.map((u) => confirmar(u, n)));
  const fin = estado();

  // Lo que dicen los pedidos creados.
  const ordenes = JSON.parse(sql(`select coalesce(json_agg(json_build_object('total', precio_total, 'items', lista_productos, 'c', comentarios_usuario)), '[]') from public.ordenes where comentarios_usuario like 'concurrencia-r${n}-%'`));
  const vendidos = Object.fromEntries(PRESENTACIONES.map((p) => [p.gramos, 0]));
  let unidadesVendidas = 0, gramosVendidos = 0, totalesOk = true;
  for (const o of ordenes) {
    let suma = 0;
    for (const it of o.items) {
      suma += Number(it.subtotal);
      if (it.es_por_gramos) { vendidos[it.paquete_gramos] += Number(it.cantidad_comprada); gramosVendidos += Number(it.total_gramos_entregados); }
      else unidadesVendidas += Number(it.cantidad_comprada);
      const precioEsperado = it.es_por_gramos ? PRESENTACIONES.find((p) => p.gramos === Number(it.paquete_gramos)).precio : PRECIO_UNIDADES;
      if (Number(it.precio_unitario) !== precioEsperado) totalesOk = false;
    }
    if (Math.abs(suma - Number(o.total)) > 0.001) totalesOk = false;
  }

  const exitos = resultados.filter((r) => r.status === 201);
  const fallos = resultados.filter((r) => r.status !== 201);
  const deadlocks = fallos.filter((r) => /deadlock/i.test(JSON.stringify(r.body)));
  const presFinal = Object.fromEntries(fin.pres.map((p) => [p.gramos, Number(p.stock)]));
  const chequeos = {
    sin_stock_negativo: fin.pres.every((p) => Number(p.stock) >= 0) && fin.total >= 0 && fin.unidades >= 0,
    stock_cuadra_por_presentacion: PRESENTACIONES.every((p) => p.stock - vendidos[p.gramos] === presFinal[p.gramos]),
    stock_total_cuadra: STOCK_GRAMOS - gramosVendidos === fin.total,
    unidades_cuadran: STOCK_UNIDADES - unidadesVendidas === fin.unidades,
    pedidos_igual_a_exitos: ordenes.length === exitos.length,
    precios_y_totales_correctos: totalesOk,
    no_se_vende_de_mas: PRESENTACIONES.every((p) => vendidos[p.gramos] <= p.stock),
    fallos_con_mensaje_claro: fallos.every((r) => /Stock insuficiente|Quedan/i.test(JSON.stringify(r.body)) || /deadlock/i.test(JSON.stringify(r.body))),
    carritos_ok: compradores.every((u) => {
      const filas = Number(sql(`select count(*) from public.carrito where usuario_id = '${u.id}'`));
      return exitos.some((e) => e.u === u.i) ? filas === 0 : filas === CARRITOS[u.i - 1].length;
    }),
  };
  const tiempos = resultados.map((r) => r.ms).sort((a, b) => a - b);
  return {
    ronda: n,
    exitos: exitos.length,
    fallos: fallos.length,
    deadlocks: deadlocks.length,
    vendidos,
    stock_final: presFinal,
    gramos_vendidos: gramosVendidos,
    unidades_vendidas: unidadesVendidas,
    ms_min: tiempos[0],
    ms_mediana: tiempos[Math.floor(tiempos.length / 2)],
    ms_max: tiempos[tiempos.length - 1],
    chequeos,
    detalle: resultados.map((r) => ({ u: r.u, status: r.status, ms: r.ms, msg: r.body?.error ?? (r.body?.success ? `ok total ${r.body.total}` : JSON.stringify(r.body).slice(0, 80)) })),
  };
}

const compradores = [];
for (let i = 1; i <= 10; i++) compradores.push(await crearComprador(i));
console.log(`10 compradores locales listos (prueba.conc*.${t}@cheyn.test). Rondas: ${RONDAS}\n`);

const informe = [];
for (let n = 1; n <= RONDAS; n++) {
  const r = await ronda(n, compradores);
  informe.push(r);
  const malos = Object.entries(r.chequeos).filter(([, ok]) => !ok).map(([k]) => k);
  console.log(`Ronda ${n}: ${r.exitos} pedidos, ${r.fallos} rechazados (${r.deadlocks} deadlock) | vendidos 5g:${r.vendidos[5]} 10g:${r.vendidos[10]} 20g:${r.vendidos[20]} 40g:${r.vendidos[40]} | ${r.ms_min}-${r.ms_max} ms (mediana ${r.ms_mediana}) | ${malos.length ? 'FALLA: ' + malos.join(', ') : 'invariantes OK'}`);
}
preparar(); // deja el stock sintético como estaba

const fallasTotales = informe.flatMap((r) => Object.entries(r.chequeos).filter(([, ok]) => !ok));
const deadlocksTotales = informe.reduce((t, r) => t + r.deadlocks, 0);
console.log(`\nDeadlocks en total: ${deadlocksTotales}`);
console.log(fallasTotales.length ? `\n${fallasTotales.length} INVARIANTE(S) ROTA(S)` : '\nTodas las invariantes se cumplieron en todas las rondas');
if (SALIDA) writeFileSync(SALIDA, JSON.stringify({ fecha: new Date().toISOString(), rondas: RONDAS, informe }, null, 2));
process.exit(fallasTotales.length ? 1 : 0);
