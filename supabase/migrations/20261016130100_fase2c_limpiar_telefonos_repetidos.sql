-- =====================================================================
-- Fase 2c — Limpieza de celulares repetidos (DATOS)
--
-- Requiere 20261016130000 (columna telefono_normalizado).
--
-- Regla acordada: cuando dos o más perfiles tienen el mismo celular, lo
-- conserva el perfil más antiguo; a los demás se les quita el teléfono para
-- que lo actualicen desde Mi perfil (la app les pide completarlo).
--
-- No se pierde nada: el número retirado queda en
-- datos_adicionales.telefono_anterior, con el motivo y la fecha.
-- Idempotente: si ya no hay repetidos, no hace nada.
-- Al 16 de octubre: 1 celular repetido en 2 perfiles (cuentas del equipo).
-- Rollback al final (comentado).
-- =====================================================================

with repetidos as (
  select
    id,
    row_number() over (
      partition by telefono_normalizado
      order by created_at nulls last, id
    ) as orden
  from public.perfiles
  where telefono_normalizado is not null
    and deleted_at is null
)
update public.perfiles p
set
  datos_adicionales = p.datos_adicionales || jsonb_build_object(
    'telefono_anterior', p.telefono,
    'telefono_retirado_motivo', 'celular repetido (fase 2c)',
    'telefono_retirado_at', now()
  ),
  telefono = null
from repetidos r
where r.id = p.id
  and r.orden > 1;

-- =====================================================================
-- ROLLBACK (ejecutar manualmente solo si hace falta revertir; antes hay que
-- revertir la migración pendiente 20261016130200 si se aplicó)
-- ---------------------------------------------------------------------
-- update public.perfiles
-- set telefono = datos_adicionales ->> 'telefono_anterior',
--     datos_adicionales = datos_adicionales
--       - 'telefono_anterior' - 'telefono_retirado_motivo' - 'telefono_retirado_at'
-- where datos_adicionales ->> 'telefono_retirado_motivo' = 'celular repetido (fase 2c)'
--   and telefono is null;
-- =====================================================================
