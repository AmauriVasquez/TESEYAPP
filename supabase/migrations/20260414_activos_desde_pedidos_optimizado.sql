-- =============================================================================
-- Activos desde pedidos: captura extendida + generación automática por unidad
-- =============================================================================

-- 1) Categorías de activos: código para generación de codigo_interno
ALTER TABLE public.categorias_activos
    ADD COLUMN IF NOT EXISTS codigo text;

UPDATE public.categorias_activos
SET codigo = upper(trim(coalesce(codigo, '')))
WHERE codigo IS NOT NULL;

ALTER TABLE public.categorias_activos
    DROP CONSTRAINT IF EXISTS categorias_activos_codigo_formato_chk;

ALTER TABLE public.categorias_activos
    ADD CONSTRAINT categorias_activos_codigo_formato_chk
    CHECK (codigo IS NULL OR codigo ~ '^[A-Z]{2,5}$');

DROP INDEX IF EXISTS categorias_activos_codigo_unique;
CREATE UNIQUE INDEX categorias_activos_codigo_unique
    ON public.categorias_activos (codigo)
    WHERE eliminado = false AND codigo IS NOT NULL;

-- 2) Catálogo base + líneas de pedido de activos
ALTER TABLE public.catalogo_activos_base
    ADD COLUMN IF NOT EXISTS marca text,
    ADD COLUMN IF NOT EXISTS modelo text;

ALTER TABLE public.pedidos_materiales_items
    ADD COLUMN IF NOT EXISTS marca text,
    ADD COLUMN IF NOT EXISTS modelo text,
    ADD COLUMN IF NOT EXISTS requiere_mantenimiento boolean,
    ADD COLUMN IF NOT EXISTS requiere_responsiva boolean;

UPDATE public.pedidos_materiales_items
SET
    marca = upper(trim(marca)),
    modelo = upper(trim(modelo))
WHERE marca IS NOT NULL OR modelo IS NOT NULL;

-- 3) Activos: codigo interno y estado físico inicial
ALTER TABLE public.activos
    ADD COLUMN IF NOT EXISTS codigo_interno text,
    ADD COLUMN IF NOT EXISTS estado_fisico text NOT NULL DEFAULT 'nuevo';

ALTER TABLE public.activos
    DROP CONSTRAINT IF EXISTS activos_estado_fisico_chk;

ALTER TABLE public.activos
    ADD CONSTRAINT activos_estado_fisico_chk
    CHECK (estado_fisico IN ('nuevo', 'usado', 'reacondicionado'));

DROP INDEX IF EXISTS activos_codigo_interno_unique;
CREATE UNIQUE INDEX activos_codigo_interno_unique
    ON public.activos (codigo_interno)
    WHERE codigo_interno IS NOT NULL AND eliminado = false;

-- 4) Catálogo base de categorías por defecto (idempotente)
WITH base(nombre, codigo) AS (
    VALUES
        ('HERRAMIENTA MANUAL', 'HM'),
        ('HERRAMIENTA ELÉCTRICA', 'HE'),
        ('HERRAMIENTA NEUMÁTICA', 'HN'),
        ('MAQUINARIA LIGERA', 'ML'),
        ('MAQUINARIA PESADA', 'MP'),
        ('VEHÍCULOS', 'VEH'),
        ('EQUIPO DE CÓMPUTO', 'EC'),
        ('EQUIPO DE OFICINA', 'EO'),
        ('MOBILIARIO', 'MOB'),
        ('EQUIPO DE MEDICIÓN', 'EM'),
        ('EQUIPO DE SEGURIDAD', 'ES'),
        ('SISTEMAS DE VIGILANCIA', 'SV'),
        ('REDES Y TELECOMUNICACIONES', 'RT'),
        ('OTROS', 'OTR')
)
INSERT INTO public.categorias_activos (nombre, codigo, descripcion, eliminado)
SELECT b.nombre, b.codigo, 'Categoría base para generación automática desde pedidos.', false
FROM base b
WHERE NOT EXISTS (
    SELECT 1
    FROM public.categorias_activos c
    WHERE lower(trim(c.nombre)) = lower(trim(b.nombre))
);

UPDATE public.categorias_activos c
SET codigo = b.codigo
FROM (
    VALUES
        ('HERRAMIENTA MANUAL', 'HM'),
        ('HERRAMIENTA ELÉCTRICA', 'HE'),
        ('HERRAMIENTA NEUMÁTICA', 'HN'),
        ('MAQUINARIA LIGERA', 'ML'),
        ('MAQUINARIA PESADA', 'MP'),
        ('VEHÍCULOS', 'VEH'),
        ('EQUIPO DE CÓMPUTO', 'EC'),
        ('EQUIPO DE OFICINA', 'EO'),
        ('MOBILIARIO', 'MOB'),
        ('EQUIPO DE MEDICIÓN', 'EM'),
        ('EQUIPO DE SEGURIDAD', 'ES'),
        ('SISTEMAS DE VIGILANCIA', 'SV'),
        ('REDES Y TELECOMUNICACIONES', 'RT'),
        ('OTROS', 'OTR')
) AS b(nombre, codigo)
WHERE lower(trim(c.nombre)) = lower(trim(b.nombre))
  AND (c.codigo IS NULL OR c.codigo = '');

-- 5) Recepción automática (reemplazo): crea activo por unidad con codigo_interno
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
    v_cod_cat text;
    v_next int;
    v_codigo_interno text;
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
            upper(trim(coalesce(pi.marca, c.marca, ''))) AS marca,
            upper(trim(coalesce(pi.modelo, c.modelo, ''))) AS modelo,
            coalesce(pi.requiere_responsiva, c.requiere_responsiva, false) AS requiere_responsiva,
            coalesce(pi.requiere_mantenimiento, c.requiere_mantenimiento, false) AS requiere_mantenimiento,
            c.nombre AS cat_nombre,
            c.categoria_id,
            c.costo_compra,
            c.descripcion AS cat_desc,
            coalesce(nullif(trim(ca.codigo), ''), 'ACT') AS categoria_codigo
        FROM public.pedidos_materiales_items pi
        INNER JOIN public.catalogo_activos_base c ON c.id = pi.catalogo_activo_base_id AND c.eliminado = false
        LEFT JOIN public.categorias_activos ca ON ca.id = c.categoria_id
        WHERE pi.pedido_id = p_pedido_id
    LOOP
        v_qty := GREATEST(0, floor(COALESCE(r.cantidad, 0)::numeric))::int;
        IF v_qty <= 0 THEN
            CONTINUE;
        END IF;

        v_cod_cat := upper(r.categoria_codigo);

        SELECT coalesce(max(substring(a.codigo_interno from '[0-9]+$')::int), 0) + 1
        INTO v_next
        FROM public.activos a
        WHERE a.codigo_interno LIKE (v_cod_cat || '-%');

        FOR v_i IN 1..v_qty LOOP
            v_seq := v_seq + 1;
            v_codigo_interno := v_cod_cat || '-' || lpad(v_next::text, 4, '0');
            v_next := v_next + 1;

            v_nombre := upper(trim(COALESCE(r.cat_nombre, 'ACTIVO')));
            IF coalesce(r.marca, '') <> '' THEN
                v_nombre := v_nombre || ' ' || r.marca;
            END IF;
            IF coalesce(r.modelo, '') <> '' THEN
                v_nombre := v_nombre || ' ' || r.modelo;
            END IF;

            INSERT INTO public.activos (
                nombre,
                categoria_id,
                descripcion,
                marca,
                modelo,
                costo_compra,
                fecha_adquisicion,
                requiere_responsiva,
                requiere_mantenimiento,
                estado,
                estado_configuracion,
                estado_fisico,
                eliminado,
                origen,
                pedido_id,
                codigo_interno
            ) VALUES (
                v_nombre,
                r.categoria_id,
                COALESCE(NULLIF(trim(r.cat_desc), ''), 'Recepción pedido ' || COALESCE(v_folio, '')),
                NULLIF(r.marca, ''),
                NULLIF(r.modelo, ''),
                COALESCE(r.costo_compra, 0),
                v_fecha,
                COALESCE(r.requiere_responsiva, false),
                COALESCE(r.requiere_mantenimiento, false),
                'pendiente',
                'pendiente',
                'nuevo',
                false,
                'pedido',
                p_pedido_id,
                v_codigo_interno
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
