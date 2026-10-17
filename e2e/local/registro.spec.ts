// Registro: el celular se compara COMPLETO con la base de confianza
// (handle_new_user). Quien coincide entra activo; quien no, queda inactivo.
import { ANON, API, PASSWORD, expect, sql, test } from './apoyo';

/** Registro por la API de Auth, como lo hace el formulario (sin tocar el estado). */
async function registrar(telefono: string) {
  const correo = `e2e.registro.${Date.now()}.${Math.floor(Math.random() * 1e4)}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: correo,
      password: PASSWORD,
      data: { full_name: 'E2E registro', telefono, documento: '12345678', tipo_documento: 'CC', fecha_nacimiento: '1990-05-05', ubicacion: 'Bogotá' },
    }),
  });
  const cuerpo = (await r.json()) as { id?: string };
  if (!cuerpo.id) throw new Error(`No se pudo registrar: ${JSON.stringify(cuerpo)}`);
  return JSON.parse(
    sql(`select json_build_object('status', status, 'origen', origen_autorizacion, 'telefono', telefono, 'normalizado', telefono_normalizado)
         from public.perfiles where id = '${cuerpo.id}'`),
  ) as { status: string; origen: string; telefono: string; normalizado: string | null };
}

const sufijo = () => String(Date.now()).slice(-6);

test.describe('Registro y base de confianza', () => {
  const cargados: string[] = [];
  test.afterAll(() => {
    if (cargados.length) sql(`delete from public.base_confianza where telefono in (${cargados.map((t) => `'${t}'`).join(',')});`);
  });
  /** Número en la base de confianza tal como quedó en la carga vieja: 10 dígitos, sin +57. */
  const enBase = (numero: string) => {
    sql(`insert into public.base_confianza (telefono) values ('${numero}');`);
    cargados.push(numero);
  };

  test('coincide en sus distintas formas: 3…, 57…, +57 con espacios', async () => {
    const formas = [
      (n: string) => n,
      (n: string) => `57${n}`,
      (n: string) => `+57 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`,
    ];
    const base = `320${sufijo()}`;
    for (const [i, escribir] of formas.entries()) {
      const numero = `${base}${i}`;
      enBase(numero);
      const perfil = await registrar(escribir(numero));
      expect(perfil, `registrado como "${escribir(numero)}"`).toMatchObject({
        status: 'activo',
        origen: 'base_confianza',
        normalizado: `+57${numero}`,
      });
    }
  });

  test('un número de EE. UU. no coincide con uno colombiano de los mismos 10 dígitos', async () => {
    const numero = `305${sufijo()}1`;
    enBase(numero);
    const perfil = await registrar(`+1 ${numero}`);
    expect(perfil).toMatchObject({ status: 'inactivo', origen: 'registro_web' });
    // El número extranjero se guarda completo, no cortado a 10 dígitos.
    expect(perfil.normalizado).toBe(`+1${numero}`);
  });

  test('un número que no está en la base queda inactivo', async () => {
    const perfil = await registrar(`315${sufijo()}9`);
    expect(perfil).toMatchObject({ status: 'inactivo', origen: 'registro_web' });
  });
});
