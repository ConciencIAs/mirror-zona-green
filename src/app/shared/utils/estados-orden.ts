import type { EstadoOrden } from '@src/app/shared/models/interfaces/db/db';

/**
 * Nombre que ve la gente para cada estado del pedido. En la base el valor sigue
 * siendo el código (`seleccion`, `aporte`, `en_proceso`…); cambiar un nombre
 * aquí lo cambia en el admin (gestión de pedidos, histórico, panel de ventas)
 * y en Mis órdenes del cliente.
 */
export const NOMBRE_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  seleccion: 'Selección realizada',
  aporte: 'Aporte recibido',
  en_proceso: 'En preparación',
  enviado: 'En ruta',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** Estados del recorrido normal de un pedido, en orden. */
export const RECORRIDO_ORDEN: EstadoOrden[] = [
  'seleccion',
  'aporte',
  'en_proceso',
  'enviado',
  'entregado',
];

/** Nombre del estado; si llega un código desconocido (pedidos viejos) se muestra tal cual. */
export function nombreEstadoOrden(estado: string | null | undefined): string {
  if (!estado) return '—';
  return NOMBRE_ESTADO_ORDEN[estado as EstadoOrden] ?? estado;
}
