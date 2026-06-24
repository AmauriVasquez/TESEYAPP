-- 2026-06-23_ingresos_v2_f3.sql  (Ingresos V2 — F3: pago multi-proyecto)
-- Aditiva. Aplicada en prod (czbmqzimjlwwgcglubey) vía MCP el 2026-06-23.
-- grupos_pago = "el dinero que entró" (depósito); proyecto_pagos = aplicación a cada proyecto.

CREATE TABLE IF NOT EXISTS grupos_pago (
  id                  serial PRIMARY KEY,
  fecha               date NOT NULL,
  cuenta_value        text,
  referencia_bancaria text NULL,           -- semilla de conciliación bancaria (V3)
  monto_total         numeric NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE proyecto_pagos
  ADD COLUMN IF NOT EXISTS grupo_pago_id integer NULL REFERENCES grupos_pago(id) ON DELETE SET NULL;

-- Una factura puede abarcar varios proyectos (de la MISMA entidad); la relación
-- se deriva de los cobros ligados. proyecto_id queda como denormalización opcional (single).
ALTER TABLE facturas ALTER COLUMN proyecto_id DROP NOT NULL;

ALTER TABLE grupos_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY gp_select ON grupos_pago FOR SELECT USING (tiene_permiso('finanzas','ver'));
CREATE POLICY gp_insert ON grupos_pago FOR INSERT WITH CHECK (tiene_permiso('finanzas','crear'));
CREATE POLICY gp_update ON grupos_pago FOR UPDATE USING (tiene_permiso('finanzas','editar'));
