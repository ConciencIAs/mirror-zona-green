// Gestión de usuarios y registro pendiente (pruebas del cliente, entrega A).
import { crearUsuario, entrar, expect, sql, test } from './apoyo';

test.describe('Gestión de usuarios y cuenta pendiente', () => {
  test('el buscador encuentra por celular escrito de varias formas', async ({ page }) => {
    const admin = await crearUsuario('usuarios-admin', { rol: 'admin', status: 'activo' });
    const u = await crearUsuario('usuarios-buscar');
    const cel = sql(`select telefono from public.perfiles where id = '${u.id}'`);
    await entrar(page, admin.correo);
    await page.goto('/admin');
    const buscar = page.getByPlaceholder(/Buscar por nombre/);
    const formas = [cel, `57${cel}`, `+57 ${cel.slice(0, 3)} ${cel.slice(3, 6)} ${cel.slice(6)}`, `+57-${cel}`, cel.slice(2, 8)];
    for (const forma of formas) {
      await buscar.fill(forma);
      await expect(page.locator('tr', { hasText: u.correo }), `buscando "${forma}"`).toHaveCount(1);
    }
    await buscar.fill('3999999999');
    await expect(page.locator('tr', { hasText: u.correo })).toHaveCount(0);
  });

  test('la tabla cabe completa en 1280 px, aun con nombres y correos largos', async ({ page }) => {
    const admin = await crearUsuario('usuarios-admin-tabla', { rol: 'admin', status: 'activo' });
    const largo = await crearUsuario('usuarios-con-un-correo-bastante-largo-para-probar-el-ancho');
    sql(`update public.perfiles set full_name = 'Maria del Pilar Rodriguez Castellanos de la Hoz', referido_por = 'ABCDEFGHIJ' where id = '${largo.id}'`);
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page, admin.correo);
    await page.goto('/admin');
    await page.locator('p-table .p-datatable-table-container').waitFor();
    const [visible, total] = await page.evaluate(() => {
      const c = document.querySelector('p-table .p-datatable-table-container') as HTMLElement;
      return [c.clientWidth, c.scrollWidth];
    });
    expect(total, 'la tabla no debe obligar a desplazarse hacia los lados').toBeLessThanOrEqual(visible);
  });

  test('quien queda pendiente ve una ventana al ingresar y "Pendiente autorización" en el menú', async ({ page }) => {
    const pendiente = await crearUsuario('usuarios-pendiente', { status: 'inactivo' });
    await entrar(page, pendiente.correo).catch(() => undefined);
    await expect(page.getByText('Tu ingreso está pendiente de autorización')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByText('Pendiente autorización').first()).toBeVisible();
  });
});
