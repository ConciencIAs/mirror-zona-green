-- =====================================================================
-- Fase 2b — Trazabilidad de referidos — Migración ADITIVA
--
-- Hasta ahora el vínculo "quién invitó a quién" era solo el texto del código
-- guardado en perfiles.referido_por. Si el admin revocaba o cambiaba el
-- código, se perdía a quién apuntaba (al 16 de octubre: 1 de 2 referidos
-- huérfano). Esta migración guarda la relación entre PERSONAS:
--
--   1. codigos_invitacion_historial: qué código tuvo cada perfil y cuándo.
--   2. referidos: una fila por persona referida, con su referente (perfil),
--      el código usado y el estado (resuelto | no_resuelto | asignado_manual).
--   3. Trigger en perfiles: al crearse un perfil con código, se registra la
--      relación (no modifica handle_new_user).
--   4. Controles básicos: un solo referente por persona, sin autorreferido,
--      referente activo, sin ciclos al asignar a mano, alerta si un código
--      supera 20 registros en 24 horas.
--   5. Funciones para el admin (árbol, ranking, no resueltos, asignar) y
--      mis_referidos_conteo() para cada usuario (solo el número).
--   6. Relleno idempotente con los referidos existentes.
--
-- Acceso: las tablas solo las lee el admin (RLS); nadie escribe directo, solo
-- las funciones. No borra ni modifica datos existentes.
-- Rollback al final (comentado).
-- =====================================================================

-- 1. Historial de códigos ----------------------------------------------------
create table if not exists public.codigos_invitacion_historial (
  id bigint generated always as identity primary key,
  perfil_id uuid not null references public.perfiles (id) on delete cascade,
  codigo text not null,
  activo_desde timestamptz not null default now(),
  activo_hasta timestamptz
);

create index if not exists codigos_invitacion_historial_codigo_idx
  on public.codigos_invitacion_historial (upper(btrim(codigo)));

alter table public.codigos_invitacion_historial enable row level security;

drop policy if exists "Historial códigos - Lectura admin" on public.codigos_invitacion_historial;
create policy "Historial códigos - Lectura admin" on public.codigos_invitacion_historial
  for select using (public.auth_user_role() = 'admin'::public.rol_usuario);

revoke insert, update, delete on public.codigos_invitacion_historial from anon, authenticated;
revoke all on public.codigos_invitacion_historial from anon;

create or replace function public.registrar_historial_codigo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.codigo_invitacion is not distinct from new.codigo_invitacion then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.codigo_invitacion is not null then
    update public.codigos_invitacion_historial
    set activo_hasta = now()
    where perfil_id = old.id
      and upper(btrim(codigo)) = upper(btrim(old.codigo_invitacion))
      and activo_hasta is null;
  end if;
  if new.codigo_invitacion is not null then
    insert into public.codigos_invitacion_historial (perfil_id, codigo)
    values (new.id, new.codigo_invitacion);
  end if;
  return new;
end;
$$;

revoke all on function public.registrar_historial_codigo() from public, anon, authenticated;

drop trigger if exists tr_historial_codigo_invitacion on public.perfiles;
create trigger tr_historial_codigo_invitacion
  after insert or update of codigo_invitacion on public.perfiles
  for each row execute function public.registrar_historial_codigo();

-- Códigos vigentes hoy (se desconoce el pasado: desde la última actualización).
insert into public.codigos_invitacion_historial (perfil_id, codigo, activo_desde)
select p.id, p.codigo_invitacion, coalesce(p.updated_at, p.created_at, now())
from public.perfiles p
where p.codigo_invitacion is not null
  and not exists (
    select 1 from public.codigos_invitacion_historial h
    where h.perfil_id = p.id
      and upper(btrim(h.codigo)) = upper(btrim(p.codigo_invitacion))
      and h.activo_hasta is null
  );

-- 2. Relaciones de referidos -------------------------------------------------
create table if not exists public.referidos (
  referido_id uuid primary key references public.perfiles (id) on delete cascade,
  referente_id uuid references public.perfiles (id) on delete set null,
  codigo_usado text not null,
  estado text not null default 'resuelto'
    check (estado in ('resuelto', 'no_resuelto', 'asignado_manual')),
  alerta text,
  nota text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.perfiles (id) on delete set null,
  constraint referidos_sin_autorreferido check (referente_id is null or referente_id <> referido_id)
);

create index if not exists referidos_referente_idx on public.referidos (referente_id);

alter table public.referidos enable row level security;

drop policy if exists "Referidos - Lectura admin" on public.referidos;
create policy "Referidos - Lectura admin" on public.referidos
  for select using (public.auth_user_role() = 'admin'::public.rol_usuario);

revoke insert, update, delete on public.referidos from anon, authenticated;
revoke all on public.referidos from anon;

-- Perfil ACTIVO dueño de un código (sin distinguir mayúsculas ni espacios).
create or replace function public.resolver_codigo_referido(p_codigo text)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id
  from public.perfiles p
  where upper(btrim(p.codigo_invitacion)) = upper(btrim(p_codigo))
    and p.status = 'activo'
    and p.deleted_at is null
  limit 1;
$$;

revoke all on function public.resolver_codigo_referido(text) from public, anon, authenticated;

-- El formulario de registro valida el código con esta función (ya existía).
-- Antes exigía el código exacto: "pra14229" no valía aunque el código fuera
-- "PRA14229". Ahora usa la misma regla que la resolución de arriba.
create or replace function public.validar_codigo_referido(codigo_prueba text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Retorna true si encuentra un perfil ACTIVO con ese código
  return public.resolver_codigo_referido(codigo_prueba) is not null;
end;
$$;

-- 3. Registro automático al crear un perfil con código ----------------------
create or replace function public.registrar_referido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo text := nullif(btrim(new.referido_por), '');
  v_referente uuid;
  v_alerta text;
begin
  if v_codigo is null then
    return new;
  end if;

  v_referente := public.resolver_codigo_referido(v_codigo);
  if v_referente = new.id then
    v_referente := null;
  end if;

  -- Control básico: más de 20 registros con el mismo referente en 24 horas.
  if v_referente is not null and (
    select count(*) from public.referidos r
    where r.referente_id = v_referente and r.creado_en > now() - interval '24 hours'
  ) >= 20 then
    v_alerta := 'mas_de_20_en_24h';
  end if;

  insert into public.referidos (referido_id, referente_id, codigo_usado, estado, alerta)
  values (
    new.id,
    v_referente,
    v_codigo,
    case when v_referente is null then 'no_resuelto' else 'resuelto' end,
    v_alerta
  )
  on conflict (referido_id) do nothing;

  return new;
end;
$$;

revoke all on function public.registrar_referido() from public, anon, authenticated;

drop trigger if exists tr_registrar_referido on public.perfiles;
create trigger tr_registrar_referido
  after insert on public.perfiles
  for each row execute function public.registrar_referido();

-- 4. Funciones para el admin ------------------------------------------------
create or replace function public.exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if public.auth_user_role() is distinct from 'admin'::public.rol_usuario then
    raise exception 'Solo un administrador puede consultar los referidos.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.exigir_admin() from public, anon, authenticated;

-- Árbol completo: cada perfil que refirió a alguien o fue referido, con su
-- nivel (1 = no tiene referente conocido) y la ruta desde la raíz.
create or replace function public.arbol_referidos()
returns table (
  perfil_id uuid,
  referente_id uuid,
  nivel int,
  ruta uuid[],
  full_name text,
  correo text,
  status public.status_profile,
  codigo_invitacion text,
  estado_relacion text,
  codigo_usado text,
  alerta text,
  registrado timestamptz,
  directos bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  perform public.exigir_admin();
  return query
  with recursive
  participantes as (
    select referido_id as id from public.referidos
    union
    select referente_id from public.referidos where referente_id is not null
  ),
  arbol as (
    select p.id, null::uuid as referente, 1 as nivel, array[p.id] as ruta
    from participantes x
    join public.perfiles p on p.id = x.id
    where not exists (
      select 1 from public.referidos r where r.referido_id = p.id and r.referente_id is not null
    )
    union all
    select r.referido_id, r.referente_id, a.nivel + 1, a.ruta || r.referido_id
    from public.referidos r
    join arbol a on r.referente_id = a.id
    where not r.referido_id = any (a.ruta)
  )
  select
    a.id, a.referente, a.nivel, a.ruta,
    p.full_name, p.correo, p.status, p.codigo_invitacion,
    r.estado, r.codigo_usado, r.alerta, p.created_at,
    (select count(*) from public.referidos d where d.referente_id = a.id)
  from arbol a
  join public.perfiles p on p.id = a.id
  left join public.referidos r on r.referido_id = a.id
  order by a.ruta;
end;
$$;

create or replace function public.ranking_referentes()
returns table (
  perfil_id uuid,
  full_name text,
  correo text,
  status public.status_profile,
  codigo_invitacion text,
  directos bigint,
  red_total bigint,
  ultimos_30_dias bigint,
  con_alerta bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  perform public.exigir_admin();
  return query
  with recursive red as (
    select r.referente_id as raiz, r.referido_id as id, array[r.referente_id, r.referido_id] as ruta
    from public.referidos r
    where r.referente_id is not null
    union all
    select red.raiz, r.referido_id, red.ruta || r.referido_id
    from public.referidos r
    join red on r.referente_id = red.id
    where not r.referido_id = any (red.ruta)
  )
  select
    p.id, p.full_name, p.correo, p.status, p.codigo_invitacion,
    (select count(*) from public.referidos d where d.referente_id = p.id),
    (select count(distinct red.id) from red where red.raiz = p.id),
    (select count(*) from public.referidos d where d.referente_id = p.id and d.creado_en > now() - interval '30 days'),
    (select count(*) from public.referidos d where d.referente_id = p.id and d.alerta is not null)
  from public.perfiles p
  where exists (select 1 from public.referidos d where d.referente_id = p.id)
  order by 7 desc, 6 desc, p.full_name;
end;
$$;

create or replace function public.admin_asignar_referente(p_referido uuid, p_referente uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.exigir_admin();
  if p_referido = p_referente then
    raise exception 'Una persona no puede ser su propio referente.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfiles where id = p_referente and deleted_at is null) then
    raise exception 'El referente no existe.' using errcode = '22023';
  end if;
  -- Sin ciclos: el nuevo referente no puede estar en la red del referido.
  if exists (
    with recursive red as (
      select referido_id as id from public.referidos where referente_id = p_referido
      union
      select r.referido_id from public.referidos r join red on r.referente_id = red.id
    )
    select 1 from red where id = p_referente
  ) then
    raise exception 'Esa asignación formaría un ciclo en el árbol.' using errcode = '22023';
  end if;

  insert into public.referidos (referido_id, referente_id, codigo_usado, estado, nota, actualizado_por)
  values (p_referido, p_referente, coalesce((select referido_por from public.perfiles where id = p_referido), '(manual)'),
          'asignado_manual', p_nota, auth.uid())
  on conflict (referido_id) do update
    set referente_id = excluded.referente_id,
        estado = 'asignado_manual',
        nota = excluded.nota,
        actualizado_en = now(),
        actualizado_por = auth.uid();
end;
$$;

-- Supabase concede EXECUTE a anon y authenticated en cada función nueva: se
-- quita a todos y se da solo a authenticated (las funciones exigen admin).
revoke all on function public.arbol_referidos() from public, anon, authenticated;
revoke all on function public.ranking_referentes() from public, anon, authenticated;
revoke all on function public.admin_asignar_referente(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.arbol_referidos() to authenticated;
grant execute on function public.ranking_referentes() to authenticated;
grant execute on function public.admin_asignar_referente(uuid, uuid, text) to authenticated;

-- 5. Cada usuario: solo cuántas personas se registraron con su código -------
create or replace function public.mis_referidos_conteo()
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int from public.referidos where referente_id = auth.uid();
$$;

revoke all on function public.mis_referidos_conteo() from public, anon, authenticated;
grant execute on function public.mis_referidos_conteo() to authenticated;

-- 6. Relleno idempotente con los referidos existentes ------------------------
insert into public.referidos (referido_id, referente_id, codigo_usado, estado, creado_en, nota)
select
  p.id,
  case when ref.id = p.id then null else ref.id end,
  btrim(p.referido_por),
  case when ref.id is null or ref.id = p.id then 'no_resuelto' else 'resuelto' end,
  coalesce(p.created_at, now()),
  case when ref.id is null then 'Relleno fase 2b: el código ya no pertenece a ningún perfil activo.' end
from public.perfiles p
left join lateral (
  select public.resolver_codigo_referido(p.referido_por) as id
) ref on true
where nullif(btrim(p.referido_por), '') is not null
on conflict (referido_id) do nothing;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir)
-- ---------------------------------------------------------------------
-- drop trigger if exists tr_registrar_referido on public.perfiles;
-- drop trigger if exists tr_historial_codigo_invitacion on public.perfiles;
-- drop function if exists public.mis_referidos_conteo();
-- drop function if exists public.admin_asignar_referente(uuid, uuid, text);
-- drop function if exists public.ranking_referentes();
-- drop function if exists public.arbol_referidos();
-- drop function if exists public.exigir_admin();
-- drop function if exists public.registrar_referido();
-- -- validar_codigo_referido vuelve a la versión anterior ANTES de borrar el resolver:
-- create or replace function public.validar_codigo_referido(codigo_prueba text)
-- returns boolean language plpgsql security definer as $$
-- begin
--   return exists (select 1 from public.perfiles
--                  where codigo_invitacion = codigo_prueba and status = 'activo');
-- end; $$;
-- drop function if exists public.resolver_codigo_referido(text);
-- drop function if exists public.registrar_historial_codigo();
-- -- Las tablas guardan la trazabilidad: antes de borrarlas, exportarlas.
-- drop table if exists public.referidos;
-- drop table if exists public.codigos_invitacion_historial;
-- (perfiles.referido_por no se modificó: el dato original sigue ahí.)
-- =====================================================================
