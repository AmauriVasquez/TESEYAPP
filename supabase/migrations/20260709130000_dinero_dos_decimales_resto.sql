-- 2026-07-09 · Normalización del resto de columnas de DINERO a numeric(12,2)
-- Continuación de 20260709120000: mismas garantías (el motor redondea en cada
-- escritura) para las 26 columnas de dinero restantes que eran numeric sin escala.
-- NO se tocan cantidades, pesos, factores de conversión, tasas, tipo_cambio ni KPIs
-- (esas necesitan más de 2 decimales o no son dinero).
-- Estado previo verificado: solo 2 filas con residuos de float en toda la BD;
-- máximos actuales muy por debajo del límite de numeric(12,2).
BEGIN;

-- Respaldo de las únicas 2 filas cuyo valor cambia con el redondeo
CREATE TABLE IF NOT EXISTS _bk_dinero_resto_20260709 AS
SELECT 'cotizaciones'::text AS tabla, id, 'descuento_monto'::text AS columna, descuento_monto AS valor
  FROM cotizaciones WHERE descuento_monto IS DISTINCT FROM round(descuento_monto, 2)
UNION ALL
SELECT 'cotizaciones_items', id, 'precio_unitario', precio_unitario
  FROM cotizaciones_items WHERE precio_unitario IS DISTINCT FROM round(precio_unitario, 2);

-- Única vista dependiente (usa ordenes_compra_items.precio_unitario); se recrea abajo.
DROP VIEW material_costos_historial;

ALTER TABLE activos                  ALTER COLUMN costo_compra      TYPE numeric(12,2);
ALTER TABLE catalogo_servicios       ALTER COLUMN precio_unitario   TYPE numeric(12,2);
ALTER TABLE cotizaciones             ALTER COLUMN descuento_monto   TYPE numeric(12,2);
ALTER TABLE cotizaciones_items       ALTER COLUMN costo_directo     TYPE numeric(12,2);
ALTER TABLE cotizaciones_items       ALTER COLUMN precio_unitario   TYPE numeric(12,2);
ALTER TABLE empleados                ALTER COLUMN salario_semanal   TYPE numeric(12,2);
ALTER TABLE facturas                 ALTER COLUMN monto             TYPE numeric(12,2);
ALTER TABLE finanzas_gastos          ALTER COLUMN monto             TYPE numeric(12,2);
ALTER TABLE grupos_pago              ALTER COLUMN monto_total       TYPE numeric(12,2);
ALTER TABLE inventario_movimientos   ALTER COLUMN costo_unitario    TYPE numeric(12,2);
ALTER TABLE mantenimientos           ALTER COLUMN costo_refacciones TYPE numeric(12,2);
ALTER TABLE materiales               ALTER COLUMN costo_compra      TYPE numeric(12,2);
ALTER TABLE materiales               ALTER COLUMN costo_unitario    TYPE numeric(12,2);
ALTER TABLE oc_facturas              ALTER COLUMN monto             TYPE numeric(12,2);
ALTER TABLE oc_pagos                 ALTER COLUMN monto             TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN iva               TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN monto_ieps        TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN monto_total       TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN retencion_isr     TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN retencion_iva     TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN subtotal          TYPE numeric(12,2);
ALTER TABLE ordenes_compra           ALTER COLUMN total             TYPE numeric(12,2);
ALTER TABLE ordenes_compra_items     ALTER COLUMN importe           TYPE numeric(12,2);
ALTER TABLE ordenes_compra_items     ALTER COLUMN precio_unitario   TYPE numeric(12,2);
ALTER TABLE pedidos_materiales_items ALTER COLUMN precio_unitario   TYPE numeric(12,2);
ALTER TABLE prospectos               ALTER COLUMN valor_estimado    TYPE numeric(12,2);
ALTER TABLE tarifas_produccion       ALTER COLUMN tarifa            TYPE numeric(12,2);

-- Vista recreada EXACTAMENTE como estaba (pg_get_viewdef), respeta RLS.
CREATE VIEW material_costos_historial WITH (security_invoker = on) AS
 WITH base AS (
         SELECT oci.material_id,
            oci.precio_unitario,
            oc.fecha AS fecha_efectiva
           FROM ordenes_compra_items oci
             JOIN ordenes_compra oc ON oc.id = oci.orden_compra_id
          WHERE oci.material_id IS NOT NULL
            AND oci.precio_unitario IS NOT NULL
            AND oci.precio_unitario > 0::numeric
            AND COALESCE(oc.estatus, ''::text) <> 'Cancelada'::text
        ), ranked AS (
         SELECT b_1.material_id,
            b_1.precio_unitario,
            row_number() OVER (PARTITION BY b_1.material_id ORDER BY b_1.fecha_efectiva DESC NULLS LAST) AS rn
           FROM base b_1
        ), ultimo AS (
         SELECT ranked.material_id,
            ranked.precio_unitario AS costo_ultimo
           FROM ranked
          WHERE ranked.rn = 1
        )
 SELECT b.material_id,
    max(b.precio_unitario) AS costo_mas_alto,
    round(avg(b.precio_unitario), 4) AS costo_promedio,
    u.costo_ultimo,
    count(*) AS num_compras,
    max(b.fecha_efectiva) AS ultima_compra
   FROM base b
     JOIN ultimo u ON u.material_id = b.material_id
  GROUP BY b.material_id, u.costo_ultimo;

-- Grants como estaban (authenticated + service_role; anon sin acceso)
GRANT ALL ON material_costos_historial TO authenticated, service_role;
REVOKE ALL ON material_costos_historial FROM anon;

COMMIT;

-- Verificación (esperado: 0 columnas de dinero sin escala en tablas; las que
-- queden son cantidades/pesos/factores/tasas/KPIs o vistas, a propósito):
-- SELECT c.table_name, c.column_name FROM information_schema.columns c
-- JOIN pg_class pc ON pc.relname = c.table_name AND pc.relkind = 'r'
-- WHERE c.table_schema='public' AND c.data_type='numeric' AND c.numeric_scale IS NULL
-- ORDER BY 1, 2;
