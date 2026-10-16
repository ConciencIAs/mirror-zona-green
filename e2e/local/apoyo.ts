// Utilidades compartidas por las pruebas contra el Supabase LOCAL.
import { execSync } from 'node:child_process';
import { test as base, expect, type Page } from '@playwright/test';

const status = JSON.parse(
  execSync('npx supabase status -o json', { encoding: 'utf8' }).match(/\{[\s\S]*\}/)![0],
) as Record<string, string>;

export const API: string = status['API_URL'];
export const ANON: string = status['PUBLISHABLE_KEY'] || status['ANON_KEY'];
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(API)) {
  throw new Error(`Estas pruebas solo corren contra el Supabase local (API = ${API}).`);
}

const CONTENEDOR = process.env['CONTENEDOR_DB'] ?? 'supabase_db_Cheyn_Verde';
/** SQL en la base LOCAL (como postgres). */
export function sql(consulta: string): string {
  return execSync(`docker exec -i ${CONTENEDOR} psql -U postgres -d postgres -At -v ON_ERROR_STOP=1`, {
    input: consulta,
    encoding: 'utf8',
  }).trim();
}

export const PASSWORD = 'Prueba-12345';
export const PRODUCTO_GRAMOS = '00000000-0000-4000-8000-000000000001'; // PRUEBA material seleccionado
export const PRODUCTO_UNIDADES = '00000000-0000-4000-8000-000000000002'; // PRUEBA producto por unidades
export const PRESENTACIONES = [
  { gramos: 5, precio: 20000, stock: 4 },
  { gramos: 10, precio: 38000, stock: 3 },
  { gramos: 20, precio: 70000, stock: 2 },
  { gramos: 40, precio: 130000, stock: 1 },
];

/** Deja los productos sintéticos con stock y precios conocidos. */
export function reiniciarProductos(): void {
  const stockGramos = PRESENTACIONES.reduce((t, p) => t + p.gramos * p.stock, 0);
  sql(`update public.productos set status = 'activo', deleted_at = null, es_por_gramos = true,
         presentaciones = '${JSON.stringify(PRESENTACIONES)}'::jsonb, stock_total = ${stockGramos}
       where id = '${PRODUCTO_GRAMOS}';
       update public.productos set status = 'activo', deleted_at = null, es_por_gramos = false,
         stock_total = 10, precio = 10000
       where id = '${PRODUCTO_UNIDADES}';`);
}

let contador = 0;
/** Celular colombiano distinto en cada llamada (la base no admite repetidos). */
export function celularUnico(): string {
  contador = (contador + 1) % 100;
  return `31${String(Date.now()).slice(-6)}${String(contador).padStart(2, '0')}`;
}

export interface Usuario {
  id: string;
  correo: string;
}
type Rol = 'customer' | 'admin' | 'agente';
type Estado = 'activo' | 'inactivo' | 'bloqueado';

/** Crea una cuenta local confirmada, con el rol y el estado pedidos. */
export async function crearUsuario(nombre: string, opciones: { rol?: Rol; status?: Estado } = {}): Promise<Usuario> {
  const correo = `e2e.${nombre}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@cheyn.test`;
  const r = await fetch(`${API}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: correo,
      password: PASSWORD,
      data: {
        full_name: `E2E ${nombre}`,
        telefono: celularUnico(),
        documento: '12345678',
        tipo_documento: 'CC',
        fecha_nacimiento: '1990-05-05',
        ubicacion: 'Bogotá',
      },
    }),
  });
  const cuerpo = (await r.json()) as { id?: string; msg?: string };
  if (!cuerpo.id) throw new Error(`No se pudo crear ${correo}: ${JSON.stringify(cuerpo)}`);
  sql(`update auth.users set email_confirmed_at = now() where id = '${cuerpo.id}';
       update public.perfiles set status = '${opciones.status ?? 'activo'}', rol = '${opciones.rol ?? 'customer'}'
       where id = '${cuerpo.id}';`);
  return { id: cuerpo.id, correo };
}

/** Sesión (access token) de una cuenta local, para pruebas por API. */
export async function token(correo: string): Promise<string> {
  for (let intento = 0; intento < 3; intento++) {
    const r = await fetch(`${API}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: correo, password: PASSWORD }),
    });
    const cuerpo = (await r.json()) as { access_token?: string };
    if (cuerpo.access_token) return cuerpo.access_token;
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error(`No se pudo iniciar sesión con ${correo}`);
}

/** Inicio de sesión por la interfaz. */
export async function entrar(page: Page, correo: string): Promise<void> {
  await page.goto('/auth/login');
  await page.locator('input[placeholder="correo@ejemplo.com"]').fill(correo);
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/(home|seleccion)/);
}

/**
 * `test` con el aviso de mayoría de edad ya aceptado y `window.open`
 * capturado (el checkout abre WhatsApp en otra pestaña).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      localStorage.setItem('zg_user_say_to_be_legal_age', 'true');
      (window as unknown as { __urlsAbiertas: string[] }).__urlsAbiertas = [];
      window.open = ((url?: string | URL) => {
        (window as unknown as { __urlsAbiertas: string[] }).__urlsAbiertas.push(String(url));
        return null;
      }) as typeof window.open;
    });
    await use(page);
  },
});
export { expect };

/** Precio en el formato de la app ($20.000), tolerante a punto o coma de miles. */
export function precio(valor: number): RegExp {
  const miles = valor.toLocaleString('es-CO').replace(/\./g, '[.,]');
  return new RegExp(`\\$\\s?${miles}(?!\\d)`);
}
