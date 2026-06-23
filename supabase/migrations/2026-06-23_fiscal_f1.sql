-- 2026-06-23_fiscal_f1.sql  (FASE 1 — control fiscal en Ingresos)
-- Aditiva: solo agrega columnas nuevas y rellena esas columnas nuevas.
-- Aplicada en prod (czbmqzimjlwwgcglubey) el 2026-06-23 vía MCP execute_sql.

ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS requiere_cfdi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS factura_descartada boolean NOT NULL DEFAULT false;

ALTER TABLE proyecto_pagos
  ADD COLUMN IF NOT EXISTS cuenta_value text;

-- Backfill: requiere_cfdi desde aplica_iva de la cotización.
UPDATE proyectos p
SET requiere_cfdi = COALESCE(c.aplica_iva, false)
FROM cotizaciones c
WHERE c.id = p.cotizacion_id;

-- Backfill best-effort de cuenta_value desde el texto libre histórico.
-- 'Transferencia' y 'Tarjeta de Crédito/Débito' NO se reclasifican
-- (facturabilidad histórica desconocida): quedan NULL.
UPDATE proyecto_pagos SET cuenta_value = 'efectivo'
WHERE cuenta_value IS NULL AND metodo_pago = 'Efectivo';
