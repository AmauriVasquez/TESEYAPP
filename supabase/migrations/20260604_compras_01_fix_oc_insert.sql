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
