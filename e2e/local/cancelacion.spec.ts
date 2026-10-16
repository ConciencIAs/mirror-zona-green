// Cancelar un pedido devuelve el stock (lo cancele el cliente o el admin), una
// sola vez: un pedido cancelado no se puede reactivar.
import {
  ANON,
  API,
  PRODUCTO_GRAMOS,
  PRODUCTO_UNIDADES,
  crearUsuario,
  entrar,
  expect,
  reiniciarProductos,
  sql,
  test,
  token,
  type Usuario,
} from './apoyo';

const stock = () =>
  JSON.parse(
    sql(`select json_build_object(
           'g5', (select (el->>'stock')::numeric::int from public.productos p, jsonb_array_elements(p.presentaciones) el where p.id = '${PRODUCTO_GRAMOS}' and (el->>'gramos')::int = 5),
           'gramos', (select stock_total::int from public.productos where id = '${PRODUCTO_GRAMOS}'),
           'unidades', (select stock_total::int from public.productos where id = '${PRODUCTO_UNIDADES}'))`),
  ) as { g5: number; gramos: number; unidades: number };

async function api(tok: string, ruta: string, metodo: string, cuerpo: unknown) {
  const r = await fetch(`${API}${ruta}`, {
    method: metodo,
    headers: { apikey: ANON, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

/** Pedido real por procesar_checkout: 2 paquetes de 5 g y 3 unidades. */
async function pedidoReal(cliente: Usuario): Promise<{ id: string; uid: string }> {
  sql(`insert into public.carrito (usuario_id, producto_id, cantidad, paquete_gramos) values
         ('${cliente.id}', '${PRODUCTO_GRAMOS}', 2, 5),
         ('${cliente.id}', '${PRODUCTO_UNIDADES}', 3, null);`);
  const r = await api(await token(cliente.correo), '/rest/v1/rpc/procesar_checkout', 'POST', { p_tipo_entrega: 'Envío' });
  const id = (r.cuerpo as { ordenId?: string })?.ordenId;
  if (!id) throw new Error(`El checkout falló: ${JSON.stringify(r.cuerpo)}`);
  return { id, uid: sql(`select uid from public.ordenes where id = '${id}'`) };
}

const estado = (id: string) => sql(`select status from public.ordenes where id = '${id}'`);

test.describe('Cancelar un pedido', () => {
  test.beforeEach(() => reiniciarProductos());

  test('el cliente cancela desde Mis órdenes y el stock vuelve', async ({ page }) => {
    const cliente = await crearUsuario('cancela-cliente');
    const inicial = stock();
    const pedido = await pedidoReal(cliente);
    expect(stock()).toEqual({ g5: inicial.g5 - 2, gramos: inicial.gramos - 10, unidades: inicial.unidades - 3 });

    await entrar(page, cliente.correo);
    await page.goto('/customer/orders');
    await page.getByRole('button', { name: 'Cancelar pedido' }).click();
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();

    await expect.poll(() => estado(pedido.id)).toBe('cancelado');
    expect(stock()).toEqual(inicial);
    expect(sql(`select tracking->-1->>'por' from public.ordenes where id = '${pedido.id}'`)).toBe('cliente');
    await expect(page.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0);
    await expect(page.locator('p-timeline').getByText('Cancelado')).toBeVisible();
  });

  test('el admin cancela, el stock vuelve y el pedido no se puede reactivar', async ({ page }) => {
    const cliente = await crearUsuario('cancela-admin-cliente');
    const admin = await crearUsuario('cancela-admin', { rol: 'admin', status: 'activo' });
    const inicial = stock();
    const pedido = await pedidoReal(cliente);
    sql(`update public.ordenes set status = 'aporte' where id = '${pedido.id}'`);

    await entrar(page, admin.correo);
    await page.goto('/admin/marketplace/orders');
    await page.locator('#uidOrden').fill(pedido.uid);
    const estadoSelect = page.locator('p-select[placeholder="Seleccione Estado"]').first();
    await estadoSelect.click();
    await page.getByRole('option', { name: 'Cancelado' }).click();
    await page.getByRole('button', { name: 'Guardar cambios' }).first().click();
    await page.getByRole('button', { name: 'Sí, cancelar pedido' }).click();

    await expect.poll(() => estado(pedido.id)).toBe('cancelado');
    expect(stock()).toEqual(inicial);
    await expect(page.getByText('Pedido cancelado: su stock ya volvió al inventario')).toBeVisible();
    await expect(estadoSelect).toHaveClass(/p-disabled/);

    // Ni por la API: reactivar falla y el stock no se vuelve a tocar.
    const r = await api(await token(admin.correo), `/rest/v1/ordenes?id=eq.${pedido.id}`, 'PATCH', { status: 'seleccion' });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(r.cuerpo)).toContain('no se puede reactivar');
    expect(estado(pedido.id)).toBe('cancelado');
    expect(stock()).toEqual(inicial);
  });

  test('el cliente no cancela pedidos ajenos ni pedidos que ya avanzaron', async () => {
    const duena = await crearUsuario('cancela-duena');
    const otra = await crearUsuario('cancela-otra');
    const pedido = await pedidoReal(duena);

    const ajeno = await api(await token(otra.correo), '/rest/v1/rpc/cancelar_mi_pedido', 'POST', { p_orden_id: pedido.id });
    expect(ajeno.status).toBeGreaterThanOrEqual(400);
    expect(estado(pedido.id)).toBe('seleccion');

    sql(`update public.ordenes set status = 'aporte' where id = '${pedido.id}'`);
    const avanzado = await api(await token(duena.correo), '/rest/v1/rpc/cancelar_mi_pedido', 'POST', { p_orden_id: pedido.id });
    expect(avanzado.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(avanzado.cuerpo)).toContain('ya no se puede cancelar');
    expect(estado(pedido.id)).toBe('aporte');

    const anonimo = await api(ANON, '/rest/v1/rpc/cancelar_mi_pedido', 'POST', { p_orden_id: pedido.id });
    expect(anonimo.status).toBeGreaterThanOrEqual(400);
    sql(`update public.ordenes set status = 'cancelado' where id = '${pedido.id}'`);
  });
});
