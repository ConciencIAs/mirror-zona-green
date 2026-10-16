-- =====================================================================
-- Fase 2c — Un celular por persona — Migración RESTRICTIVA (pendiente)
--
-- Aplicar SOLO cuando:
--   1. ya se aplicaron 20261016130000 y 20261016130100 (limpieza), y
--   2. está desplegado el frontend de la Fase 2c (avisa "Este celular ya
--      está registrado" antes de intentar guardar).
--
-- Desde aquí la base rechaza cualquier registro o cambio de perfil que use
-- un celular que ya tiene otra persona (perfiles no eliminados).
-- Si todavía quedara algún repetido, esta migración FALLA sin cambiar nada:
-- en ese caso, volver a correr la limpieza 20261016130100.
-- =====================================================================

create unique index if not exists perfiles_telefono_unico
  on public.perfiles (telefono_normalizado)
  where telefono_normalizado is not null
    and deleted_at is null;

-- =====================================================================
-- ROLLBACK
-- ---------------------------------------------------------------------
-- drop index if exists public.perfiles_telefono_unico;
-- =====================================================================
