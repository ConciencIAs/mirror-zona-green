/**
 * Nombre que ve el equipo para cada origen de autorización. En la base el valor
 * se asigna al registrarse (handle_new_user): base_confianza,
 * registro_web_con_codigo o registro_web_sin_codigo.
 */
const NOMBRE_ORIGEN: Record<string, string> = {
  base_confianza: 'Base de confianza',
  registro_web_con_codigo: 'Registro web con código',
  registro_web_sin_codigo: 'Registro web sin código',
};

export function nombreOrigenAutorizacion(origen: string | null | undefined): string {
  if (!origen) return '—';
  return NOMBRE_ORIGEN[origen] ?? origen;
}
