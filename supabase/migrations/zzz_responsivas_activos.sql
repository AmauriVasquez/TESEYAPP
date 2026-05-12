-- =============================================================================
-- Responsivas de activos: asignación, reasignación, documento PDF, entrega real.
-- Ejecutar después de public.activos y public.historial_activos (orden alfabético tras zzz_historial_*).
-- empleado_id apunta a public.empleados si existe; sin FK para no fallar si empleados no está en migraciones locales.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.responsivas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
    empleado_id uuid NOT NULL,
    fecha_asignacion timestamptz NOT NULL DEFAULT now(),
    fecha_devolucion timestamptz,
    fecha_entrega_real date,
    estatus text NOT NULL DEFAULT 'activa'
        CHECK (estatus IN ('activa', 'cerrada')),
    documento_url text,
    devolucion_validada boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.responsivas IS 'Cadena de responsivas por activo; solo una fila activa por activo a la vez.';
COMMENT ON COLUMN public.responsivas.devolucion_validada IS 'Al cerrar responsiva anterior (reasignación): confirmación explícita de devolución.';

CREATE INDEX IF NOT EXISTS idx_responsivas_activo_id ON public.responsivas(activo_id);
CREATE INDEX IF NOT EXISTS idx_responsivas_empleado_id ON public.responsivas(empleado_id);

DROP INDEX IF EXISTS responsivas_un_activa_por_activo;
CREATE UNIQUE INDEX responsivas_un_activa_por_activo
    ON public.responsivas (activo_id)
    WHERE estatus = 'activa';

DROP TRIGGER IF EXISTS trg_responsivas_updated_at ON public.responsivas;
CREATE TRIGGER trg_responsivas_updated_at
    BEFORE UPDATE ON public.responsivas
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_module_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Historial automático (asignación / devolución desde responsivas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.responsivas_registrar_historial_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.estatus = 'activa' THEN
        INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
        VALUES (
            NEW.activo_id,
            'asignacion',
            'Nueva responsiva: asignación formal del activo al empleado indicado.',
            NEW.empleado_id,
            now()
        );
    ELSIF TG_OP = 'UPDATE' AND OLD.estatus = 'activa' AND NEW.estatus = 'cerrada' THEN
        INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
        VALUES (
            NEW.activo_id,
            'devolucion',
            format(
                'Cierre de responsiva. Devolución del custodio anterior validada: %s.',
                CASE WHEN NEW.devolucion_validada THEN 'sí' ELSE 'no' END
            ),
            OLD.empleado_id,
            now()
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_responsivas_historial_ai ON public.responsivas;
CREATE TRIGGER trg_responsivas_historial_ai
    AFTER INSERT ON public.responsivas
    FOR EACH ROW
    EXECUTE PROCEDURE public.responsivas_registrar_historial_trg();

DROP TRIGGER IF EXISTS trg_responsivas_historial_au ON public.responsivas;
CREATE TRIGGER trg_responsivas_historial_au
    AFTER UPDATE ON public.responsivas
    FOR EACH ROW
    EXECUTE PROCEDURE public.responsivas_registrar_historial_trg();

-- ---------------------------------------------------------------------------
-- RPC: cierre atómico de responsiva activa + alta de la nueva (requisa confirmación)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activos_reasignar_responsiva(
    p_activo_id uuid,
    p_empleado_id uuid,
    p_fecha_asignacion timestamptz DEFAULT NULL,
    p_fecha_entrega_real date DEFAULT NULL,
    p_documento_url text DEFAULT NULL,
    p_fecha_devolucion_prev timestamptz DEFAULT NULL,
    p_confirmar_devolucion boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prev_id uuid;
    v_new_id uuid;
BEGIN
    SELECT r.id
    INTO v_prev_id
    FROM public.responsivas r
    WHERE r.activo_id = p_activo_id
      AND r.estatus = 'activa'
    LIMIT 1
    FOR UPDATE;

    IF v_prev_id IS NOT NULL THEN
        IF NOT p_confirmar_devolucion THEN
            RAISE EXCEPTION 'CONFIRMACION_DEVOLUCION_REQUERIDA'
                USING HINT = 'Debe confirmar la devolución del responsable anterior.';
        END IF;

        UPDATE public.responsivas
        SET
            fecha_devolucion = COALESCE(p_fecha_devolucion_prev, now()),
            estatus = 'cerrada',
            devolucion_validada = true
        WHERE id = v_prev_id;
    END IF;

    INSERT INTO public.responsivas (
        activo_id,
        empleado_id,
        fecha_asignacion,
        estatus,
        fecha_entrega_real,
        documento_url
    )
    VALUES (
        p_activo_id,
        p_empleado_id,
        COALESCE(p_fecha_asignacion, now()),
        'activa',
        p_fecha_entrega_real,
        p_documento_url
    )
    RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION public.activos_reasignar_responsiva IS 'Cierra responsiva activa (si existe, con confirmación) e inserta una nueva responsiva activa.';

REVOKE ALL ON FUNCTION public.activos_reasignar_responsiva(uuid, uuid, timestamptz, date, text, timestamptz, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activos_reasignar_responsiva(uuid, uuid, timestamptz, date, text, timestamptz, boolean) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.responsivas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS responsivas_select ON public.responsivas;
DROP POLICY IF EXISTS responsivas_insert ON public.responsivas;
DROP POLICY IF EXISTS responsivas_update ON public.responsivas;

CREATE POLICY responsivas_select
    ON public.responsivas FOR SELECT TO authenticated USING (true);

CREATE POLICY responsivas_insert
    ON public.responsivas FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY responsivas_update
    ON public.responsivas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
