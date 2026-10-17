/** Velocidades de rotación de la franja de anuncios que puede elegir el administrador. */
export interface VelocidadAnuncio {
  nivel: number;
  etiqueta: string;
  /** Segundos que tarda en pasar cada mensaje. */
  segundosPorMensaje: number;
}

export const VELOCIDADES_ANUNCIOS: VelocidadAnuncio[] = [
  { nivel: 1, etiqueta: 'Muy lenta', segundosPorMensaje: 25 },
  { nivel: 2, etiqueta: 'Lenta', segundosPorMensaje: 18 },
  { nivel: 3, etiqueta: 'Normal', segundosPorMensaje: 12 },
  { nivel: 4, etiqueta: 'Rápida', segundosPorMensaje: 8 },
  { nivel: 5, etiqueta: 'Muy rápida', segundosPorMensaje: 5 },
];

export const VELOCIDAD_POR_DEFECTO = 3;

/** Duración de una vuelta completa de la franja, según cuántos mensajes tiene y la velocidad elegida. */
export function segundosDeLaFranja(mensajes: number, velocidad: number | null | undefined): number {
  const nivel = VELOCIDADES_ANUNCIOS.find((v) => v.nivel === velocidad) ?? VELOCIDADES_ANUNCIOS[VELOCIDAD_POR_DEFECTO - 1];
  return Math.max(1, mensajes) * nivel.segundosPorMensaje;
}
