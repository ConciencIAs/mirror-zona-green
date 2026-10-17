// Franja de avisos: el administrador elige la velocidad y el ícono desde el banco.
import { crearUsuario, entrar, expect, sql, test } from './apoyo';

test('velocidad e ícono de la franja de anuncios', async ({ page }) => {
  const respaldo = sql(`select coalesce((select content::text from public.page_config where config_name = 'advertising_banner'), '')`);
  try {
    const admin = await crearUsuario('avisos-admin', { rol: 'admin', status: 'activo' });
    await entrar(page, admin.correo);
    await page.goto('/admin/dynamic-content');
    await page.getByRole('tab', { name: /Avisos/ }).click();

    // Un anuncio nuevo con un ícono del banco.
    await page.getByPlaceholder('Texto del anuncio').last().fill('Aviso de prueba e2e');
    await page.getByRole('button', { name: 'Elegir ícono' }).click();
    await page.getByRole('button', { name: 'Ícono Regalo' }).click();
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.locator('.pi-gift').first()).toBeVisible();

    // Velocidad "Rápida" (8 s por mensaje).
    await page.getByRole('radio', { name: 'Rápida', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Rápida', exact: true })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Guardar Anuncios' }).click();
    await expect
      .poll(() => sql(`select (content::jsonb->>'velocidad') || ' ' || (jsonb_array_length(content::jsonb->'items') > 0) from public.page_config where config_name = 'advertising_banner'`))
      .toBe('4 true');

    // La franja que ve la gente usa esa velocidad: 8 s × cantidad de mensajes.
    const mensajes = Number(sql(`select jsonb_array_length(content::jsonb->'items') from public.page_config where config_name = 'advertising_banner'`));
    await page.goto('/home');
    const duracion = await page.locator('app-advertising-banner .animate-\\[marquee_35s_linear_infinite\\]').first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(duracion).toBe(`${mensajes * 8}s`);
  } finally {
    sql(
      respaldo
        ? `update public.page_config set content = '${respaldo.replace(/'/g, "''")}'::json where config_name = 'advertising_banner'`
        : `delete from public.page_config where config_name = 'advertising_banner'`,
    );
  }
});
