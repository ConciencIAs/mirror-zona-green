/**
 * Celular en formato internacional (+573001234567, +5491112345678), o null si
 * no es un celular válido. Es la misma regla que public.normalizar_telefono()
 * en la base (migración 20261016130000): si cambia una, debe cambiar la otra.
 *
 * - Colombiano: 10 dígitos que empiezan por 3 (con o sin +57, espacios, guiones).
 * - Extranjero: escrito con + o 00 y el indicativo del país (8 a 15 dígitos).
 */
export function normalizarCelular(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const texto = String(raw).trim();
  let d = texto.replace(/\D/g, '');
  if (!d) return null;

  if (/^(\+|00)/.test(texto)) {
    d = d.replace(/^00/, '');
    return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
  }
  if (/^3\d{9}$/.test(d)) return `+57${d}`;
  if (/^573\d{9}$/.test(d)) return `+${d}`;
  if (d.length >= 11 && d.length <= 15) return `+${d}`;
  return null;
}

export const MENSAJE_CELULAR_INVALIDO =
  'Ingresa un celular válido: colombiano de 10 dígitos (3001234567) o extranjero con indicativo (+54 9 11 1234 5678).';

export const MENSAJE_CELULAR_EN_USO =
  'Este celular ya está registrado. Si es tuyo, inicia sesión o escríbenos a cheynverde@gmail.com.';

/** Respuesta de la RPC estado_telefono. */
export type EstadoCelular = 'invalido' | 'en_uso' | 'disponible';

/** Error de la base cuando se intenta repetir un celular (índice único). */
export function esErrorCelularRepetido(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return (error.message ?? '').includes('perfiles_telefono_unico');
}
