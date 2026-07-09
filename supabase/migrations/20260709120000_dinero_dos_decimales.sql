-- 2026-07-09 · Adeudos fantasma (PRJ-2026-0145 / PRJ-2026-0174)
-- Causa: cotizaciones.total guardaba floats de JS sin redondear (3259.7623999999996)
-- y los pagos van a 2 decimales; el filtro saldo > 0 mostraba deudas de milésimas.
-- Fix estructural: columnas de dinero a numeric(12,2) — el motor redondea en cada
-- escritura, cubre las ~6 rutas del front y cualquier futura. El cast del ALTER
-- redondea (half-even) las filas sucias existentes (13 total, 9 monto_aprobado, 2 pagos).
BEGIN;

-- Respaldo para rollback puntual (UPDATE ... FROM _bk_... por id)
CREATE TABLE IF NOT EXISTS _bk_cotizaciones_20260709 AS
  SELECT id, total, monto_aprobado FROM cotizaciones;
CREATE TABLE IF NOT EXISTS _bk_proyecto_pagos_20260709 AS
  SELECT id, monto FROM proyecto_pagos;

-- Postgres no permite ALTER TYPE con vistas dependientes: se recrean idénticas abajo.
DROP VIEW finanzas_ingresos;
DROP VIEW v_cotizaciones_analitica;
DROP VIEW v_proyecto_pago_progreso;

ALTER TABLE cotizaciones   ALTER COLUMN total          TYPE numeric(12,2);
ALTER TABLE cotizaciones   ALTER COLUMN monto_aprobado TYPE numeric(12,2);
ALTER TABLE proyecto_pagos ALTER COLUMN monto          TYPE numeric(12,2);

-- Vistas recreadas EXACTAMENTE como estaban (definición tomada de pg_get_viewdef),
-- con security_invoker=on para respetar RLS de las tablas base.
CREATE VIEW finanzas_ingresos WITH (security_invoker = on) AS
 SELECT id,
    proyecto_id,
    monto,
    fecha_pago AS fecha,
    metodo_pago,
    comentarios AS referencia,
    'estimacion'::text AS tipo_pago,
    url_cfdi AS evidencia_url,
    fecha_pago::timestamp with time zone AS created_at
   FROM proyecto_pagos;

CREATE VIEW v_cotizaciones_analitica WITH (security_invoker = on) AS
 SELECT c.id,
    c.folio,
    c.fecha,
    c.branding AS empresa_emisora,
    c.marca_comercial,
    c.estatus,
    c.total,
    c.aplica_iva,
    c.descuento_porcentaje,
    c.version,
    c.es_ultima_version,
    COALESCE(cl.nombre, c.cliente_nombre_externo, 'Cliente externo'::text) AS cliente_nombre,
    c.cliente_id,
    c.usuario_cotizacion,
        CASE
            WHEN c.aplica_iva THEN round(c.total / 1.16, 2)
            ELSE c.total
        END AS subtotal_sin_iva,
        CASE
            WHEN c.aplica_iva THEN round(c.total - c.total / 1.16, 2)
            ELSE 0::numeric
        END AS monto_iva,
    EXTRACT(year FROM c.fecha) AS anio,
    EXTRACT(month FROM c.fecha) AS mes,
    to_char(c.fecha::timestamp with time zone, 'YYYY-MM'::text) AS periodo
   FROM cotizaciones c
     LEFT JOIN clientes cl ON cl.id = c.cliente_id
  WHERE c.es_ultima_version = true;

CREATE VIEW v_proyecto_pago_progreso WITH (security_invoker = on) AS
 SELECT p.id AS proyecto_id,
    COALESCE(c.total, p.costo_total)::numeric(14,2) AS costo_total,
    COALESCE(sum(pp.monto), 0::numeric) AS total_pagado,
        CASE
            WHEN COALESCE(c.total, p.costo_total, 0::numeric) > 0::numeric
              THEN LEAST(100::numeric, round(COALESCE(sum(pp.monto), 0::numeric) / COALESCE(c.total, p.costo_total) * 100::numeric, 1))
            ELSE 0::numeric
        END AS pct_pagado
   FROM proyectos p
     LEFT JOIN cotizaciones c ON c.id = p.cotizacion_id
     LEFT JOIN proyecto_pagos pp ON pp.proyecto_id = p.id
  GROUP BY p.id, c.total, p.costo_total;

-- Grants como estaban (authenticated + service_role; anon NO tenía acceso)
GRANT ALL ON finanzas_ingresos, v_cotizaciones_analitica, v_proyecto_pago_progreso TO authenticated, service_role;
REVOKE ALL ON finanzas_ingresos, v_cotizaciones_analitica, v_proyecto_pago_progreso FROM anon;

COMMIT;

-- Verificación (esperado: total = pagado, saldo 0 en ambos):
-- SELECT p.folio, c.total,
--        (SELECT COALESCE(SUM(monto),0) FROM proyecto_pagos WHERE proyecto_id = p.id) AS pagado
-- FROM proyectos p JOIN cotizaciones c ON c.id = p.cotizacion_id
-- WHERE p.folio IN ('PRJ-2026-0145','PRJ-2026-0174');
