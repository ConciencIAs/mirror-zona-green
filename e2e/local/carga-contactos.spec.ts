// Carga de datos: el administrador sube contactos (.vcf, Excel, CSV) y se agregan
// a la base de confianza solo los números válidos que todavía no estaban.
// Los archivos son sintéticos: nunca se usan contactos reales en las pruebas.
import { crearUsuario, entrar, expect, sql, test } from './apoyo';

const base = String(Date.now()).slice(-6);
const n = (i: number) => `318${base}${i}`; // 10 dígitos, celular colombiano
const NUEVOS = [n(1), n(2), n(3), n(4)];

const vcf = [
  // 1: formato +57 pegado
  ['BEGIN:VCARD', 'VERSION:3.0', 'N:Prueba;Uno;;;', 'FN:Prueba Uno', `TEL;type=CELL;type=VOICE;type=pref:+57${NUEVOS[0]}`, 'END:VCARD'],
  // 2: con espacios y guiones, línea de nombre doblada y campo item1.TEL
  ['BEGIN:VCARD', 'VERSION:3.0', 'N:Prueba;Dos;;;', 'FN:Prueba', ' Dos', `item1.TEL;type=pref:${NUEVOS[1].slice(0, 3)}-${NUEVOS[1].slice(3, 6)}-${NUEVOS[1].slice(6)}`, 'item1.X-ABLabel:celular', 'END:VCARD'],
  // 3: dos teléfonos (uno extranjero) y uno repetido del contacto 1
  ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Prueba Tres', `TEL:+57 ${NUEVOS[2].slice(0, 3)} ${NUEVOS[2].slice(3)}`, 'TEL:+1 305 555 0142', `TEL:+57${NUEVOS[0]}`, 'END:VCARD'],
  // 4: número inválido (no es celular colombiano ni lleva indicativo)
  ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Prueba Cuatro', 'TEL:4125551234', 'END:VCARD'],
  // 5: sin teléfono
  ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Sin telefono', 'NOTE:solo nota', 'END:VCARD'],
  // 6: celular ya existente en la base (guardado sin +57, como la carga antigua)
  ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Ya estaba', `TEL:+57${n(9)}`, 'END:VCARD'],
  // 7: otro nuevo, en una tarjeta con salto de línea CRLF
  ['BEGIN:VCARD', 'VERSION:3.0', 'FN:Prueba Siete', `TEL:${NUEVOS[3]}`, 'END:VCARD'],
]
  .map((tarjeta) => tarjeta.join('\r\n'))
  .join('\r\n');

test.describe('Carga de contactos a la base de confianza', () => {
  test.afterAll(() => {
    sql(`delete from public.base_confianza where public.normalizar_telefono(telefono) = any (array[${[...NUEVOS, n(9)].map((x) => `'+57${x}'`).join(',')}, '+13055550142']);`);
  });

  test('un .vcf agrega solo los números válidos nuevos y muestra el resumen', async ({ page }) => {
    sql(`delete from public.base_confianza where public.normalizar_telefono(telefono) = '+57${n(9)}'; insert into public.base_confianza (telefono) values ('${n(9)}');`);
    const admin = await crearUsuario('carga-admin', { rol: 'admin', status: 'activo' });
    await entrar(page, admin.correo);
    await page.goto('/admin/customer/bulk-upload');

    await page.locator('input[type="file"]').first().setInputFiles({ name: 'contactos.vcf', mimeType: 'text/vcard', buffer: Buffer.from(vcf, 'utf-8') });
    await page.getByRole('button', { name: 'Procesar y Cargar' }).click();

    const resumen = page.getByText('Resumen de la carga').locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
    await expect(resumen).toBeVisible();
    const dato = (etiqueta: string) => resumen.locator('div', { has: page.getByText(etiqueta, { exact: true }) }).last().locator('dd');
    await expect(dato('Contactos leídos')).toHaveText('7');
    await expect(dato('Números encontrados')).toHaveText('8'); // 1+1+3+1+1+1 líneas TEL
    await expect(dato('Repetidos en el archivo')).toHaveText('1');
    await expect(dato('Inválidos (omitidos)')).toHaveText('1');
    await expect(dato('Ya estaban en la base')).toHaveText('1');
    await expect(dato('Cargados ahora')).toHaveText('5');

    const guardados = sql(
      `select string_agg(public.normalizar_telefono(telefono), ',' order by 1) from public.base_confianza where public.normalizar_telefono(telefono) = any (array[${NUEVOS.map((x) => `'+57${x}'`).join(',')}, '+13055550142'])`,
    );
    expect(guardados.split(',').sort()).toEqual([...NUEVOS.map((x) => `+57${x}`), '+13055550142'].sort());
    // El número que ya estaba no se duplicó, y no se guardó ningún nombre.
    expect(Number(sql(`select count(*) from public.base_confianza where public.normalizar_telefono(telefono) = '+57${n(9)}'`))).toBe(1);

    // Cargar el mismo archivo otra vez no agrega nada.
    await page.goto('/admin/customer/bulk-upload');
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'contactos.vcf', mimeType: 'text/vcard', buffer: Buffer.from(vcf, 'utf-8') });
    await page.getByRole('button', { name: 'Procesar y Cargar' }).click();
    await expect(dato('Cargados ahora')).toHaveText('0');
  });

  test('un CSV con los números en cualquier columna también se lee', async ({ page }) => {
    const extra = `319${base}7`;
    const admin = await crearUsuario('carga-csv-admin', { rol: 'admin', status: 'activo' });
    await entrar(page, admin.correo);
    await page.goto('/admin/customer/bulk-upload');
    const csv = `nombre,celular\nAna,${extra}\nBeto,no es un numero\n`;
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'lista.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByRole('button', { name: 'Procesar y Cargar' }).click();
    await expect(page.getByText('Resumen de la carga')).toBeVisible();
    await expect.poll(() => sql(`select count(*) from public.base_confianza where public.normalizar_telefono(telefono) = '+57${extra}'`)).toBe('1');
    sql(`delete from public.base_confianza where public.normalizar_telefono(telefono) = '+57${extra}'`);
  });
});
