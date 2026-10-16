// Utilidades compartidas por las pruebas locales.

let contador = 0;
/**
 * Celular colombiano de prueba distinto en cada llamada. Desde la Fase 2c la
 * base no permite dos perfiles con el mismo celular, así que cada cuenta de
 * prueba necesita el suyo.
 */
export function celularUnico() {
  contador = (contador + 1) % 100;
  const base = String(Date.now()).slice(-6);
  return `31${base}${String(contador).padStart(2, '0')}`;
}
