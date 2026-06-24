-- 2026-06-24_ingresos_v3_iva_audit.sql  (Ingresos V3 — F3)
-- Aditiva. Aplicada en prod (czbmqzimjlwwgcglubey) vía MCP el 2026-06-24.
-- Auditoría de "Agregar IVA al precio" desde el modal de pago (quién y cuándo).
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS iva_aplicado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS iva_aplicado_at  timestamptz NULL;
