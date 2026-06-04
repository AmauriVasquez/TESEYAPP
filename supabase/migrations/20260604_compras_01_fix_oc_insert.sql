-- =============================================================================
-- Compras 01 — Corregir el INSERT de órdenes de compra (flujo pedido -> OC)
-- =============================================================================
-- Contexto (auditoría 2026-06-04): `ordenes_compra` está VACÍA (0 filas) porque
-- todo INSERT desde el front falla por dos defectos:
--   1) `folio_oc` es NOT NULL, UNIQUE y SIN default, pero el trigger
--      `generar_folio_oc()` solo setea `folio` (no `folio_oc`).
--   2) `validar_oc_con_items()` corre como AFTER INSERT no diferido, así que se
--      evalúa antes de que existan los items (el front inserta OC y luego items),
--      lanzando "No se puede guardar una OC sin partidas".
--
-- Esta migración:
--   - Hace que `generar_folio_oc()` también rellene `folio_oc` (y `folio`).
--   - Reemplaza la validación de items por un CONSTRAINT TRIGGER DEFERIDO que se
--     evalúa al COMMIT, permitiendo OC + items en la misma transacción.
--
-- Riesgo: bajo (tabla vacía, sin datos que migrar).
-- Convención: funciones con SET search_path = pg_catalog, public.
-- =============================================================================

-- 1) Folio: setear folio y folio_oc en el mismo trigger BEFORE INSERT --------
CREATE OR REPLACE FUNCTION public.generar_folio_oc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
declare
  v_consecutivo integer;
  v_prefijo     text;
  v_folio       text;
begin
  if new.empresa_id is null then
    raise exception 'empresa_id es obligatorio';
  end if;

  -- Si el folio ya viene provisto (p. ej. inserción manual/migración), respetarlo.
  if new.folio is not null and new.folio_oc is not null then
    return new;
  end if;

  update public.empresa_folios
  set ultimo_consecutivo = ultimo_consecutivo + 1
  where empresa_id = new.empresa_id
  returning ultimo_consecutivo into v_consecutivo;

  if v_consecutivo is null then
    raise exception 'No existe configuración de folios para la empresa';
  end if;

  select prefijo into v_prefijo
  from public.empresas
  where id = new.empresa_id;

  v_folio := coalesce(v_prefijo, '') || '-OC-' || lpad(v_consecutivo::text, 6, '0');

  new.consecutivo_empresa := v_consecutivo;
  -- Mantener folio y folio_oc sincronizados; respetar el que ya venga.
  new.folio    := coalesce(new.folio, v_folio);
  new.folio_oc := coalesce(new.folio_oc, new.folio, v_folio);

  return new;
end;
$function$;

-- 2) Validación de items: pasar a CONSTRAINT TRIGGER DEFERIDO ----------------
-- Quitar el trigger AFTER INSERT no diferido que rompe el alta OC->items.
DROP TRIGGER IF EXISTS trigger_validar_oc_items ON public.ordenes_compra;

CREATE OR REPLACE FUNCTION public.validar_oc_con_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
begin
  -- Se evalúa al COMMIT (constraint trigger DEFERRED): para entonces los items
  -- del alta ya están insertados en la misma transacción.
  if not exists (
    select 1 from public.ordenes_compra_items
    where orden_compra_id = new.id
  ) then
    raise exception 'No se puede guardar una OC sin partidas (items)';
  end if;

  return new;
end;
$function$;

-- Constraint trigger diferible que valida al final de la transacción.
CREATE CONSTRAINT TRIGGER trigger_validar_oc_items
  AFTER INSERT ON public.ordenes_compra
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_oc_con_items();

-- 3) Backfill defensivo (no hay filas hoy, pero idempotente y seguro) --------
UPDATE public.ordenes_compra
SET folio_oc = folio
WHERE folio_oc IS NULL AND folio IS NOT NULL;

-- 4) RPC atómica para crear OC + partidas en UNA sola transacción ------------
-- Motivo: supabase-js (PostgREST) ejecuta cada .insert() como una transacción
-- HTTP independiente. Insertar la OC y luego sus items por separado dejaba la OC
-- sin partidas en su propia transacción (y rompía el constraint trigger diferido,
-- que valida al COMMIT). Esta función inserta header + items (+ enlaza los items
-- del pedido) en una sola transacción: el trigger de folio rellena folio/folio_oc,
-- los items existen al COMMIT (validación OK) y, si algo falla, rollback total
-- (sin OC huérfanas, sin necesitar DELETE desde el cliente).
--
-- p_oc:    objeto con { empresa_id, proveedor_id, solicitante, comprador, descripcion }
-- p_items: arreglo de { material_id?, pedido_item_id?, clave?, descripcion, notas?,
--                       unidad, cantidad, precio_unitario, importe? }
-- Devuelve la fila completa de ordenes_compra (incluye folio/folio_oc generados).
CREATE OR REPLACE FUNCTION public.crear_orden_compra(p_oc jsonb, p_items jsonb)
RETURNS public.ordenes_compra
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_oc    public.ordenes_compra;
  v_item  jsonb;
  v_pii   integer;
  v_pu    numeric;
BEGIN
  -- Guard de permiso (equivalente a la RLS de INSERT de ordenes_compra).
  IF NOT public.tiene_permiso('compras', 'crear', 'ordenes') THEN
    RAISE EXCEPTION 'Sin permiso para crear órdenes de compra' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No se puede crear una orden de compra sin partidas (items).';
  END IF;

  -- Header. El trigger BEFORE INSERT genera folio/folio_oc/consecutivo.
  INSERT INTO public.ordenes_compra (empresa_id, proveedor_id, solicitante, comprador, descripcion)
  VALUES (
    (p_oc->>'empresa_id')::uuid,
    NULLIF(p_oc->>'proveedor_id', '')::uuid,
    NULLIF(p_oc->>'solicitante', ''),
    NULLIF(p_oc->>'comprador', ''),
    NULLIF(p_oc->>'descripcion', '')
  )
  RETURNING * INTO v_oc;

  -- Partidas.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_pii := NULLIF(v_item->>'pedido_item_id', '')::integer;
    v_pu  := COALESCE((v_item->>'precio_unitario')::numeric, 0);

    INSERT INTO public.ordenes_compra_items (
      orden_compra_id, material_id, pedido_item_id, clave, descripcion, notas,
      unidad, cantidad, precio_unitario, importe
    ) VALUES (
      v_oc.id,
      NULLIF(v_item->>'material_id', '')::bigint,
      v_pii,
      NULLIF(v_item->>'clave', ''),
      COALESCE(NULLIF(v_item->>'descripcion', ''), '—'),
      NULLIF(v_item->>'notas', ''),
      COALESCE(NULLIF(v_item->>'unidad', ''), 'N/A'),
      COALESCE((v_item->>'cantidad')::numeric, 0),
      v_pu,
      COALESCE((v_item->>'importe')::numeric, COALESCE((v_item->>'cantidad')::numeric, 0) * v_pu)
    );

    -- Si la partida proviene de un pedido, enlazarla en la misma transacción.
    IF v_pii IS NOT NULL THEN
      UPDATE public.pedidos_materiales_items
      SET orden_compra_id = v_oc.id,
          precio_unitario = v_pu
      WHERE id = v_pii;
    END IF;
  END LOOP;

  RETURN v_oc;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.crear_orden_compra(jsonb, jsonb) TO authenticated, service_role;
