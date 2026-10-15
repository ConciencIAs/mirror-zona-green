/**
 * Columnas de `productos` que se pueden leer desde el navegador.
 * No incluye `costo`: después de la migración 20261015120200 esa columna deja
 * de ser legible por la API y un `select('*')` fallaría. El admin lee el costo
 * con la RPC `admin_costos_productos`.
 *
 * Es un literal (no un `join`) para que supabase-js pueda inferir el tipo.
 */
export const PRODUCTO_COLUMNAS_PUBLICAS =
  'id, nombre, descripcion, urls_imagenes, status, tags, stock_total, sku, precio, created_at, updated_at, deleted_at, has_product_variantes, es_por_gramos, presentaciones, reservado, rating_average, rating_count, presentacion_venta, ofertas' as const;
