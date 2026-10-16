# Migraciones pendientes (restrictivas)

Estas migraciones **cierran permisos o imponen reglas**. Si se aplican antes de
tiempo pueden romper el registro, el login o el marketplace en producción.

Por eso no están en `supabase/migrations/`: así nadie las aplica por accidente
(producción no tiene historial de migraciones; no usar `supabase db push`).
Cuando una se aplica, se mueve a `supabase/migrations/` en el siguiente PR.

## Pendiente ahora

### `20261016130200_fase2c_telefono_unico.sql` (Fase 2c: un celular por persona)
Aplicar solo después de:
1. `supabase/migrations/20261016130000_fase2c_telefono_normalizado.sql` (aditiva).
2. `supabase/migrations/20261016130100_fase2c_limpiar_telefonos_repetidos.sql` (limpieza).
3. Desplegar el frontend de la Fase 2c.

Si todavía hubiera un celular repetido, la migración falla sin cambiar nada:
volver a correr la limpieza (paso 2) y repetir.

Después de aplicarla, probar: registro con un celular nuevo (entra), registro
con un celular ya usado (mensaje "Este celular ya está registrado") y cambio de
celular en Mi perfil.

## Ya aplicadas (historial)
- `20261015120100_fase0_cerrar_usuarios_publicos.sql` y
  `20261015120200_fase0_ocultar_costo_productos.sql`: aplicadas el 15 de octubre
  de 2026, ahora en `supabase/migrations/`.

Cada archivo trae su rollback comentado al final.
