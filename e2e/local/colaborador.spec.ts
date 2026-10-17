// Rol colaborador ("agente" en la base): entra a los módulos del admin menos
// Métricas de ventas y Referidos, y en Gestión de usuarios solo gestiona
// clientes, sin cambiar roles.
import { crearUsuario, entrar, expect, sql, test } from './apoyo';

test.describe('Colaborador', () => {
  test('ve sus módulos y no entra a Métricas de ventas ni a Referidos', async ({ page }) => {
    const colaborador = await crearUsuario('colaborador', { rol: 'agente', status: 'activo' });
    await entrar(page, colaborador.correo);

    for (const ruta of ['/admin/marketplace/orders', '/admin/marketplace/products', '/admin/dynamic-content', '/admin/marketplace', '/admin/customer/bulk-upload', '/admin']) {
      await page.goto(ruta);
      await expect(page, `entra a ${ruta}`).toHaveURL(new RegExp(`${ruta.replace(/\//g, '\\/')}$`));
    }
    for (const ruta of ['/admin/marketplace/dashboard', '/admin/customer/referidos']) {
      await page.goto(ruta);
      await expect(page, `no entra a ${ruta}`).toHaveURL(/\/admin$/);
    }

    // Menú: la sección "Colaboración" con sus 6 módulos, sin los del admin.
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const menu = page.getByLabel('Menú de navegación');
    await menu.getByText('Colaboración').scrollIntoViewIfNeeded();
    await expect(menu.getByText('Colaboración')).toBeInViewport();
    for (const item of ['Gestión Pedidos', 'Gestión Inventario', 'Gestión Contenido', 'Histórico de Pedidos', 'Gestión Usuarios', 'Carga de datos']) {
      await expect(menu.getByText(item, { exact: true })).toBeVisible();
    }
    await expect(menu.getByText('Métricas de ventas')).toHaveCount(0);
    await expect(menu.getByText('Árbol de referidos')).toHaveCount(0);
  });

  test('en Gestión de usuarios activa clientes, pero no cambia roles ni toca administradores', async ({ page }) => {
    const colaborador = await crearUsuario('colaborador-usuarios', { rol: 'agente', status: 'activo' });
    const pendiente = await crearUsuario('colaborador-pendiente', { status: 'inactivo' });
    const admin = await crearUsuario('colaborador-admin', { rol: 'admin', status: 'activo' });
    await entrar(page, colaborador.correo);

    await page.goto('/admin');
    await expect(page.getByText('Ver árbol de referidos')).toHaveCount(0);
    await page.getByPlaceholder(/Buscar por nombre/).fill(pendiente.correo);
    const fila = page.locator('tr', { hasText: pendiente.correo });
    await expect(fila.locator('p-select').nth(1)).toHaveClass(/p-disabled/); // rol
    await fila.locator('p-select').first().click(); // estado
    await page.getByRole('option', { name: 'Activo', exact: true }).click();
    await expect.poll(() => sql(`select status from public.perfiles where id = '${pendiente.id}'`)).toBe('activo');

    await page.getByPlaceholder(/Buscar por nombre/).fill(admin.correo);
    const filaAdmin = page.locator('tr', { hasText: admin.correo });
    await expect(filaAdmin.locator('p-select').first()).toHaveClass(/p-disabled/);
    await expect(filaAdmin.getByRole('button', { name: /Autorizar|Generar|Revocar/ })).toHaveCount(0);
  });
});
