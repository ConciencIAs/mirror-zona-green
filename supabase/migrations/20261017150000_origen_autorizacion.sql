-- =====================================================================
-- Origen de autorización: solo 3 tipos
--
-- Pedido del cliente (pruebas): el origen de autorización de cada perfil es
--   * base_confianza          — el celular coincidió con la base de confianza
--   * registro_web_con_codigo — se registró con código de referido
--   * registro_web_sin_codigo — se registró sin código
-- y desaparece "invitacion_de_admin".
--
-- 1. handle_new_user: asigna el origen al registrarse (igual que la versión
--    anterior salvo la línea de v_origen). El administrador ya no lo elige al
--    autorizar (el frontend dejó de enviarlo).
-- 2. Reclasificación de los perfiles que ya existen: los de registro_web, los de
--    invitacion_de_admin y los sin origen pasan a con_codigo o sin_codigo según
--    tengan o no referido_por. base_confianza no se toca. No se borra nada.
--    Los valores anteriores quedan respaldados en respaldo_origen_autorizacion.
--
-- Orden de despliegue: ANTES de mergear el PR no hace falta; es compatible con
-- el frontend actual (que ignora el valor). Mejor aplicarla justo antes del merge.
-- Rollback al final (comentado).
-- =====================================================================

-- 1. handle_new_user ----------------------------------------------------------
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
  v_origen := CASE WHEN NULLIF(btrim(COALESCE(NEW.raw_user_meta_data ->> 'referido_por', '')), '') IS NOT NULL THEN 'registro_web_con_codigo' ELSE 'registro_web_sin_codigo' END;
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

-- 2. Respaldo y reclasificación ---------------------------------------------------
create table if not exists public.respaldo_origen_autorizacion (
  perfil_id uuid primary key,
  origen_anterior text,
  respaldado_en timestamptz not null default now()
);
alter table public.respaldo_origen_autorizacion enable row level security;
revoke all on public.respaldo_origen_autorizacion from anon, authenticated;

insert into public.respaldo_origen_autorizacion (perfil_id, origen_anterior)
select id, origen_autorizacion from public.perfiles
where origen_autorizacion is distinct from 'base_confianza'
on conflict (perfil_id) do nothing;

update public.perfiles
set origen_autorizacion = case
      when nullif(btrim(coalesce(referido_por, '')), '') is not null then 'registro_web_con_codigo'
      else 'registro_web_sin_codigo'
    end
where origen_autorizacion is distinct from 'base_confianza';

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- =====================================================================
-- update public.perfiles p
-- set origen_autorizacion = r.origen_anterior
-- from public.respaldo_origen_autorizacion r where r.perfil_id = p.id;
--
-- handle_new_user: volver a la versión de 20261017120000_cancelar_pedido_y_registro.sql
-- (re-ejecutar su sección "3. handle_new_user").
