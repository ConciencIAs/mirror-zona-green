-- =====================================================================
-- Fase 0 — Migración RESTRICTIVA. Aplicar SOLO DESPUÉS de:
--   1. haber aplicado 20261015120000 (crea admin_costos_productos()).
--   2. haber desplegado el frontend que consulta productos con columnas
--      explícitas (sin costo) y lee el costo del admin vía RPC.
--   Si se aplica antes, cualquier consulta select('*') a productos falla
--   con "permission denied for column costo".
--
-- Problema: productos.costo (precio de costo) era legible por cualquier
-- visitante anónimo vía la API REST. Verificado el 15/10.
--
-- Después de esta migración anon y authenticated pueden leer todas las
-- columnas de productos menos costo. El admin lo lee con
-- admin_costos_productos(). Insertar/actualizar costo sigue igual
-- (los privilegios de INSERT/UPDATE no cambian; RLS sigue limitando a admin).
-- No borra datos. Rollback al final.
-- =====================================================================

revoke select on public.productos from anon, authenticated;

grant select (
  id, nombre, descripcion, urls_imagenes, status, tags, stock_total, sku,
  precio, created_at, updated_at, deleted_at, has_product_variantes,
  es_por_gramos, presentaciones, reservado, rating_average, rating_count,
  presentacion_venta, ofertas
) on public.productos to anon, authenticated;

-- Si en el futuro se agrega una columna a productos, hay que agregarla
-- también a este GRANT o no será legible por la app.

-- =====================================================================
-- ROLLBACK
-- ---------------------------------------------------------------------
-- grant select on public.productos to anon, authenticated;
-- =====================================================================
