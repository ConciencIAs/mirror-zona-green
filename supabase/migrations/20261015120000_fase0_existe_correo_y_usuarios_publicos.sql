-- =====================================================================
-- Fase 0 / Fase 1 — Migración ADITIVA (se puede aplicar antes del código)
--
-- Qué hace:
--   1. existe_correo(p_correo): RPC que solo devuelve true/false. Reemplaza
--      la lectura directa de usuarios_publicos desde el navegador.
--   2. admin_costos_productos(): RPC para que el admin lea el costo cuando
--      la columna productos.costo deje de ser legible por la API (migración
--      20261015120200, que se aplica DESPUÉS de desplegar el código).
--   3. handle_new_user: ahora también registra el correo en
--      usuarios_publicos. Desde la migración del 1 de octubre ningún
--      registro nuevo llegaba a esa tabla y el login los rechazaba.
--   4. Relleno idempotente de usuarios_publicos para los usuarios que
--      quedaron por fuera (7 de 23 al 15 de octubre).
--
-- No borra ni modifica datos existentes. Se puede ejecutar más de una vez.
-- Rollback al final del archivo (comentado).
-- =====================================================================

-- 1. existe_correo --------------------------------------------------------
create or replace function public.existe_correo(p_correo text)
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1 from auth.users u
    where lower(u.email) = lower(trim(p_correo))
      and u.deleted_at is null
  );
$$;

revoke all on function public.existe_correo(text) from public;
grant execute on function public.existe_correo(text) to anon, authenticated;

comment on function public.existe_correo(text) is
  'Devuelve true si existe una cuenta con ese correo. No expone ningún otro dato.';

-- 2. admin_costos_productos ----------------------------------------------
create or replace function public.admin_costos_productos(p_ids uuid[] default null)
returns table (id uuid, costo numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.auth_user_role() <> 'admin'::public.rol_usuario then
    raise exception 'Solo un administrador puede consultar costos.'
      using errcode = '42501';
  end if;

  return query
    select p.id, p.costo
    from public.productos p
    where p_ids is null or p.id = any (p_ids);
end;
$$;

revoke all on function public.admin_costos_productos(uuid[]) from public;
grant execute on function public.admin_costos_productos(uuid[]) to authenticated;

-- 3. handle_new_user (igual al de producción + registro en usuarios_publicos)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
DECLARE
  v_status public.status_profile;
  v_origen text;
  v_referido_por text;
  v_telefono_raw text;
  v_telefono_limpio text;
BEGIN
  v_status := 'inactivo';
  v_origen := 'registro_web';
  v_referido_por := NEW.raw_user_meta_data ->> 'referido_por';
  v_telefono_raw := NEW.raw_user_meta_data ->> 'telefono';

  IF v_telefono_raw IS NOT NULL THEN
    v_telefono_limpio := RIGHT(regexp_replace(v_telefono_raw, '\D', '', 'g'), 10);
  END IF;

  IF v_telefono_limpio IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.base_confianza
    WHERE RIGHT(regexp_replace(telefono, '\D', '', 'g'), 10) = v_telefono_limpio
  ) THEN
    v_status := 'activo';
    v_origen := 'base_confianza';
  END IF;

  INSERT INTO public.perfiles (
    id,
    rol,
    correo,
    full_name,
    telefono,
    documento,
    tipo_documento,
    fecha_nacimiento,
    ubicacion,
    status,
    referido_por,
    origen_autorizacion,
    datos_adicionales
  )
  VALUES (
    NEW.id,
    'customer'::public.rol_usuario,
    NEW.email,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(v_telefono_limpio, v_telefono_raw),
    NEW.raw_user_meta_data ->> 'documento',
    NULLIF(NEW.raw_user_meta_data ->> 'tipo_documento', '')::public.tipo_doc,
    NULLIF(NEW.raw_user_meta_data ->> 'fecha_nacimiento', '')::date,
    NEW.raw_user_meta_data ->> 'ubicacion',
    v_status,
    v_referido_por,
    v_origen,
    jsonb_build_object(
      'acepta_politicas', COALESCE((NEW.raw_user_meta_data ->> 'acepta_politica_privacidad')::boolean, false),
      'acepta_terminos', COALESCE((NEW.raw_user_meta_data ->> 'acepta_terminos')::boolean, false),
      'fecha_aceptacion', NOW(),
      'fecha_registro', NOW()
    )
  );

  -- NUEVO: el login reconoce el correo desde el primer momento.
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.usuarios_publicos (uid, correo)
    VALUES (NEW.id, lower(NEW.email))
    ON CONFLICT (correo) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Relleno idempotente --------------------------------------------------
insert into public.usuarios_publicos (uid, correo)
select p.id, lower(p.correo)
from public.perfiles p
where p.correo is not null
  and not exists (
    select 1 from public.usuarios_publicos up
    where lower(up.correo) = lower(p.correo)
  )
on conflict (correo) do nothing;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- ---------------------------------------------------------------------
-- drop function if exists public.existe_correo(text);
-- drop function if exists public.admin_costos_productos(uuid[]);
--
-- -- handle_new_user: volver a la versión anterior = la misma función de
-- -- arriba SIN el bloque "NUEVO: el login reconoce el correo..." (desde
-- -- "IF NEW.email IS NOT NULL" hasta su "END IF;").
--
-- -- Las filas agregadas a usuarios_publicos por el relleno son correctas
-- -- y no se revierten (borrarlas volvería a bloquear el login).
-- =====================================================================
