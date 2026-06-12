-- =============================================================================
-- Cotizador 02 — Funciones de costo vivo derivado de OC
-- =============================================================================

-- 1) Costo vigente de UN material según la regla activa en config_precios -------
CREATE OR REPLACE FUNCTION public.get_costo_vigente(p_material_id integer)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_regla text; v_n int; v_costo numeric;
BEGIN
  SELECT regla_costo, regla_costo_n INTO v_regla, v_n
  FROM public.config_precios WHERE vigente_hasta IS NULL LIMIT 1;
  v_regla := COALESCE(v_regla,'ultimo'); v_n := COALESCE(v_n,3);

  IF v_regla = 'promedio_ponderado_n' THEN
    SELECT SUM(t.precio_unitario * t.cantidad) / NULLIF(SUM(t.cantidad),0)
      INTO v_costo
    FROM (
      SELECT oci.precio_unitario, oci.cantidad, oc.fecha
      FROM public.ordenes_compra_items oci
      JOIN public.ordenes_compra oc ON oc.id = oci.orden_compra_id
      WHERE oci.material_id = p_material_id
        AND COALESCE(oci.precio_unitario,0) > 0
        AND COALESCE(oc.estatus,'') <> 'Cancelada'
      ORDER BY oc.fecha DESC NULLS LAST
      LIMIT v_n
    ) t;
  ELSE
    SELECT CASE v_regla
             WHEN 'promedio'  THEN costo_promedio
             WHEN 'mas_alto'  THEN costo_mas_alto
             ELSE costo_ultimo
           END
      INTO v_costo
    FROM public.get_costo_material(p_material_id);
  END IF;

  RETURN v_costo;
END $$;
GRANT EXECUTE ON FUNCTION public.get_costo_vigente(integer) TO authenticated, service_role;

-- 2) Panel: una fila por material con todas las métricas + costo vigente --------
CREATE OR REPLACE FUNCTION public.get_panel_costos()
RETURNS TABLE (
  material_id        integer,
  clave              text,
  descripcion        text,
  unidad_compra      text,
  num_compras        bigint,
  ultima_compra      timestamptz,
  costo_ultimo       numeric,
  costo_promedio     numeric,
  costo_mas_alto     numeric,
  costo_vigente      numeric,
  costo_compra_actual numeric,
  factor_conversion  numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    m.id,
    m.clave,
    m.descripcion,
    m.unidad_compra,
    COALESCE(h.num_compras, 0)        AS num_compras,
    h.ultima_compra,
    h.costo_ultimo,
    h.costo_promedio,
    h.costo_mas_alto,
    public.get_costo_vigente(m.id)    AS costo_vigente,
    m.costo_compra                    AS costo_compra_actual,
    m.factor_conversion
  FROM public.materiales m
  LEFT JOIN public.material_costos_historial h ON h.material_id = m.id
  ORDER BY (h.num_compras IS NULL), h.ultima_compra DESC NULLS LAST, m.descripcion;
$$;
GRANT EXECUTE ON FUNCTION public.get_panel_costos() TO authenticated, service_role;

-- 3) Recalcular y PERSISTIR el costo vigente de UN material en `materiales` -----
CREATE OR REPLACE FUNCTION public.recalcular_costo_material(p_material_id integer)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_costo numeric; v_factor numeric;
BEGIN
  v_costo := public.get_costo_vigente(p_material_id);
  IF v_costo IS NULL THEN RETURN NULL; END IF;
  SELECT factor_conversion INTO v_factor FROM public.materiales WHERE id = p_material_id;
  UPDATE public.materiales
     SET costo_compra   = v_costo,
         costo_unitario = CASE WHEN COALESCE(v_factor,0) > 0
                               THEN v_costo / v_factor ELSE v_costo END
   WHERE id = p_material_id;
  RETURN v_costo;
END $$;
GRANT EXECUTE ON FUNCTION public.recalcular_costo_material(integer) TO authenticated, service_role;

-- 4) Recalcular TODOS los materiales con compras. Devuelve cuántos cambió -------
CREATE OR REPLACE FUNCTION public.recalcular_costos_vigentes()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_n integer := 0; r record;
BEGIN
  FOR r IN
    SELECT DISTINCT oci.material_id AS id
    FROM public.ordenes_compra_items oci
    JOIN public.ordenes_compra oc ON oc.id = oci.orden_compra_id
    WHERE oci.material_id IS NOT NULL
      AND COALESCE(oci.precio_unitario,0) > 0
      AND COALESCE(oc.estatus,'') <> 'Cancelada'
  LOOP
    IF public.recalcular_costo_material(r.id::integer) IS NOT NULL THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END $$;
GRANT EXECUTE ON FUNCTION public.recalcular_costos_vigentes() TO authenticated, service_role;
