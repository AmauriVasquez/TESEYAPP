-- =============================================================================
-- Entregas: cancelación lógica (estado activa | cancelada) + pendientes coherentes
-- Ejecutar en Supabase (SQL editor o migraciones).
-- =============================================================================

-- 1) Columna de estado (filas existentes = activas)
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'activa';

UPDATE public.entregas SET estado = 'activa' WHERE estado IS NULL OR estado = '';

COMMENT ON COLUMN public.entregas.estado IS 'activa = cuenta en pendientes; cancelada = histórico sin revertir filas en entregas_items';

-- 2) Vista: solo entregas activas suman cantidades
DROP VIEW IF EXISTS public.entregas_resumen;

CREATE VIEW public.entregas_resumen AS
SELECT
  ei.cotizacion_item_id,
  SUM(ei.cantidad_entregada)::numeric AS total_entregado
FROM public.entregas_items ei
INNER JOIN public.entregas e ON e.id = ei.entrega_id
WHERE e.estado = 'activa'
GROUP BY ei.cotizacion_item_id;

-- 3) RPC: ítems con pendiente (misma firma esperada por el front: id, descripcion, total, entregado, pendiente)
DROP FUNCTION IF EXISTS public.get_items_con_pendiente(bigint);
DROP FUNCTION IF EXISTS public.get_items_con_pendiente(integer);

CREATE OR REPLACE FUNCTION public.get_items_con_pendiente(cotizacion_id_input integer)
RETURNS TABLE (
  id bigint,
  descripcion text,
  observaciones text,
  total numeric,
  entregado numeric,
  pendiente numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ci.id,
    COALESCE(ci.descripcion, '')::text AS descripcion,
    COALESCE(ci.observaciones, '')::text AS observaciones,
    COALESCE(ci.cantidad, 0)::numeric AS total,
    COALESCE(SUM(ei.cantidad_entregada) FILTER (WHERE e.estado = 'activa'), 0)::numeric AS entregado,
    GREATEST(
      0,
      COALESCE(ci.cantidad, 0) - COALESCE(SUM(ei.cantidad_entregada) FILTER (WHERE e.estado = 'activa'), 0)
    )::numeric AS pendiente
  FROM public.cotizaciones_items ci
  LEFT JOIN public.entregas_items ei ON ei.cotizacion_item_id = ci.id
  LEFT JOIN public.entregas e ON e.id = ei.entrega_id
  WHERE ci.cotizacion_id = cotizacion_id_input
  GROUP BY ci.id, ci.descripcion, ci.observaciones, ci.cantidad;
$$;

-- 4) Tras cancelar una entrega, alinear estatus/estado del proyecto con el pendiente real
DROP FUNCTION IF EXISTS public.sync_proyecto_estado_entregas(integer);
DROP FUNCTION IF EXISTS public.sync_proyecto_estado_entregas(bigint);

CREATE OR REPLACE FUNCTION public.sync_proyecto_estado_entregas(p_proyecto_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotizacion_id integer;
  v_all_done boolean;
BEGIN
  SELECT cotizacion_id INTO v_cotizacion_id
  FROM public.proyectos
  WHERE id = p_proyecto_id;

  IF v_cotizacion_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.cotizaciones_items WHERE cotizacion_id = v_cotizacion_id) THEN
    RETURN;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1
    FROM public.cotizaciones_items ci
    LEFT JOIN public.entregas_items ei ON ei.cotizacion_item_id = ci.id
    LEFT JOIN public.entregas e ON e.id = ei.entrega_id
    WHERE ci.cotizacion_id = v_cotizacion_id
    GROUP BY ci.id, ci.cantidad
    HAVING GREATEST(
      0,
      COALESCE(ci.cantidad, 0) - COALESCE(SUM(ei.cantidad_entregada) FILTER (WHERE e.estado = 'activa'), 0)
    ) > 0
  )
  INTO v_all_done;

  IF v_all_done THEN
    UPDATE public.proyectos
    SET estatus = 'Entregado', estado = 'entregado'
    WHERE id = p_proyecto_id;
  ELSE
    UPDATE public.proyectos
    SET
      estado = 'parcial',
      estatus = CASE
        WHEN estatus = 'Entregado' THEN 'Terminado'
        ELSE estatus
      END
    WHERE id = p_proyecto_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_items_con_pendiente(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_proyecto_estado_entregas(integer) TO authenticated, service_role;
