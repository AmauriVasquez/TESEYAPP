-- Migration: get_cliente_cotizaciones_detalle
-- Returns cotizaciones (última versión) de un cliente junto con el proyecto vinculado (si existe).
-- El frontend usa proyecto_id / proyecto_estatus para mostrar el botón de entrega.

create or replace function public.get_cliente_cotizaciones_detalle(p_cliente_id integer)
returns table (
  -- cotización
  id              integer,
  folio           text,
  descripcion     text,
  fecha           date,
  total           numeric,
  estatus         text,
  -- proyecto vinculado (puede ser NULL si no hay proyecto)
  proyecto_id          integer,
  proyecto_folio       text,
  proyecto_descripcion text,
  proyecto_estatus     text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cot.id,
    cot.folio,
    cot.descripcion,
    cot.fecha,
    cot.total,
    cot.estatus,
    p.id              as proyecto_id,
    p.folio           as proyecto_folio,
    p.descripcion     as proyecto_descripcion,
    p.estatus         as proyecto_estatus
  from cotizaciones cot
  left join proyectos p on p.cotizacion_id = cot.id
  where cot.cliente_id = p_cliente_id
    and cot.es_ultima_version = true
  order by cot.fecha desc;
$$;

grant execute on function public.get_cliente_cotizaciones_detalle(integer) to anon, authenticated;
