#!/usr/bin/env bash
# Arma la base del Supabase LOCAL desde cero, igual a producción en estructura:
#   00 esquema público de producción (sin datos)
#   01 auth/storage locales y productos sintéticos de prueba
#   02 configuración pública (roles, etiquetas, menú)
#   migraciones de supabase/migrations/ en orden
# Lo usan las pruebas automáticas (local y GitHub Actions). Nunca toca producción:
# escribe solo en el contenedor de Docker del Supabase local.
#
# Uso (después de `npx supabase start` sobre una base vacía):
#   bash supabase/pruebas/preparar-base-local.sh
set -euo pipefail

cd "$(dirname "$0")/../.."
CONTENEDOR="${CONTENEDOR_DB:-supabase_db_Cheyn_Verde}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTENEDOR"; then
  echo "No está corriendo el contenedor $CONTENEDOR. Ejecuta antes: npx supabase start" >&2
  exit 1
fi

aplicar() {
  echo "  · $1"
  docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$CONTENEDOR" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$1" > /dev/null
}

echo "Preparando la base local:"
aplicar supabase/pruebas/00_esquema_publico_produccion_2026-10-15.sql
aplicar supabase/pruebas/01_local_auth_storage_datos_sinteticos.sql
aplicar supabase/pruebas/02_config_publica.sql
for migracion in supabase/migrations/*.sql; do
  aplicar "$migracion"
done
docker exec "$CONTENEDOR" psql -U postgres -d postgres -q -c "NOTIFY pgrst, 'reload schema'"
echo "Base local lista."
