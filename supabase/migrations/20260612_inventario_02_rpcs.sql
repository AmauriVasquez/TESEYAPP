-- Módulo de Inventario — RPCs: registrar movimiento (con permitir-negativo),
-- folio atómico y generación de pedido de re-stock.
-- Diseño: docs/superpowers/specs/2026-06-12-inventario-almacen-design.md (v2)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Registrar movimiento (envuelve el INSERT para poder pasar permitir_negativo)
--    SECURITY INVOKER ⇒ la RLS de inventario_movimientos sigue aplicando.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.registrar_movimiento_inventario(
  p_material_id     integer,
  p_tipo            text,
  p_cantidad        numeric,
  p_motivo          text    default null,
  p_referencia      text    default null,
  p_proyecto_id     integer default null,
  p_observaciones   text    default null,
  p_permitir_negativo boolean default false
)
returns public.inventario_movimientos
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.inventario_movimientos;
begin
  perform set_config('app.permitir_negativo', case when p_permitir_negativo then '1' else '0' end, true);
  insert into public.inventario_movimientos
    (material_id, tipo, cantidad, motivo, referencia, proyecto_id, observaciones, creado_por)
  values
    (p_material_id, p_tipo, p_cantidad, p_motivo, p_referencia, p_proyecto_id, p_observaciones, auth.uid())
  returning * into v_row;
  perform set_config('app.permitir_negativo', '0', true);
  return v_row;
end;
$$;

revoke execute on function public.registrar_movimiento_inventario(integer,text,numeric,text,text,integer,text,boolean) from public, anon;
grant execute on function public.registrar_movimiento_inventario(integer,text,numeric,text,text,integer,text,boolean) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Folio de pedido atómico (advisory lock + sufijo numérico). Soporta >9999.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.siguiente_folio_pedido()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_num integer;
begin
  perform pg_advisory_xact_lock(hashtext('pedidos_materiales_folio'));
  select coalesce(max((substring(folio from '\d+'))::int), 0) + 1
    into v_num
  from public.pedidos_materiales
  where folio ~ '^PED-\d+$';
  return 'PED-' || lpad(v_num::text, 4, '0');
end;
$$;

revoke execute on function public.siguiente_folio_pedido() from public, anon;
grant execute on function public.siguiente_folio_pedido() to authenticated;

-- Unicidad de folio (no hay duplicados actuales — verificado: 80/80 distintos)
create unique index if not exists ux_pedidos_materiales_folio
  on public.pedidos_materiales (folio);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Crear pedido de re-stock desde almacén (escalada deliberada y blindada)
--    p_items: jsonb [{ material_id, cantidad (en unidad_compra), observaciones? }]
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.crear_pedido_restock(
  p_items         jsonb,
  p_observaciones text default null
)
returns public.pedidos_materiales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio   text;
  v_pedido  public.pedidos_materiales;
  v_item    jsonb;
  v_mat     public.materiales;
  v_cant    numeric;
  v_unidad_id integer;
begin
  if not public.tiene_permiso('materiales','editar') then
    raise exception 'No tienes permiso para generar pedidos de re-stock';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'No hay partidas para el pedido';
  end if;

  v_folio := public.siguiente_folio_pedido();

  insert into public.pedidos_materiales
    (folio, fecha, solicitante_id, estatus, prioridad, tipo_pedido, observaciones)
  values
    (v_folio, current_date, auth.uid(), 'Pendiente', 'Normal', 'material',
     coalesce(p_observaciones, 'Pedido de re-stock (mínimos de almacén)'))
  returning * into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_mat from public.materiales where id = (v_item->>'material_id')::int;
    if not found then
      raise exception 'El material % no existe', v_item->>'material_id';
    end if;

    v_cant := coalesce((v_item->>'cantidad')::numeric, 0);
    if v_cant <= 0 then
      raise exception 'Cantidad inválida (% ) para el material %', v_cant, v_mat.id;
    end if;

    -- Mapear unidad_compra (texto libre) -> catalogo_unidades; NULL si no hay match
    select id into v_unidad_id
    from public.catalogo_unidades
    where lower(abreviatura) = lower(coalesce(v_mat.unidad_compra,''))
       or lower(nombre)      = lower(coalesce(v_mat.unidad_compra,''))
    limit 1;

    insert into public.pedidos_materiales_items
      (pedido_id, material_id, cantidad, unidad_id, descripcion, precio_unitario, observaciones, estatus)
    values
      (v_pedido.id, v_mat.id, v_cant, v_unidad_id, v_mat.descripcion,
       coalesce(v_mat.costo_compra, 0), nullif(v_item->>'observaciones',''), 'Pendiente');
  end loop;

  return v_pedido;
end;
$$;

revoke execute on function public.crear_pedido_restock(jsonb, text) from public, anon;
grant execute on function public.crear_pedido_restock(jsonb, text) to authenticated;
