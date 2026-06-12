-- =============================================================================
-- Cotizador 01 — Config de precios (regla de costo vigente + porcentajes)
-- Singleton versionado por vigencia: la fila activa es la de vigente_hasta IS NULL.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.config_precios (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  regla_costo         text NOT NULL DEFAULT 'ultimo'
                      CHECK (regla_costo IN ('ultimo','promedio','promedio_ponderado_n','mas_alto')),
  regla_costo_n       integer NOT NULL DEFAULT 3 CHECK (regla_costo_n >= 1),
  indirectos_pct      numeric(6,3) NOT NULL DEFAULT 20.0,
  utilidad_pct        numeric(6,3) NOT NULL DEFAULT 30.0,
  iva_pct             numeric(6,3) NOT NULL DEFAULT 16.0,
  margen_objetivo_pct numeric(6,3) NOT NULL DEFAULT 30.0,
  margen_minimo_pct   numeric(6,3) NOT NULL DEFAULT 15.0,
  vigente_desde       timestamptz NOT NULL DEFAULT now(),
  vigente_hasta       timestamptz,
  usuario_id          uuid,
  created_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.config_precios IS
  'Regla de costo vigente y porcentajes de precio. Activa = vigente_hasta IS NULL.';

-- Solo una fila activa a la vez:
CREATE UNIQUE INDEX IF NOT EXISTS uq_config_precios_vigente
  ON public.config_precios ((true)) WHERE vigente_hasta IS NULL;

-- Semilla: una fila activa con los defaults (si no hay ninguna).
INSERT INTO public.config_precios (regla_costo)
SELECT 'ultimo'
WHERE NOT EXISTS (SELECT 1 FROM public.config_precios WHERE vigente_hasta IS NULL);

-- RLS -------------------------------------------------------------------------
ALTER TABLE public.config_precios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_precios_select ON public.config_precios;
CREATE POLICY config_precios_select ON public.config_precios
  FOR SELECT USING (public.tiene_permiso('materiales','ver'));

DROP POLICY IF EXISTS config_precios_insert ON public.config_precios;
CREATE POLICY config_precios_insert ON public.config_precios
  FOR INSERT WITH CHECK (public.tiene_permiso('materiales','editar'));

DROP POLICY IF EXISTS config_precios_update ON public.config_precios;
CREATE POLICY config_precios_update ON public.config_precios
  FOR UPDATE USING (public.tiene_permiso('materiales','editar'))
  WITH CHECK (public.tiene_permiso('materiales','editar'));
