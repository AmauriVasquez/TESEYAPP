-- 2026-06-23_fiscal_f2.sql  (FASE 2 — facturación en Ingresos)
-- Aditiva: tabla nueva `facturas`, columna nueva `proyecto_pagos.factura_id`,
-- índices y políticas RLS (espejo de finanzas_gastos: acciones ver/crear/editar/eliminar).
-- Aplicada en prod (czbmqzimjlwwgcglubey) el 2026-06-23 vía MCP execute_sql.

CREATE TABLE IF NOT EXISTS facturas (
  id              serial PRIMARY KEY,
  proyecto_id     integer NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  empresa_emisora text NOT NULL,             -- 'tesey' | 'ipe'
  numero          text NOT NULL,
  fecha_emision   date NOT NULL,
  monto           numeric,
  uuid            text NULL,
  url_cfdi        text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturas_numero_unico UNIQUE (numero),   -- folio único GLOBAL (decisión de negocio)
  CONSTRAINT facturas_uuid_unico   UNIQUE (uuid)
);

ALTER TABLE proyecto_pagos
  ADD COLUMN IF NOT EXISTS factura_id integer NULL REFERENCES facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_proyecto ON facturas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_pagos_factura ON proyecto_pagos(factura_id);

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY fac_select ON facturas FOR SELECT USING (tiene_permiso('finanzas'::text, 'ver'::text));
CREATE POLICY fac_insert ON facturas FOR INSERT WITH CHECK (tiene_permiso('finanzas'::text, 'crear'::text));
CREATE POLICY fac_update ON facturas FOR UPDATE USING (tiene_permiso('finanzas'::text, 'editar'::text)) WITH CHECK (tiene_permiso('finanzas'::text, 'editar'::text));
CREATE POLICY fac_delete ON facturas FOR DELETE USING (tiene_permiso('finanzas'::text, 'eliminar'::text));
