# Migraciones pendientes (restrictivas)

Estas migraciones **cierran permisos o imponen reglas**. Si se aplican antes de
tiempo pueden romper el registro, el login o el marketplace en producción.

Por eso no están en `supabase/migrations/`: así nadie las aplica por accidente
(producción no tiene historial de migraciones; no usar `supabase db push`).
Cuando una se aplica, se mueve a `supabase/migrations/` en el siguiente PR.

## Pendiente ahora

Ninguna (16 de octubre de 2026).

## Ya aplicadas (historial, ahora en `supabase/migrations/`)
- `20261015120100_fase0_cerrar_usuarios_publicos.sql` y
  `20261015120200_fase0_ocultar_costo_productos.sql`: 15 de octubre de 2026.
- `20261016130200_fase2c_telefono_unico.sql` y `20261016150100_fase3_edad_minima.sql`: 16 de octubre de 2026.

Cada archivo trae su rollback comentado al final.
