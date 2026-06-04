-- =============================================================================
-- Compras 05 — Historial de costos por material (para el cotizador)
-- =============================================================================
-- Deriva, por material, el costo MÁS ALTO, PROMEDIO y ÚLTIMO a partir de
-- `ordenes_compra_items`, considerando solo OC NO canceladas. Sin captura manual.
-- Se expone como vista y como función; el cotizador podrá consumirlo después.
--
-- Convención: función con SET search_path = pg_catalog, public.
-- =============================================================================

-- 1) Vista: una fila por material con sus métricas de costo --------------------
CREATE OR REPLACE VIEW public.material_costos_historial AS
WITH base AS (
  SELECT
    oci.material_id,
    oci.precio_unitario::numeric          AS precio_unitario,
    COALESCE(oc.fecha, oc.created_at)     AS fecha_efectiva,
    oc.created_at                         AS created_at
  FROM public.ordenes_compra_items oci
  JOIN public.ordenes_compra oc
    ON oc.id = oci.orden_compra_id
  WHERE oci.material_id IS NOT NULL
    AND oci.precio_unitario IS NOT NULL
    AND oci.precio_unitario > 0
    AND COALESCE(oc.estatus, '') <> 'Cancelada'
),
ranked AS (
  SELECT
    b.material_id,
    b.precio_unitario,
    ROW_NUMBER() OVER (
      PARTITION BY b.material_id
      ORDER BY b.fecha_efectiva DESC NULLS LAST, b.created_at DESC NULLS LAST
    ) AS rn
  FROM base b
),
ultimo AS (
  SELECT material_id, precio_unitario AS costo_ultimo
  FROM ranked
  WHERE rn = 1
)
SELECT
  b.material_id,
  MAX(b.precio_unitario)            AS costo_mas_alto,
  ROUND(AVG(b.precio_unitario), 4)  AS costo_promedio,
  u.costo_ultimo,
  COUNT(*)                          AS num_compras,
  MAX(b.fecha_efectiva)             AS ultima_compra
FROM base b
JOIN ultimo u ON u.material_id = b.material_id
GROUP BY b.material_id, u.costo_ultimo;

COMMENT ON VIEW public.material_costos_historial IS
  'Costo más alto, promedio y último por material desde ordenes_compra_items (OC no canceladas).';

-- 2) Función puntual por material (para el cotizador) ------------------------
CREATE OR REPLACE FUNCTION public.get_costo_material(p_material_id integer)
RETURNS TABLE (
  material_id    integer,
  costo_mas_alto numeric,
  costo_promedio numeric,
  costo_ultimo   numeric,
  num_compras    bigint,
  ultima_compra  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  WITH base AS (
    SELECT
      oci.precio_unitario::numeric AS precio_unitario,
      COALESCE(oc.fecha, oc.created_at) AS fecha_efectiva
    FROM public.ordenes_compra_items oci
    JOIN public.ordenes_compra oc ON oc.id = oci.orden_compra_id
    WHERE oci.material_id = p_material_id
      AND oci.precio_unitario IS NOT NULL
      AND oci.precio_unitario > 0
      AND COALESCE(oc.estatus, '') <> 'Cancelada'
  )
  SELECT
    p_material_id AS material_id,
    MAX(precio_unitario) AS costo_mas_alto,
    ROUND(AVG(precio_unitario), 4) AS costo_promedio,
    (SELECT precio_unitario FROM base ORDER BY fecha_efectiva DESC NULLS LAST LIMIT 1) AS costo_ultimo,
    COUNT(*) AS num_compras,
    MAX(fecha_efectiva) AS ultima_compra
  FROM base;
$function$;

GRANT EXECUTE ON FUNCTION public.get_costo_material(integer) TO authenticated, service_role;

-- Nota: `material_costos_historial` es una vista; hereda permisos de las tablas
-- base (RLS de ordenes_compra/_items aplica al consultarla desde la app).
