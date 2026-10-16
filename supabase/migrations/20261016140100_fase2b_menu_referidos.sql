-- =====================================================================
-- Fase 2b — Enlace "Árbol de referidos" en el menú de Administración
--
-- El menú vive en page_config (config_name = 'navbar'), no en el código.
-- Agrega el enlace a /admin/customer/referidos al final de
-- la sección "Administración", solo si todavía no está. No toca nada más.
--
-- Alternativa sin SQL: Admin → Gestión Contenido → Configuraciones → Navbar,
-- sección "Administración", agregar ruta /admin/customer/referidos.
--
-- Idempotente. Rollback al final (comentado).
-- =====================================================================

update public.page_config pc
set content = (
  select jsonb_set(
    pc.content::jsonb,
    '{sections}',
    jsonb_agg(
      case
        when s->>'title' = 'Administración'
          and not exists (
            select 1 from jsonb_array_elements(s->'items') i
            where i->>'path' = '/admin/customer/referidos'
          )
        then jsonb_set(
          s, '{items}',
          (s->'items') || jsonb_build_array(jsonb_build_object(
            'path', '/admin/customer/referidos',
            'label', 'Árbol de referidos'
          ))
        )
        else s
      end
      order by ord
    )
  )::json
  from jsonb_array_elements(pc.content::jsonb->'sections') with ordinality as t(s, ord)
)
where pc.config_name = 'navbar'
  and exists (
    select 1 from jsonb_array_elements(pc.content::jsonb->'sections') s
    where s->>'title' = 'Administración'
  )
  and not exists (
    select 1
    from jsonb_array_elements(pc.content::jsonb->'sections') s,
         jsonb_array_elements(s->'items') i
    where s->>'title' = 'Administración'
      and i->>'path' = '/admin/customer/referidos'
  );

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- ---------------------------------------------------------------------
-- update public.page_config pc
-- set content = (
--   select jsonb_set(
--     pc.content::jsonb, '{sections}',
--     jsonb_agg(
--       case when s->>'title' = 'Administración'
--         then jsonb_set(s, '{items}', coalesce((
--           select jsonb_agg(i order by io) from jsonb_array_elements(s->'items') with ordinality as x(i, io)
--           where i->>'path' <> '/admin/customer/referidos'), '[]'::jsonb))
--         else s end
--       order by ord)
--   )::json
--   from jsonb_array_elements(pc.content::jsonb->'sections') with ordinality as t(s, ord)
-- )
-- where pc.config_name = 'navbar';
-- =====================================================================
