-- =====================================================================
-- Fase 3 — Edad mínima de 18 años — Migración RESTRICTIVA (pendiente)
--
-- Aplicar SOLO después de desplegar el frontend de la Fase 3, que valida la
-- edad en el registro y en Mi perfil con un mensaje claro. Sin ese frontend,
-- un menor que intente registrarse vería un error genérico.
--
-- Desde aquí la base rechaza un perfil con fecha de nacimiento de menos de
-- 18 años (o en el futuro) al registrarse o al CAMBIAR la fecha. Los perfiles
-- existentes no se tocan (al 16 de octubre, 6 cuentas de prueba tienen la
-- fecha de hoy): Mi perfil les pide corregirla.
-- El admin y el sistema (service_role) no quedan limitados.
-- =====================================================================

create or replace function public.validar_edad_minima()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.fecha_nacimiento is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.fecha_nacimiento is not distinct from old.fecha_nacimiento then
    return new;
  end if;
  if public.auth_user_role() = 'admin'::public.rol_usuario or auth.role() = 'service_role' then
    return new;
  end if;
  if new.fecha_nacimiento > (current_date - interval '18 years')::date then
    raise exception 'Debes ser mayor de 18 años para registrarte en Cheyn Verde.'
      using errcode = '22023', hint = 'edad_minima';
  end if;
  return new;
end;
$$;

revoke all on function public.validar_edad_minima() from public, anon, authenticated;

drop trigger if exists tr_validar_edad_minima on public.perfiles;
create trigger tr_validar_edad_minima
  before insert or update of fecha_nacimiento on public.perfiles
  for each row execute function public.validar_edad_minima();

-- =====================================================================
-- ROLLBACK
-- ---------------------------------------------------------------------
-- drop trigger if exists tr_validar_edad_minima on public.perfiles;
-- drop function if exists public.validar_edad_minima();
-- =====================================================================
