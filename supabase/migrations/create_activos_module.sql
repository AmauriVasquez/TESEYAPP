-- =============================================================================
-- Módulo Activos: categorías y activos (sin DELETE físico vía RLS)
-- Ejecutar en Supabase (migraciones o SQL editor).
-- =============================================================================

-- Función genérica de updated_at (nombre acotado al módulo por si ya existe otra)
CREATE OR REPLACE FUNCTION public.activos_module_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- categorias_activos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categorias_activos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    descripcion text,
    eliminado boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categorias_activos IS 'Catálogo de categorías para activos fijos. Baja lógica con eliminado.';

DROP INDEX IF EXISTS categorias_activos_nombre_activos_unique;
CREATE UNIQUE INDEX categorias_activos_nombre_activos_unique
    ON public.categorias_activos (lower(trim(nombre)))
    WHERE eliminado = false;

DROP TRIGGER IF EXISTS trg_categorias_activos_updated_at ON public.categorias_activos;
CREATE TRIGGER trg_categorias_activos_updated_at
    BEFORE UPDATE ON public.categorias_activos
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_module_touch_updated_at();

-- ---------------------------------------------------------------------------
-- activos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    categoria_id uuid NOT NULL REFERENCES public.categorias_activos(id) ON DELETE RESTRICT,
    descripcion text,
    costo_compra numeric NOT NULL DEFAULT 0 CHECK (costo_compra >= 0),
    fecha_adquisicion date NOT NULL,
    requiere_responsiva boolean NOT NULL DEFAULT false,
    requiere_mantenimiento boolean NOT NULL DEFAULT false,
    estado text NOT NULL DEFAULT 'activo'
        CHECK (estado IN ('activo', 'en_mantenimiento', 'baja', 'dispuesto')),
    eliminado boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.activos IS 'Activos de la empresa. Sin borrado físico desde la app: usar eliminado o estado baja.';

CREATE INDEX IF NOT EXISTS idx_activos_categoria_id ON public.activos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_activos_eliminado ON public.activos(eliminado);
CREATE INDEX IF NOT EXISTS idx_activos_estado ON public.activos(estado);

DROP TRIGGER IF EXISTS trg_activos_updated_at ON public.activos;
CREATE TRIGGER trg_activos_updated_at
    BEFORE UPDATE ON public.activos
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_module_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: SELECT / INSERT / UPDATE solamente (sin política DELETE = no borrado)
-- ---------------------------------------------------------------------------
ALTER TABLE public.categorias_activos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categorias_activos_select ON public.categorias_activos;
DROP POLICY IF EXISTS categorias_activos_insert ON public.categorias_activos;
DROP POLICY IF EXISTS categorias_activos_update ON public.categorias_activos;

CREATE POLICY categorias_activos_select
    ON public.categorias_activos FOR SELECT TO authenticated USING (true);

CREATE POLICY categorias_activos_insert
    ON public.categorias_activos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY categorias_activos_update
    ON public.categorias_activos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS activos_select ON public.activos;
DROP POLICY IF EXISTS activos_insert ON public.activos;
DROP POLICY IF EXISTS activos_update ON public.activos;

CREATE POLICY activos_select
    ON public.activos FOR SELECT TO authenticated USING (true);

CREATE POLICY activos_insert
    ON public.activos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY activos_update
    ON public.activos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
