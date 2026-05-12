-- =============================================================================
-- historial_activos: trazabilidad automática (alta, ubicación, estado, baja, etc.)
-- Ejecutar después de las migraciones de activos (tabla public.activos).
-- Si historial_activos ya existía, se ajustan columnas faltantes de forma idempotente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabla historial_activos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.historial_activos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
    tipo_evento text NOT NULL,
    descripcion text NOT NULL,
    empleado_id uuid,
    fecha timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.historial_activos IS 'Bitácora cronológica de eventos del activo (triggers + inserciones manuales futuras).';

ALTER TABLE public.historial_activos
    DROP CONSTRAINT IF EXISTS historial_activos_tipo_evento_check;

ALTER TABLE public.historial_activos
    ADD CONSTRAINT historial_activos_tipo_evento_check CHECK (
        tipo_evento IN (
            'alta',
            'cambio_ubicacion',
            'cambio_estado',
            'asignacion',
            'devolucion',
            'mantenimiento',
            'baja'
        )
    );

CREATE INDEX IF NOT EXISTS idx_historial_activos_activo_fecha
    ON public.historial_activos (activo_id, fecha DESC);

-- Columnas por si la tabla ya existía con otro esquema mínimo
ALTER TABLE public.historial_activos
    ADD COLUMN IF NOT EXISTS empleado_id uuid;

ALTER TABLE public.historial_activos
    ADD COLUMN IF NOT EXISTS fecha timestamptz NOT NULL DEFAULT now();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.historial_activos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historial_activos_select ON public.historial_activos;
DROP POLICY IF EXISTS historial_activos_insert ON public.historial_activos;

CREATE POLICY historial_activos_select
    ON public.historial_activos FOR SELECT TO authenticated USING (true);

CREATE POLICY historial_activos_insert
    ON public.historial_activos FOR INSERT TO authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Trigger: registra eventos en INSERT/UPDATE de activos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activos_registrar_historial_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_baja boolean;
    v_has_cfg boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
        VALUES (
            NEW.id,
            'alta',
            'Alta del activo: ' || COALESCE(NEW.nombre, ''),
            NULL,
            now()
        );
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        v_baja :=
            (NOT OLD.eliminado AND NEW.eliminado)
            OR (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'baja');

        IF OLD.ubicacion_id IS DISTINCT FROM NEW.ubicacion_id THEN
            INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
            VALUES (
                NEW.id,
                'cambio_ubicacion',
                format(
                    'Cambio de ubicación (referencia id): %s → %s',
                    COALESCE(OLD.ubicacion_id::text, 'ninguna'),
                    COALESCE(NEW.ubicacion_id::text, 'ninguna')
                ),
                NULL,
                now()
            );
        END IF;

        IF v_baja THEN
            INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
            VALUES (
                NEW.id,
                'baja',
                CASE
                    WHEN NOT OLD.eliminado AND NEW.eliminado THEN 'Baja lógica: activo oculto del listado (eliminado).'
                    ELSE 'Estado operativo: baja.'
                END,
                NULL,
                now()
            );
        END IF;

        IF OLD.estado IS DISTINCT FROM NEW.estado AND NOT v_baja THEN
            IF NEW.estado = 'en_mantenimiento' THEN
                INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
                VALUES (
                    NEW.id,
                    'mantenimiento',
                    format('Ingreso a mantenimiento (estado anterior: %s).', COALESCE(OLD.estado, '')),
                    NULL,
                    now()
                );
            ELSE
                INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
                VALUES (
                    NEW.id,
                    'cambio_estado',
                    format('Estado operativo: %s → %s', COALESCE(OLD.estado, ''), COALESCE(NEW.estado, '')),
                    NULL,
                    now()
                );
            END IF;
        END IF;

        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'activos'
              AND c.column_name = 'estado_configuracion'
        ) INTO v_has_cfg;

        IF v_has_cfg AND OLD.estado_configuracion IS DISTINCT FROM NEW.estado_configuracion THEN
            INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
            VALUES (
                NEW.id,
                'cambio_estado',
                format(
                    'Estado de configuración: %s → %s',
                    COALESCE(OLD.estado_configuracion::text, ''),
                    COALESCE(NEW.estado_configuracion::text, '')
                ),
                NULL,
                now()
            );
        END IF;

        -- asignacion / devolucion: reservados para futura columna de responsable en activos (migración aparte).
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.activos_registrar_historial_trg() IS 'AFTER INSERT/UPDATE en activos: escribe filas en historial_activos.';

DROP TRIGGER IF EXISTS trg_activos_historial_ai ON public.activos;
CREATE TRIGGER trg_activos_historial_ai
    AFTER INSERT ON public.activos
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_registrar_historial_trg();

DROP TRIGGER IF EXISTS trg_activos_historial_au ON public.activos;
CREATE TRIGGER trg_activos_historial_au
    AFTER UPDATE ON public.activos
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_registrar_historial_trg();
