-- =====================================================================
-- Fase 2c — Un celular por persona — Migración ADITIVA
--
-- Qué hace (no bloquea a nadie todavía):
--   1. normalizar_telefono(): convierte un número al formato internacional
--      (+573001234567, +5491112345678). Misma regla que la carga masiva de la
--      base de confianza (bulk-upload.ts). Devuelve null si no es un celular
--      válido: colombiano de 10 dígitos que empieza por 3, o extranjero
--      escrito con + o 00 y 8 a 15 dígitos.
--   2. perfiles.telefono_normalizado: columna calculada con esa función. Es
--      la identidad del celular; sobre ella irá la regla de unicidad
--      (migración pendiente 20261016130200).
--   3. estado_telefono(): 'invalido' | 'en_uso' | 'disponible'. La usan el
--      registro y Mi perfil para avisar antes de guardar.
--   4. handle_new_user: guarda el número completo (antes cortaba a los
--      últimos 10 dígitos y perdía el indicativo de los extranjeros) y busca
--      en la base de confianza por número normalizado.
--
-- No borra ni cambia datos existentes. Se puede ejecutar más de una vez.
-- Rollback al final (comentado).
-- =====================================================================

-- 1. normalizar_telefono ------------------------------------------------
create or replace function public.normalizar_telefono(p_telefono text)
returns text
language plpgsql
immutable
parallel safe
set search_path = pg_catalog
as $$
declare
  d text;
begin
  if p_telefono is null then
    return null;
  end if;
  d := regexp_replace(p_telefono, '\D', '', 'g');
  if d = '' then
    return null;
  end if;
  -- Con indicativo explícito (+ o 00): se respeta tal cual.
  if p_telefono ~ '^\s*(\+|00)' then
    d := regexp_replace(d, '^00', '');
    return case when length(d) between 8 and 15 then '+' || d end;
  end if;
  -- Celular colombiano sin indicativo.
  if d ~ '^3\d{9}$' then
    return '+57' || d;
  end if;
  -- Colombiano con 57 pero sin +.
  if d ~ '^573\d{9}$' then
    return '+' || d;
  end if;
  -- Internacional sin + (11 a 15 dígitos), igual que bulk-upload.ts.
  if length(d) between 11 and 15 then
    return '+' || d;
  end if;
  return null;
end;
$$;

comment on function public.normalizar_telefono(text) is
  'Formato internacional del celular (+57..., +54...). null si no es un celular válido.';

-- 2. Columna calculada e índices de búsqueda -------------------------------
alter table public.perfiles
  add column if not exists telefono_normalizado text
  generated always as (public.normalizar_telefono(telefono)) stored;

create index if not exists perfiles_telefono_normalizado_idx
  on public.perfiles (telefono_normalizado);

create index if not exists base_confianza_telefono_normalizado_idx
  on public.base_confianza (public.normalizar_telefono(telefono));

-- 3. estado_telefono -------------------------------------------------------
create or replace function public.estado_telefono(p_telefono text, p_excluir uuid default null)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when public.normalizar_telefono(p_telefono) is null then 'invalido'
    when exists (
      select 1 from public.perfiles p
      where p.telefono_normalizado = public.normalizar_telefono(p_telefono)
        and p.deleted_at is null
        and (p_excluir is null or p.id <> p_excluir)
    ) then 'en_uso'
    else 'disponible'
  end;
$$;

revoke all on function public.estado_telefono(text, uuid) from public;
grant execute on function public.estado_telefono(text, uuid) to anon, authenticated;

comment on function public.estado_telefono(text, uuid) is
  'invalido | en_uso | disponible. No expone a quién pertenece el número.';

-- 4. handle_new_user (igual a la de la Fase 0/1 salvo el teléfono) ----------
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
  v_telefono_norm text;
BEGIN
  v_status := 'inactivo';
  v_origen := 'registro_web';
  v_referido_por := NEW.raw_user_meta_data ->> 'referido_por';
  v_telefono_raw := NULLIF(btrim(NEW.raw_user_meta_data ->> 'telefono'), '');
  -- NUEVO (2c): número completo en formato internacional.
  v_telefono_norm := public.normalizar_telefono(v_telefono_raw);

  IF v_telefono_norm IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.base_confianza
    WHERE public.normalizar_telefono(telefono) = v_telefono_norm
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
    COALESCE(v_telefono_norm, v_telefono_raw),
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

  -- Fase 0/1: el login reconoce el correo desde el primer momento.
  IF NEW.email IS NOT NULL THEN
    INSERT INTO public.usuarios_publicos (uid, correo)
    VALUES (NEW.id, lower(NEW.email))
    ON CONFLICT (correo) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- ---------------------------------------------------------------------
-- -- 1) handle_new_user: volver a la versión de
-- --    supabase/migrations/20261015120000_fase0_existe_correo_y_usuarios_publicos.sql
-- --    (re-ejecutar solo su bloque "3. handle_new_user").
-- -- 2) Quitar lo agregado (antes, si se aplicó, la migración pendiente
-- --    20261016130200 debe revertirse: drop index perfiles_telefono_unico):
-- drop function if exists public.estado_telefono(text, uuid);
-- drop index if exists public.base_confianza_telefono_normalizado_idx;
-- drop index if exists public.perfiles_telefono_normalizado_idx;
-- alter table public.perfiles drop column if exists telefono_normalizado;
-- drop function if exists public.normalizar_telefono(text);
-- =====================================================================
