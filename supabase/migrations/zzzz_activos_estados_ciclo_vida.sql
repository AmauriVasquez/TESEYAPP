-- =============================================================================
-- Activos: estados de ciclo de vida, baja con motivo, mantenimiento/reparación con nota.
-- Ejecutar después de historial y responsivas (reemplaza función de historial y RPC recepción).
-- =============================================================================

-- Columnas nuevas
ALTER TABLE public.activos
    ADD COLUMN IF NOT EXISTS motivo_baja text,
    ADD COLUMN IF NOT EXISTS valor_venta numeric(14, 2),
    ADD COLUMN IF NOT EXISTS detalle_cambio_estado text;

COMMENT ON COLUMN public.activos.motivo_baja IS 'Obligatorio si estado = dado_de_baja: venta | destruccion | obsolescencia | robo';
COMMENT ON COLUMN public.activos.valor_venta IS 'Opcional; típico si motivo_baja = venta.';
COMMENT ON COLUMN public.activos.detalle_cambio_estado IS 'Nota temporal al pasar a en_mantenimiento o en_reparacion; el trigger la vacía tras historial.';

ALTER TABLE public.activos
    DROP CONSTRAINT IF EXISTS activos_motivo_baja_values_check;

ALTER TABLE public.activos
    ADD CONSTRAINT activos_motivo_baja_values_check CHECK (
        motivo_baja IS NULL
        OR motivo_baja IN ('venta', 'destruccion', 'obsolescencia', 'robo')
    );

ALTER TABLE public.activos
    DROP CONSTRAINT IF EXISTS activos_valor_venta_nonneg_check;

ALTER TABLE public.activos
    ADD CONSTRAINT activos_valor_venta_nonneg_check CHECK (
        valor_venta IS NULL OR valor_venta >= 0
    );

-- Migración de datos sin disparar historial masivo
ALTER TABLE public.activos DISABLE TRIGGER trg_activos_historial_ai;
ALTER TABLE public.activos DISABLE TRIGGER trg_activos_historial_au;

ALTER TABLE public.activos DROP CONSTRAINT IF EXISTS activos_estado_check;

UPDATE public.activos
SET
    motivo_baja = CASE
        WHEN estado IN ('baja', 'dispuesto') THEN COALESCE(motivo_baja, 'obsolescencia')
        ELSE motivo_baja
    END,
    estado = CASE estado
        WHEN 'activo' THEN 'disponible'
        WHEN 'baja' THEN 'dado_de_baja'
        WHEN 'dispuesto' THEN 'dado_de_baja'
        ELSE estado
    END
WHERE estado IN ('activo', 'baja', 'dispuesto');

ALTER TABLE public.activos
    ADD CONSTRAINT activos_estado_ciclo_check CHECK (
        estado IN (
            'pendiente',
            'disponible',
            'en_uso',
            'en_mantenimiento',
            'en_reparacion',
            'dado_de_baja'
        )
    );

ALTER TABLE public.activos
    DROP CONSTRAINT IF EXISTS activos_motivo_baja_si_baja;

ALTER TABLE public.activos
    ADD CONSTRAINT activos_motivo_baja_si_baja CHECK (
        estado IS DISTINCT FROM 'dado_de_baja'
        OR motivo_baja IS NOT NULL
    );

ALTER TABLE public.activos
    DROP CONSTRAINT IF EXISTS activos_motivo_solo_en_baja;

ALTER TABLE public.activos
    ADD CONSTRAINT activos_motivo_solo_en_baja CHECK (
        estado = 'dado_de_baja'
        OR (motivo_baja IS NULL AND valor_venta IS NULL)
    );

ALTER TABLE public.activos ALTER COLUMN estado SET DEFAULT 'pendiente';

ALTER TABLE public.activos ENABLE TRIGGER trg_activos_historial_ai;
ALTER TABLE public.activos ENABLE TRIGGER trg_activos_historial_au;

-- ---------------------------------------------------------------------------
-- Historial: función actualizada (baja dado_de_baja, mantenimiento + reparación, nota)
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
    v_detalle text;
    v_txt_baja text;
BEGIN
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

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
            OR (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'dado_de_baja');

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
            IF NEW.estado = 'dado_de_baja' THEN
                v_txt_baja :=
                    format(
                        'Baja del activo. Motivo: %s.%s',
                        COALESCE(NEW.motivo_baja, '—'),
                        CASE
                            WHEN NEW.motivo_baja = 'venta' AND NEW.valor_venta IS NOT NULL THEN
                                format(' Valor de venta: %s MXN.', trim(to_char(NEW.valor_venta, '999999999999990.99')))
                            ELSE
                                ''
                        END
                    );
            ELSE
                v_txt_baja := 'Baja lógica: activo oculto del listado (eliminado).';
            END IF;

            INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
            VALUES (NEW.id, 'baja', v_txt_baja, NULL, now());
        END IF;

        IF OLD.estado IS DISTINCT FROM NEW.estado AND NOT v_baja THEN
            IF NEW.estado IN ('en_mantenimiento', 'en_reparacion') THEN
                v_detalle := COALESCE(NULLIF(trim(NEW.detalle_cambio_estado), ''), 'Sin detalle adicional.');
                INSERT INTO public.historial_activos (activo_id, tipo_evento, descripcion, empleado_id, fecha)
                VALUES (
                    NEW.id,
                    'mantenimiento',
                    format(
                        'Estado %s → %s. Detalle: %s',
                        COALESCE(OLD.estado, ''),
                        COALESCE(NEW.estado, ''),
                        v_detalle
                    ),
                    NULL,
                    now()
                );

                UPDATE public.activos
                SET detalle_cambio_estado = NULL
                WHERE id = NEW.id;
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
    END IF;

    RETURN NEW;
END;
$$;

-- No eliminación desde roles de aplicación (la app solo usa UPDATE/INSERT)
REVOKE DELETE ON public.activos FROM authenticated;
REVOKE DELETE ON public.activos FROM anon;

-- ---------------------------------------------------------------------------
-- Recepción pedido: estado operativo inicial coherente con el nuevo catálogo
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recepcionar_pedido_activos(p_pedido_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tipo text;
    v_folio text;
    v_fecha date;
    r RECORD;
    v_qty int;
    v_i int;
    v_activo_id uuid;
    v_seq int := 0;
    v_nombre text;
BEGIN
    IF EXISTS (SELECT 1 FROM public.pedido_activos WHERE pedido_id = p_pedido_id LIMIT 1) THEN
        RETURN jsonb_build_object('ok', true, 'skipped', true, 'message', 'Ya existen activos registrados para este pedido.');
    END IF;

    SELECT tipo_pedido, folio, COALESCE(fecha::date, CURRENT_DATE)
    INTO v_tipo, v_folio, v_fecha
    FROM public.pedidos_materiales
    WHERE id = p_pedido_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Pedido no encontrado.');
    END IF;

    IF v_tipo IS DISTINCT FROM 'activo' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El pedido no es de tipo activo.');
    END IF;

    FOR r IN
        SELECT
            pi.id AS item_id,
            pi.cantidad,
            c.nombre AS cat_nombre,
            c.categoria_id,
            c.costo_compra,
            c.requiere_responsiva,
            c.requiere_mantenimiento,
            c.descripcion AS cat_desc
        FROM public.pedidos_materiales_items pi
        INNER JOIN public.catalogo_activos_base c ON c.id = pi.catalogo_activo_base_id AND c.eliminado = false
        WHERE pi.pedido_id = p_pedido_id
    LOOP
        v_qty := GREATEST(0, floor(COALESCE(r.cantidad, 0)::numeric))::int;
        IF v_qty <= 0 THEN
            CONTINUE;
        END IF;

        FOR v_i IN 1..v_qty LOOP
            v_seq := v_seq + 1;
            v_nombre := upper(trim(COALESCE(r.cat_nombre, 'ACTIVO'))) || ' · ' || COALESCE(v_folio, 'PED') || ' #' || v_seq::text;

            INSERT INTO public.activos (
                nombre,
                categoria_id,
                descripcion,
                costo_compra,
                fecha_adquisicion,
                requiere_responsiva,
                requiere_mantenimiento,
                estado,
                estado_configuracion,
                eliminado,
                origen,
                pedido_id
            ) VALUES (
                v_nombre,
                r.categoria_id,
                COALESCE(NULLIF(trim(r.cat_desc), ''), 'Recepción pedido ' || COALESCE(v_folio, '')),
                COALESCE(r.costo_compra, 0),
                v_fecha,
                COALESCE(r.requiere_responsiva, false),
                COALESCE(r.requiere_mantenimiento, false),
                'pendiente',
                'pendiente',
                false,
                'pedido',
                p_pedido_id
            )
            RETURNING id INTO v_activo_id;

            INSERT INTO public.pedido_activos (pedido_id, pedido_item_id, activo_id)
            VALUES (p_pedido_id, r.item_id, v_activo_id);
        END LOOP;
    END LOOP;

    IF v_seq = 0 THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error',
            'No hay líneas válidas (catálogo + cantidad entera > 0) para generar activos.'
        );
    END IF;

    RETURN jsonb_build_object('ok', true, 'created', v_seq, 'skipped', false);
END;
$$;
