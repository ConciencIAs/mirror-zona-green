// Prueba 4 — Matriz de permisos: cada tipo de usuario contra cada tabla y
// función de la base, por la misma API que usa la app. Si un cambio futuro abre
// un permiso por error (como los que encontró la auditoría), esta prueba falla.
import {
  ANON,
  API,
  PRODUCTO_UNIDADES,
  crearUsuario,
  expect,
  reiniciarProductos,
  sql,
  test,
  token,
  type Usuario,
} from './apoyo';

type Perfil = 'visitante' | 'inactivo' | 'activo' | 'bloqueado' | 'agente' | 'admin';
const PERFILES: Perfil[] = ['visitante', 'inactivo', 'activo', 'bloqueado', 'agente', 'admin'];

interface Actor {
  perfil: Perfil;
  usuario?: Usuario;
  tok: string;
}
const actores = new Map<Perfil, Actor>();

async function api(actor: Actor, ruta: string, opciones: { method?: string; body?: unknown; prefer?: string; tipo?: string } = {}) {
  const r = await fetch(`${API}${ruta}`, {
    method: opciones.method ?? 'GET',
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${actor.tok}`,
      'Content-Type': opciones.tipo ?? 'application/json',
      ...(opciones.prefer ? { Prefer: opciones.prefer } : {}),
    },
    body: opciones.body === undefined ? undefined : typeof opciones.body === 'string' ? opciones.body : JSON.stringify(opciones.body),
  });
  const texto = await r.text();
  let cuerpo: unknown = texto;
  try { cuerpo = JSON.parse(texto); } catch { /* texto plano */ }
  return { status: r.status, cuerpo };
}
const filas = (c: unknown) => (Array.isArray(c) ? c.length : -1);

/** Corre `puede` para cada perfil y compara con lo esperado (true = permitido). */
async function matriz(esperado: Record<Perfil, boolean>, puede: (a: Actor) => Promise<boolean>) {
  const obtenido = {} as Record<Perfil, boolean>;
  for (const p of PERFILES) obtenido[p] = await puede(actores.get(p)!);
  expect(obtenido).toEqual(esperado);
}
const SOLO_ADMIN = { visitante: false, inactivo: false, activo: false, bloqueado: false, agente: false, admin: true };
const STAFF = { visitante: false, inactivo: false, activo: false, bloqueado: false, agente: true, admin: true };
const NADIE = { visitante: false, inactivo: false, activo: false, bloqueado: false, agente: false, admin: false };
const TODOS = { visitante: true, inactivo: true, activo: true, bloqueado: true, agente: true, admin: true };
const CON_SESION = { visitante: false, inactivo: true, activo: true, bloqueado: true, agente: true, admin: true };

let ajeno: Usuario;
let ordenAjena: string;

test.describe('Matriz de permisos', () => {
  test.beforeAll(async () => {
    reiniciarProductos();
    actores.set('visitante', { perfil: 'visitante', tok: ANON });
    const config: [Perfil, Parameters<typeof crearUsuario>[1]][] = [
      ['inactivo', { status: 'inactivo' }],
      ['activo', { status: 'activo' }],
      ['bloqueado', { status: 'bloqueado' }],
      ['agente', { rol: 'agente', status: 'activo' }],
      ['admin', { rol: 'admin', status: 'activo' }],
    ];
    for (const [perfil, opciones] of config) {
      const usuario = await crearUsuario(`perm-${perfil}`, opciones);
      actores.set(perfil, { perfil, usuario, tok: await token(usuario.correo) });
    }
    // Un cliente "ajeno" con un pedido, para probar el acceso a datos de otros.
    ajeno = await crearUsuario('perm-ajeno');
    ordenAjena = sql(`insert into public.ordenes (usuario_id, lista_productos, precio_total, status, correo_cliente)
                      values ('${ajeno.id}', '[]', 1000, 'seleccion', '${ajeno.correo}') returning id`).split('\n')[0];
  });

  test.afterAll(() => {
    sql(`delete from public.ordenes where id = '${ordenAjena}';`);
    reiniciarProductos();
  });

  test('productos activos: todos los ven', () =>
    matriz(TODOS, async (a) => filas((await api(a, `/rest/v1/productos?select=id&id=eq.${PRODUCTO_UNIDADES}`)).cuerpo) === 1));

  test('productos inactivos: solo los ve el staff', async () => {
    sql(`update public.productos set status = 'inactivo' where id = '${PRODUCTO_UNIDADES}';`);
    try {
      await matriz(STAFF, async (a) => filas((await api(a, `/rest/v1/productos?select=id&id=eq.${PRODUCTO_UNIDADES}`)).cuerpo) === 1);
    } finally {
      reiniciarProductos();
    }
  });

  test('costo de productos por la API: nadie (ni el admin)', () =>
    matriz(NADIE, async (a) => (await api(a, '/rest/v1/productos?select=costo&limit=1')).status === 200));

  test('costo de productos por admin_costos_productos: solo admin', () =>
    matriz(SOLO_ADMIN, async (a) => (await api(a, '/rest/v1/rpc/admin_costos_productos', { method: 'POST', body: {} })).status === 200));

  test('cambiar el precio de un producto: solo admin', async () => {
    try {
      await matriz(SOLO_ADMIN, async (a) => {
        // Sin pedir la fila de vuelta: el costo ya no es legible por la API (Fase 0).
        await api(a, `/rest/v1/productos?id=eq.${PRODUCTO_UNIDADES}`, { method: 'PATCH', body: { precio: 1 } });
        const cambio = Number(sql(`select precio from public.productos where id = '${PRODUCTO_UNIDADES}'`)) === 1;
        if (cambio) reiniciarProductos();
        return cambio;
      });
    } finally {
      reiniciarProductos();
    }
  });

  test('correos de usuarios_publicos: solo staff', () =>
    matriz(STAFF, async (a) => filas((await api(a, '/rest/v1/usuarios_publicos?select=correo&limit=5')).cuerpo) > 0));

  test('perfiles de otras personas: solo staff', () =>
    matriz(STAFF, async (a) => filas((await api(a, `/rest/v1/perfiles?select=id&id=eq.${ajeno.id}`)).cuerpo) === 1));

  test('nadie puede ascenderse a admin desde su perfil', () =>
    matriz(NADIE, async (a) => {
      if (!a.usuario || a.perfil === 'admin') return false;
      await api(a, `/rest/v1/perfiles?id=eq.${a.usuario.id}`, { method: 'PATCH', body: { rol: 'admin', status: 'activo' } });
      return sql(`select rol from public.perfiles where id = '${a.usuario.id}'`) === 'admin';
    }));

  test('pedidos de otras personas: solo staff los ve', () =>
    matriz(STAFF, async (a) => filas((await api(a, `/rest/v1/ordenes?select=id&id=eq.${ordenAjena}`)).cuerpo) === 1));

  test('cambiar el estado de un pedido: solo staff', () =>
    matriz(STAFF, async (a) => {
      sql(`update public.ordenes set status = 'seleccion' where id = '${ordenAjena}';`);
      await api(a, `/rest/v1/ordenes?id=eq.${ordenAjena}`, { method: 'PATCH', body: { status: 'aporte' } });
      return sql(`select status from public.ordenes where id = '${ordenAjena}'`) === 'aporte';
    }));

  test('crear un pedido saltándose el checkout: nadie', () =>
    matriz(NADIE, async (a) => {
      const r = await api(a, '/rest/v1/ordenes', {
        method: 'POST',
        body: { usuario_id: a.usuario?.id ?? ajeno.id, lista_productos: [], precio_total: 0, status: 'aporte' },
      });
      return r.status === 201;
    }));

  test('agregar a su propio carrito: solo usuarios activos', () =>
    matriz({ visitante: false, inactivo: false, activo: true, bloqueado: false, agente: true, admin: true }, async (a) => {
      if (!a.usuario) return (await api(a, '/rest/v1/carrito', { method: 'POST', body: { usuario_id: ajeno.id, producto_id: PRODUCTO_UNIDADES, cantidad: 1 } })).status === 201;
      const r = await api(a, '/rest/v1/carrito', { method: 'POST', body: { usuario_id: a.usuario.id, producto_id: PRODUCTO_UNIDADES, cantidad: 1 } });
      sql(`delete from public.carrito where usuario_id = '${a.usuario.id}';`);
      return r.status === 201;
    }));

  test('agregar al carrito de otra persona: nadie', () =>
    matriz(NADIE, async (a) => {
      const r = await api(a, '/rest/v1/carrito', { method: 'POST', body: { usuario_id: ajeno.id, producto_id: PRODUCTO_UNIDADES, cantidad: 1 } });
      sql(`delete from public.carrito where usuario_id = '${ajeno.id}';`);
      return r.status === 201;
    }));

  test('cantidad negativa en el carrito: nadie', () =>
    matriz(NADIE, async (a) => {
      if (!a.usuario) return false;
      const r = await api(a, '/rest/v1/carrito', { method: 'POST', body: { usuario_id: a.usuario.id, producto_id: PRODUCTO_UNIDADES, cantidad: -1 } });
      sql(`delete from public.carrito where usuario_id = '${a.usuario.id}';`);
      return r.status === 201;
    }));

  test('confirmar un pedido (procesar_checkout): necesita sesión', () =>
    matriz(CON_SESION, async (a) => (await api(a, '/rest/v1/rpc/procesar_checkout', { method: 'POST', body: {} })).status === 200));

  test('árbol de referidos: solo admin', () =>
    matriz(SOLO_ADMIN, async (a) => (await api(a, '/rest/v1/rpc/arbol_referidos', { method: 'POST', body: {} })).status === 200));

  test('tabla de referidos: solo admin la lee', () => {
    sql(`insert into public.referidos (referido_id, codigo_usado, estado) values ('${ajeno.id}', 'PERMISOS', 'no_resuelto') on conflict do nothing;`);
    return matriz(SOLO_ADMIN, async (a) => filas((await api(a, `/rest/v1/referidos?select=referido_id&referido_id=eq.${ajeno.id}`)).cuerpo) === 1);
  });

  test('base de confianza: solo admin', () =>
    matriz(SOLO_ADMIN, async (a) => filas((await api(a, '/rest/v1/base_confianza?select=telefono&limit=1')).cuerpo) === 1));

  test('roles: solo con sesión', () =>
    matriz(CON_SESION, async (a) => filas((await api(a, '/rest/v1/roles?select=nombre')).cuerpo) > 0));

  test('editar el menú (page_config): solo admin', () =>
    matriz(SOLO_ADMIN, async (a) => {
      const antes = sql(`select content::text from public.page_config where config_name = 'footer'`);
      const r = await api(a, '/rest/v1/page_config?config_name=eq.footer', { method: 'PATCH', body: { content: JSON.parse(antes) }, prefer: 'return=representation' });
      return filas(r.cuerpo) === 1;
    }));

  test('saber si un correo existe (existe_correo): todos, sin datos personales', () =>
    matriz(TODOS, async (a) => {
      const r = await api(a, '/rest/v1/rpc/existe_correo', { method: 'POST', body: { p_correo: ajeno.correo } });
      return r.status === 200 && r.cuerpo === true;
    }));

  test('subir imágenes de productos: solo staff', () =>
    matriz(STAFF, async (a) => {
      const nombre = `e2e-permisos-${a.perfil}-${Date.now()}.txt`;
      const r = await api(a, `/storage/v1/object/productos/${nombre}`, { method: 'POST', body: 'prueba', tipo: 'text/plain' });
      // Limpieza por la API de almacenamiento (la base no permite borrar archivos por SQL).
      if (r.status === 200) await api(a, `/storage/v1/object/productos/${nombre}`, { method: 'DELETE' });
      return r.status === 200;
    }));
});
