# Migraciones pendientes (restrictivas)

Estas migraciones **cierran permisos**. Si se aplican antes de desplegar el
frontend compatible, rompen el login o el marketplace en producción.

Por eso no están en `supabase/migrations/`: así `supabase db push` no las
aplica por accidente.

Orden obligatorio:

1. Aplicar `supabase/migrations/20261015120000_fase0_existe_correo_y_usuarios_publicos.sql` (aditiva, segura).
2. Desplegar el frontend de este PR y comprobar en producción que login, registro y marketplace funcionan.
3. Mover a `supabase/migrations/` y aplicar, una por una, verificando después de cada una:
   - `20261015120100_fase0_cerrar_usuarios_publicos.sql` → probar login y registro.
   - `20261015120200_fase0_ocultar_costo_productos.sql` → probar marketplace, carrito, checkout y el editor de productos del admin.

Cada archivo trae su rollback comentado al final.
