/**
 * Fechas "de calendario" (sin hora), como la fecha de nacimiento.
 *
 * `new Date('1990-01-01')` se interpreta como medianoche UTC, que en Colombia
 * (UTC-5) es el 31 de diciembre a las 7 p. m.: la app mostraba un día menos.
 * Y `toISOString()` convierte a UTC, lo que en zonas con hora adelantada
 * guarda un día menos. Estas funciones trabajan siempre en la hora local.
 */

/** 'AAAA-MM-DD' → Date a medianoche local, o null si no es válida. */
export function fechaDesdeISO(valor: string | null | undefined): Date | null {
  if (!valor) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor);
  if (!m) return null;
  const fecha = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** Date → 'AAAA-MM-DD' con el día que ve la persona (hora local). */
export function fechaAISO(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mm}-${dd}`;
}

/** Edad mínima para registrarse (Fase 3). La base aplica la misma regla. */
export const EDAD_MINIMA = 18;

/** Última fecha de nacimiento permitida: hoy menos 18 años (hora local). */
export function fechaMaximaNacimiento(hoy = new Date()): Date {
  return new Date(hoy.getFullYear() - EDAD_MINIMA, hoy.getMonth(), hoy.getDate());
}

/** true si quien nació en `fecha` ya cumplió 18 años. */
export function esMayorDeEdad(fecha: Date | null | undefined): boolean {
  if (!fecha || Number.isNaN(fecha.getTime())) return false;
  const nacimiento = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  return nacimiento <= fechaMaximaNacimiento();
}

export const MENSAJE_EDAD_MINIMA = 'Debes ser mayor de 18 años para registrarte en Cheyn Verde.';
