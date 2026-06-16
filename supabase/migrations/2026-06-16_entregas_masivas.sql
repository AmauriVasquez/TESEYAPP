-- supabase/migrations/2026-06-16_entregas_masivas.sql

-- 1) Columna para agrupar las entregas de un mismo acto de confirmación
alter table public.entregas add column if not exists grupo_id uuid;
create index if not exists idx_entregas_grupo_id on public.entregas (grupo_id);

-- 2) RPC transaccional
create or replace function public.registrar_entrega_masiva(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id     uuid := coalesce((payload->>'grupo_id')::uuid, gen_random_uuid());
  v_recibe       text := nullif(payload->>'recibe_nombre', '');
  v_comentarios  text := nullif(payload->>'comentarios', '');
  v_firma_url    text := nullif(payload->>'firma_url', '');
  v_foto_url     text := nullif(payload->>'foto_url', '');
  v_proy         jsonb;
  v_item         jsonb;
  v_proyecto_id  integer;
  v_cot_id       integer;
  v_entrega_id   uuid;
  v_qty          numeric;
  v_inserto_item boolean;
  v_completo     boolean;
  v_resultado    jsonb := '[]'::jsonb;
begin
  if v_recibe is null then
    raise exception 'recibe_nombre es obligatorio';
  end if;
  if jsonb_typeof(payload->'proyectos') <> 'array' or jsonb_array_length(payload->'proyectos') = 0 then
    raise exception 'Debe incluir al menos un proyecto';
  end if;

  for v_proy in select * from jsonb_array_elements(payload->'proyectos')
  loop
    v_proyecto_id := (v_proy->>'proyecto_id')::integer;
    v_cot_id      := (v_proy->>'cotizacion_id')::integer;
    v_inserto_item := false;

    insert into public.entregas
      (proyecto_id, cotizacion_id, recibe_nombre, firma_url, foto_url, comentarios, estado, grupo_id)
    values
      (v_proyecto_id, v_cot_id, v_recibe, v_firma_url, v_foto_url, v_comentarios, 'activa', v_grupo_id)
    returning id into v_entrega_id;

    for v_item in select * from jsonb_array_elements(v_proy->'items')
    loop
      v_qty := (v_item->>'cantidad_entregada')::numeric;
      if v_qty is not null and v_qty > 0 then
        -- trigger_validar_entrega revierte TODA la transacción si excede el pendiente
        insert into public.entregas_items (entrega_id, cotizacion_item_id, cantidad_entregada)
        values (v_entrega_id, (v_item->>'cotizacion_item_id')::integer, v_qty);
        v_inserto_item := true;
      end if;
    end loop;

    if not v_inserto_item then
      raise exception 'El proyecto % no tiene cantidades a entregar', v_proyecto_id;
    end if;

    -- ¿quedó completo? (la RPC de pendientes ya considera estado=activa)
    select coalesce(bool_and(pendiente <= 0), false)
      into v_completo
    from public.get_items_con_pendiente(v_cot_id);

    if v_completo then
      update public.proyectos set estatus = 'Entregado' where id = v_proyecto_id;
    end if;

    v_resultado := v_resultado || jsonb_build_object(
      'proyecto_id', v_proyecto_id,
      'entrega_id', v_entrega_id,
      'completo', v_completo
    );
  end loop;

  return jsonb_build_object('grupo_id', v_grupo_id, 'entregas', v_resultado);
end;
$$;

grant execute on function public.registrar_entrega_masiva(jsonb) to authenticated;
