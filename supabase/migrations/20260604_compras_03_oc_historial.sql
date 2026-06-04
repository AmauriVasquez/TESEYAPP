-- =============================================================================
-- Compras 03 — Historial / versionado de Órdenes de Compra
-- =============================================================================
-- Editar una OC genera una nueva versión (OC-XXX vN) y registra la razón del
-- cambio. Se guarda un snapshot del estado de la OC + sus partidas al momento de
-- la edición, junto con la razón, la versión resultante y quién la hizo.
--
-- Convención: RLS por tiene_permiso('compras', ..., 'ordenes').
-- =============================================================================

-- 1) Columna de versión en ordenes_compra -----------------------------------
ALTER TABLE public.ordenes_compra
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.ordenes_compra.version IS
  'Número de versión de la OC. 1 = original; se incrementa en cada edición con razón.';

-- 2) Tabla de historial ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ordenes_compra_historial (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oc_id          uuid NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  version        integer NOT NULL,
  razon          text NOT NULL,
  cambios        jsonb,        -- diff de campos { campo: { antes, despues } } (opcional)
  snapshot       jsonb,        -- estado completo de la OC + partidas tras la edición
  usuario_id     uuid,         -- auth.uid() del editor (sin FK dura para no acoplar)
  usuario_nombre text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ordenes_compra_historial IS
  'Bitácora de versiones de cada OC: razón del cambio, diff y snapshot por versión.';

CREATE INDEX IF NOT EXISTS idx_oc_historial_oc_id
  ON public.ordenes_compra_historial(oc_id);
CREATE INDEX IF NOT EXISTS idx_oc_historial_oc_version
  ON public.ordenes_compra_historial(oc_id, version);

-- 3) RLS ---------------------------------------------------------------------
ALTER TABLE public.ordenes_compra_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS och_select ON public.ordenes_compra_historial;
CREATE POLICY och_select ON public.ordenes_compra_historial
  FOR SELECT
  USING (public.tiene_permiso('compras', 'ver', 'ordenes'));

DROP POLICY IF EXISTS och_insert ON public.ordenes_compra_historial;
CREATE POLICY och_insert ON public.ordenes_compra_historial
  FOR INSERT
  WITH CHECK (public.tiene_permiso('compras', 'editar', 'ordenes'));

-- Historial inmutable: sin policies de UPDATE/DELETE (denegado por defecto a la app).
