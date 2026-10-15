-- =====================================================================
-- SOLO PARA EL SUPABASE LOCAL DE PRUEBAS. NO APLICAR EN PRODUCCIÓN.
--
-- Completa el esquema público (00_esquema_publico_produccion_2026-10-15.sql)
-- con lo que vive fuera de `public` y agrega datos sintéticos:
--   - trigger on_auth_user_created (igual que producción)
--   - buckets y políticas de Storage (igual que producción)
--   - un teléfono ficticio en base_confianza
--   - productos de prueba (uno por gramos con 4 presentaciones, uno por unidades)
-- Ningún dato personal de producción.
-- =====================================================================

-- Trigger de Auth (en producción: auth.users → handle_new_user)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Storage (igual que producción)
insert into storage.buckets (id, name, public, file_size_limit)
values ('productos', 'productos', true, 52428800), ('home_image', 'home_image', true, null)
on conflict (id) do nothing;

do $$
declare b text;
begin
  foreach b in array array['productos', 'home_image'] loop
    execute format('drop policy if exists %I on storage.objects', b || ' Bucket - Lectura Pública');
    execute format('create policy %I on storage.objects for select using (bucket_id = %L)', b || ' Bucket - Lectura Pública', b);
    execute format('drop policy if exists %I on storage.objects', b || ' Bucket - Inserción exclusiva Staff');
    execute format('create policy %I on storage.objects for insert with check (bucket_id = %L and public.auth_user_role() = any (array[''admin''::public.rol_usuario, ''agente''::public.rol_usuario]))', b || ' Bucket - Inserción exclusiva Staff', b);
    execute format('drop policy if exists %I on storage.objects', b || ' Bucket - Actualización exclusiva Staff');
    execute format('create policy %I on storage.objects for update using (bucket_id = %L and public.auth_user_role() = any (array[''admin''::public.rol_usuario, ''agente''::public.rol_usuario]))', b || ' Bucket - Actualización exclusiva Staff', b);
    execute format('drop policy if exists %I on storage.objects', b || ' Bucket - Eliminación exclusiva Staff');
    execute format('create policy %I on storage.objects for delete using (bucket_id = %L and public.auth_user_role() = any (array[''admin''::public.rol_usuario, ''agente''::public.rol_usuario]))', b || ' Bucket - Eliminación exclusiva Staff', b);
  end loop;
end $$;

-- Teléfono ficticio de confianza
insert into public.base_confianza (telefono) values ('3009990001')
on conflict do nothing;

-- Productos sintéticos
insert into public.productos (
  id, nombre, descripcion, urls_imagenes, status, tags, stock_total, sku,
  costo, precio, es_por_gramos, presentaciones, reservado, presentacion_venta
) values
(
  '00000000-0000-4000-8000-000000000001',
  'PRUEBA material seleccionado',
  'Producto sintético para pruebas de concurrencia (por gramos)',
  array[]::text[], 'activo', array['Material seleccionado'],
  130, 'PRUEBA-GR', 11111, 0, true,
  '[{"sku":"PRUEBA-GR-5","gramos":5,"precio":20000,"stock":4},
    {"sku":"PRUEBA-GR-10","gramos":10,"precio":38000,"stock":3},
    {"sku":"PRUEBA-GR-20","gramos":20,"precio":70000,"stock":2},
    {"sku":"PRUEBA-GR-40","gramos":40,"precio":130000,"stock":1}]'::jsonb,
  0, 'gr'
),
(
  '00000000-0000-4000-8000-000000000002',
  'PRUEBA producto por unidades',
  'Producto sintético para pruebas de concurrencia (unidades)',
  array[]::text[], 'activo', array['Comestibles'],
  5, 'PRUEBA-UND', 22222, 10000, false, '[]'::jsonb, 0, 'und'
)
on conflict (id) do nothing;
