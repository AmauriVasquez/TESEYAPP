-- ============================================================
-- MÓDULO DE FINANZAS TESEY - Supabase / PostgreSQL
-- Integrado con proyecto_pagos (ingresos en Proyectos y Dashboard)
-- Ejecutar en el Editor SQL de Supabase
-- ============================================================

-- ------------------------------------------------------------
-- 1. INGRESOS: Vista sobre proyecto_pagos (una sola fuente de verdad)
-- Los pagos se registran en proyecto_pagos desde Proyectos.
-- El Dashboard y el futuro módulo Finanzas leen los mismos datos.
-- ------------------------------------------------------------

DROP TABLE IF EXISTS public.finanzas_ingresos CASCADE;

CREATE OR REPLACE VIEW public.finanzas_ingresos AS
SELECT
    id,
    proyecto_id,
    monto,
    fecha_pago AS fecha,
    metodo_pago,
    comentarios AS referencia,
    'estimacion'::text AS tipo_pago,
    url_cfdi AS evidencia_url,
    (fecha_pago::timestamptz) AS created_at
FROM public.proyecto_pagos;

COMMENT ON VIEW public.finanzas_ingresos IS 'Vista de ingresos: misma fuente que Proyectos y Dashboard (proyecto_pagos). No duplicar datos.';

-- ------------------------------------------------------------
-- 2. TABLA finanzas_gastos (solo gastos; ingresos = proyecto_pagos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.finanzas_gastos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id integer REFERENCES public.proyectos(id) ON DELETE SET NULL,
    monto numeric NOT NULL CHECK (monto >= 0),
    fecha timestamptz NOT NULL DEFAULT now(),
    categoria text NOT NULL CHECK (categoria IN ('material', 'mano_obra', 'indirecto', 'administrativo')),
    proveedor text,
    descripcion text,
    factura_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.finanzas_gastos IS 'Gastos de proyectos o gastos generales (proyecto_id NULL). Ingresos = proyecto_pagos.';

CREATE INDEX IF NOT EXISTS idx_finanzas_gastos_proyecto_id ON public.finanzas_gastos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_gastos_fecha ON public.finanzas_gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_finanzas_gastos_categoria ON public.finanzas_gastos(categoria);

-- ------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) - solo en finanzas_gastos
-- La vista finanzas_ingresos usa el RLS de proyecto_pagos.
-- ------------------------------------------------------------

ALTER TABLE public.finanzas_gastos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver gastos" ON public.finanzas_gastos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar gastos" ON public.finanzas_gastos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar gastos" ON public.finanzas_gastos;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar gastos" ON public.finanzas_gastos;

CREATE POLICY "Usuarios autenticados pueden ver gastos"
    ON public.finanzas_gastos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar gastos"
    ON public.finanzas_gastos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar gastos"
    ON public.finanzas_gastos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar gastos"
    ON public.finanzas_gastos FOR DELETE TO authenticated USING (true);

-- ------------------------------------------------------------
-- FIN DEL SCRIPT
-- ------------------------------------------------------------
