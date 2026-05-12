-- =============================================================================
-- Activos: ubicaciones, campos de detalle, estado_configuracion, historial
-- Ejecutar después de create_activos_module.sql (requiere tabla activos y función activos_module_touch_updated_at).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ubicaciones (catálogo para activos y otros módulos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ubicaciones (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    eliminado boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ubicaciones IS 'Ubicaciones físicas (nave, bodega, oficina, etc.).';

DROP INDEX IF EXISTS ubicaciones_nombre_activas_unique;
CREATE UNIQUE INDEX ubicaciones_nombre_activas_unique
    ON public.ubicaciones (lower(trim(nombre)))
    WHERE eliminado = false;

DROP TRIGGER IF EXISTS trg_ubicaciones_updated_at ON public.ubicaciones;
CREATE TRIGGER trg_ubicaciones_updated_at
    BEFORE UPDATE ON public.ubicaciones
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_module_touch_updated_at();

ALTER TABLE public.ubicaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ubicaciones_select ON public.ubicaciones;
DROP POLICY IF EXISTS ubicaciones_insert ON public.ubicaciones;
DROP POLICY IF EXISTS ubicaciones_update ON public.ubicaciones;

CREATE POLICY ubicaciones_select
    ON public.ubicaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY ubicaciones_insert
    ON public.ubicaciones FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY ubicaciones_update
    ON public.ubicaciones FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- activos: columnas de detalle
-- ---------------------------------------------------------------------------
ALTER TABLE public.activos
    ADD COLUMN IF NOT EXISTS marca text,
    ADD COLUMN IF NOT EXISTS modelo text,
    ADD COLUMN IF NOT EXISTS numero_serie text,
    ADD COLUMN IF NOT EXISTS ubicacion_id uuid REFERENCES public.ubicaciones(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS estado_configuracion text NOT NULL DEFAULT 'pendiente'
        CHECK (estado_configuracion IN ('pendiente', 'completo'));

COMMENT ON COLUMN public.activos.estado_configuracion IS 'pendiente = falta configuración documental/técnica; completo = listo.';

CREATE INDEX IF NOT EXISTS idx_activos_ubicacion_id ON public.activos(ubicacion_id);

UPDATE public.activos
SET estado_configuracion = 'pendiente'
WHERE estado_configuracion IS NULL;

-- ---------------------------------------------------------------------------
-- historial de activos (ubicación y futuros eventos)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos_historial (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
    tipo text NOT NULL DEFAULT 'general',
    mensaje text NOT NULL,
    meta jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activos_historial IS 'Bitácora de cambios del activo (ubicación, configuración, etc.).';

CREATE INDEX IF NOT EXISTS idx_activos_historial_activo_id ON public.activos_historial(activo_id);
CREATE INDEX IF NOT EXISTS idx_activos_historial_created_at ON public.activos_historial(created_at DESC);

ALTER TABLE public.activos_historial ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activos_historial_select ON public.activos_historial;
DROP POLICY IF EXISTS activos_historial_insert ON public.activos_historial;

CREATE POLICY activos_historial_select
    ON public.activos_historial FOR SELECT TO authenticated USING (true);

CREATE POLICY activos_historial_insert
    ON public.activos_historial FOR INSERT TO authenticated WITH CHECK (true);
