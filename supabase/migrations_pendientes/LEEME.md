# Migraciones pendientes (restrictivas)

Estas migraciones **cierran permisos o imponen reglas**. Si se aplican antes de
tiempo pueden romper el registro, el login o el marketplace en producción.

Por eso no están en `supabase/migrations/`: así nadie las aplica por accidente
(producción no tiene historial de migraciones; no usar `supabase db push`).
Cuando una se aplica, se mueve a `supabase/migrations/` en el siguiente PR.

## Pendiente ahora

### `20261016150100_fase3_edad_minima.sql` (Fase 3: 18 años)
Aplicar solo después de:
1. `supabase/migrations/20261016150000_fase3_endurecimiento.sql`.
2. Desplegar el frontend de la Fase 3 (valida la edad en el registro y en Mi perfil).

Después probar: registro con fecha de menor (el formulario lo explica antes de
enviar), registro normal, y guardar Mi perfil de una cuenta con fecha mala sin
cambiar la fecha (debe dejar).

## Ya aplicadas (historial, ahora en `supabase/migrations/`)
- `20261015120100_fase0_cerrar_usuarios_publicos.sql` y
  `20261015120200_fase0_ocultar_costo_productos.sql`: 15 de octubre de 2026.
- `20261016130200_fase2c_telefono_unico.sql`: 16 de octubre de 2026.

Cada archivo trae su rollback comentado al final.
