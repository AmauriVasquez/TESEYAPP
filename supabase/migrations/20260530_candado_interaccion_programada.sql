-- Candado: un mismo prospecto no puede tener 2 interacciones PROGRAMADAS a la vez.
-- Se libera cuando la cita se completa (programada=false) o se cancela (eliminado=true).

-- 1) Resolver duplicados existentes: conservar la interacción programada más
--    reciente (por created_at) por prospecto y cancelar (soft delete) las demás.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY prospecto_id ORDER BY created_at DESC) AS rn
  FROM public.crm_interacciones
  WHERE programada = true AND eliminado = false AND prospecto_id IS NOT NULL
)
UPDATE public.crm_interacciones c
SET eliminado = true
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

-- 2) Índice único parcial: máximo 1 interacción programada activa por prospecto.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_interaccion_programada_por_prospecto
  ON public.crm_interacciones (prospecto_id)
  WHERE programada = true AND eliminado = false AND prospecto_id IS NOT NULL;
