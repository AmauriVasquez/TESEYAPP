-- =============================================================================
-- Pedidos: tipo material | activo, catálogo base, vínculo pedido_activos,
-- recepción vía RPC al marcar pedido Entregado (activos).
-- Requiere: create_activos_module.sql (activos, categorias_activos).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Catálogo base de activos (plantilla para pedidos; no es inventario con cantidad)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogo_activos_base (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre text NOT NULL,
    categoria_id uuid NOT NULL REFERENCES public.categorias_activos(id) ON DELETE RESTRICT,
    descripcion text,
    costo_compra numeric NOT NULL DEFAULT 0 CHECK (costo_compra >= 0),
    requiere_responsiva boolean NOT NULL DEFAULT false,
    requiere_mantenimiento boolean NOT NULL DEFAULT false,
    eliminado boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalogo_activos_base IS 'Plantillas de activos para pedidos tipo activo; cada unidad recibida genera un registro único en activos.';

DROP INDEX IF EXISTS catalogo_activos_base_nombre_activos_unique;
CREATE UNIQUE INDEX catalogo_activos_base_nombre_activos_unique
    ON public.catalogo_activos_base (lower(trim(nombre)))
    WHERE eliminado = false;

DROP TRIGGER IF EXISTS trg_catalogo_activos_base_updated_at ON public.catalogo_activos_base;
CREATE TRIGGER trg_catalogo_activos_base_updated_at
    BEFORE UPDATE ON public.catalogo_activos_base
    FOR EACH ROW
    EXECUTE PROCEDURE public.activos_module_touch_updated_at();

ALTER TABLE public.catalogo_activos_base ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalogo_activos_base_select ON public.catalogo_activos_base;
DROP POLICY IF EXISTS catalogo_activos_base_insert ON public.catalogo_activos_base;
DROP POLICY IF EXISTS catalogo_activos_base_update ON public.catalogo_activos_base;

CREATE POLICY catalogo_activos_base_select
    ON public.catalogo_activos_base FOR SELECT TO authenticated USING (true);

CREATE POLICY catalogo_activos_base_insert
    ON public.catalogo_activos_base FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY catalogo_activos_base_update
    ON public.catalogo_activos_base FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Pedido: tipo
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos_materiales
    ADD COLUMN IF NOT EXISTS tipo_pedido text NOT NULL DEFAULT 'material'
        CHECK (tipo_pedido IN ('material', 'activo'));

COMMENT ON COLUMN public.pedidos_materiales.tipo_pedido IS 'material = ítems de materiales; activo = ítems desde catalogo_activos_base y recepción genera activos.';

-- ---------------------------------------------------------------------------
-- Ítems: catálogo activo opcional; material_id puede ser NULL si es pedido activo
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos_materiales_items
    ADD COLUMN IF NOT EXISTS catalogo_activo_base_id uuid REFERENCES public.catalogo_activos_base(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pedidos_materiales_items.catalogo_activo_base_id IS 'Pedido tipo activo: plantilla del activo a generar por unidad en recepción.';

ALTER TABLE public.pedidos_materiales_items
    ALTER COLUMN material_id DROP NOT NULL;

ALTER TABLE public.pedidos_materiales_items
    DROP CONSTRAINT IF EXISTS pedidos_materiales_items_material_o_catalogo;

ALTER TABLE public.pedidos_materiales_items
    ADD CONSTRAINT pedidos_materiales_items_material_o_catalogo CHECK (
        (material_id IS NOT NULL AND catalogo_activo_base_id IS NULL)
        OR
        (material_id IS NULL AND catalogo_activo_base_id IS NOT NULL)
    );

-- ---------------------------------------------------------------------------
-- Activos: origen y vínculo al pedido (sin columna cantidad en activos)
-- ---------------------------------------------------------------------------
ALTER TABLE public.activos
    ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'manual'
        CHECK (origen IN ('manual', 'pedido'));

ALTER TABLE public.activos
    ADD COLUMN IF NOT EXISTS pedido_id integer REFERENCES public.pedidos_materiales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activos_pedido_id ON public.activos(pedido_id);

COMMENT ON COLUMN public.activos.origen IS 'manual = alta directa; pedido = generado al recepcionar pedido tipo activo.';
COMMENT ON COLUMN public.activos.pedido_id IS 'Pedido del que proviene el activo, si origen = pedido.';

-- ---------------------------------------------------------------------------
-- Relación pedido ↔ activos generados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_activos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_id integer NOT NULL REFERENCES public.pedidos_materiales(id) ON DELETE CASCADE,
    pedido_item_id bigint,
    activo_id uuid NOT NULL REFERENCES public.activos(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pedido_activos_activo_unique UNIQUE (activo_id)
);

COMMENT ON TABLE public.pedido_activos IS 'Activos individuales generados desde un pedido tipo activo.';

CREATE INDEX IF NOT EXISTS idx_pedido_activos_pedido_id ON public.pedido_activos(pedido_id);

ALTER TABLE public.pedido_activos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedido_activos_select ON public.pedido_activos;
DROP POLICY IF EXISTS pedido_activos_insert ON public.pedido_activos;

CREATE POLICY pedido_activos_select
    ON public.pedido_activos FOR SELECT TO authenticated USING (true);

CREATE POLICY pedido_activos_insert
    ON public.pedido_activos FOR INSERT TO authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- RPC: generar activos al recepcionar (idempotente si ya hay pedido_activos)
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
                'activo',
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

COMMENT ON FUNCTION public.recepcionar_pedido_activos(integer) IS 'Genera N filas en activos + pedido_activos por cantidad de cada ítem; idempotente.';

GRANT EXECUTE ON FUNCTION public.recepcionar_pedido_activos(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recepcionar_pedido_activos(integer) TO service_role;
