// Prueba 1 — Compra de punta a punta, como la haría un cliente:
// selección → detalle → Reservar → carrito → checkout → pedido → WhatsApp →
// Mis órdenes. Verifica también la base: pedido, totales, stock y carrito.
import {
  PRODUCTO_GRAMOS,
  PRODUCTO_UNIDADES,
  crearUsuario,
  entrar,
  expect,
  precio,
  reiniciarProductos,
  sql,
  test,
} from './apoyo';

const stock = () =>
  JSON.parse(
    sql(`select json_build_object(
           'g5', (select (el->>'stock')::numeric::int from public.productos p, jsonb_array_elements(p.presentaciones) el where p.id = '${PRODUCTO_GRAMOS}' and (el->>'gramos')::int = 5),
           'g10', (select (el->>'stock')::numeric::int from public.productos p, jsonb_array_elements(p.presentaciones) el where p.id = '${PRODUCTO_GRAMOS}' and (el->>'gramos')::int = 10),
           'gramos', (select stock_total from public.productos where id = '${PRODUCTO_GRAMOS}'),
           'unidades', (select stock_total from public.productos where id = '${PRODUCTO_UNIDADES}'))`),
  ) as { g5: number; g10: number; gramos: number; unidades: number };

test.describe('Compra de un cliente', () => {
  test.beforeEach(() => reiniciarProductos());

  test('de punta a punta: reservar, carrito, checkout, WhatsApp y Mis órdenes', async ({ page }) => {
    const cliente = await crearUsuario('compra');
    await entrar(page, cliente.correo);

    // 1. Detalle del producto por gramos: 2 paquetes de 5 g y 1 de 10 g.
    await page.goto('/seleccion');
    await page.getByRole('link', { name: 'PRUEBA material seleccionado' }).first().click();
    await expect(page).toHaveURL(new RegExp(`product-details/${PRODUCTO_GRAMOS}`));
    await page.getByRole('button', { name: precio(20000) }).click(); // presentación de 5 g
    await page.getByPlaceholder('Ingresar cantidad').fill('2');
    await page.getByPlaceholder('Ingresar cantidad').press('Tab');
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByRole('button', { name: 'Reservar' })).toBeEnabled();
    await page.getByRole('button', { name: precio(38000) }).click(); // presentación de 10 g
    await page.getByPlaceholder('Ingresar cantidad').fill('1');
    await page.getByPlaceholder('Ingresar cantidad').press('Tab');
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByRole('button', { name: 'Reservar' })).toBeEnabled();

    // 2. Producto por unidades desde la tarjeta del catálogo: Reservar y luego +1.
    await page.goto('/seleccion');
    const tarjeta = page.locator('app-product-card, el-product-card', { hasText: 'PRUEBA producto por unidades' }).first();
    await tarjeta.getByRole('button', { name: 'Reservar' }).click();
    await expect(tarjeta.locator('button:has(.pi-plus)')).toBeVisible();
    await tarjeta.locator('button:has(.pi-plus)').click();
    await expect(tarjeta.getByText('2', { exact: true })).toBeVisible();
    // El carrito se guarda en segundo plano: se espera a que llegue a la base.
    await expect
      .poll(() => sql(`select coalesce(sum(cantidad), 0)::int from public.carrito where usuario_id = '${cliente.id}' and producto_id = '${PRODUCTO_UNIDADES}'`))
      .toBe('2');

    // 3. Carrito: 3 líneas, total correcto; se quita la de 10 g.
    await page.goto('/seleccion/carrito');
    const lineas = page.getByRole('button', { name: 'Eliminar' });
    await expect(lineas).toHaveCount(3);
    const total = 2 * 20000 + 38000 + 2 * 10000;
    await expect(page.getByText(precio(total)).last()).toBeVisible();
    const linea10g = page.locator('div.grid', { hasText: precio(38000) }).last();
    await linea10g.getByRole('button', { name: 'Eliminar' }).click();
    await expect(lineas).toHaveCount(2);
    await expect(page.getByText(precio(total - 38000)).last()).toBeVisible();
    expect(Number(sql(`select count(*) from public.carrito where usuario_id = '${cliente.id}'`))).toBe(2);

    // 4. Checkout: envío a domicilio y confirmación.
    const antes = stock();
    await page.getByRole('button', { name: 'Confirmar selección' }).click();
    await expect(page).toHaveURL(/\/seleccion\/checkout/);
    await page.getByText('Envío a domicilio').click();
    await page.locator('#direccion').fill('Calle de prueba 123');
    await page.locator('#comentarios').fill('e2e: compra de punta a punta');
    await page.getByRole('button', { name: 'Confirmar seleccion' }).click();
    await expect(page).toHaveURL(/\/customer\/orders/);

    // 5. La base: un pedido con el total y los productos correctos; stock descontado; carrito vacío.
    const pedido = JSON.parse(
      sql(`select json_build_object('id', id, 'uid', uid, 'total', precio_total, 'status', status, 'items', jsonb_array_length(lista_productos))
           from public.ordenes where usuario_id = '${cliente.id}'`),
    ) as { id: string; uid: string | null; total: number; status: string; items: number };
    expect(pedido.total).toBe(60000);
    expect(pedido.items).toBe(2);
    expect(pedido.status).toBe('seleccion');
    const despues = stock();
    expect(despues.g5).toBe(antes.g5 - 2);
    expect(despues.g10).toBe(antes.g10);
    expect(despues.gramos).toBe(antes.gramos - 10);
    expect(despues.unidades).toBe(antes.unidades - 2);
    expect(Number(sql(`select count(*) from public.carrito where usuario_id = '${cliente.id}'`))).toBe(0);

    // 6. WhatsApp con el número de orden y el total; Mis órdenes muestra el pedido.
    const urls = await page.evaluate(() => (window as unknown as { __urlsAbiertas: string[] }).__urlsAbiertas);
    const whatsapp = decodeURIComponent(urls.find((u) => u.startsWith('https://wa.me/')) ?? '');
    expect(whatsapp).toContain(pedido.id);
    expect(whatsapp).toMatch(precio(60000));
    await expect(page.getByText(pedido.uid || pedido.id.slice(0, 10)).first()).toBeVisible();
  });

  test('si otro cliente se lleva el stock, el checkout avisa y conserva el carrito', async ({ page }) => {
    const cliente = await crearUsuario('sinstock');
    await entrar(page, cliente.correo);
    await page.goto(`/seleccion/product-details/${PRODUCTO_UNIDADES}`);
    await page.getByPlaceholder('Ingresar cantidad').fill('3');
    await page.getByPlaceholder('Ingresar cantidad').press('Tab');
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByRole('button', { name: 'Reservar' })).toBeEnabled();

    // Mientras tanto se agotan: quedan 2.
    sql(`update public.productos set stock_total = 2 where id = '${PRODUCTO_UNIDADES}';`);

    await expect
      .poll(() => sql(`select count(*)::int from public.carrito where usuario_id = '${cliente.id}'`))
      .toBe('1');
    await page.goto('/seleccion/carrito');
    await page.getByRole('button', { name: 'Confirmar selección' }).click();
    await expect(page).toHaveURL(/\/seleccion\/checkout/);
    await page.getByText('Envío a domicilio').click();
    await page.locator('#direccion').fill('Calle de prueba 123');
    await page.getByRole('button', { name: 'Confirmar seleccion' }).click();
    await expect(page.getByText(/Stock insuficiente|No se pudo crear la orden/).first()).toBeVisible();
    await expect(page).toHaveURL(/\/seleccion\/checkout/);
    expect(Number(sql(`select count(*) from public.ordenes where usuario_id = '${cliente.id}'`))).toBe(0);
    expect(Number(sql(`select count(*) from public.carrito where usuario_id = '${cliente.id}'`))).toBe(1);
    expect(Number(sql(`select stock_total from public.productos where id = '${PRODUCTO_UNIDADES}'`))).toBe(2);
  });
});
