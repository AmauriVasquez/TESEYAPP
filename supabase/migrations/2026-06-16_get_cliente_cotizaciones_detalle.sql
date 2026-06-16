-- Migration: get_cliente_cotizaciones_detalle (v2 con pagado y pago_estatus)
-- Cotizaciones última versión del cliente, con proyecto vinculado y estatus de pago derivado.

drop function if exists public.get_cliente_cotizaciones_detalle(integer);

create function public.get_cliente_cotizaciones_detalle(p_cliente_id integer)
returns table (
  id                   integer,
  folio                text,
  descripcion          text,
  fecha                date,
  total                numeric,
  estatus              text,
  proyecto_id          integer,
  proyecto_folio       text,
  proyecto_descripcion text,
  proyecto_estatus     text,
  pagado               numeric,
  pago_estatus         text
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      cot.id, cot.folio, cot.descripcion, cot.fecha, cot.total, cot.estatus,
      p.id          as proyecto_id,
      p.folio       as proyecto_folio,
      p.descripcion as proyecto_descripcion,
      p.estatus     as proyecto_estatus
    from cotizaciones cot
    left join proyectos p on p.cotizacion_id = cot.id
    where cot.cliente_id = p_cliente_id
      and cot.es_ultima_version = true
  ),
  pagos as (
    select proyecto_id, coalesce(sum(monto), 0)::numeric as pagado
    from proyecto_pagos
    group by proyecto_id
  )
  select
    b.id, b.folio, b.descripcion, b.fecha, b.total, b.estatus,
    b.proyecto_id, b.proyecto_folio, b.proyecto_descripcion, b.proyecto_estatus,
    coalesce(pagos.pagado, 0)::numeric as pagado,
    case
      when b.proyecto_id is null                                then 'Pendiente'
      when b.total > 0 and coalesce(pagos.pagado,0) >= b.total then 'Pagado'
      when coalesce(pagos.pagado, 0) > 0                       then 'Parcial'
      else 'Pendiente'
    end as pago_estatus
  from base b
  left join pagos on pagos.proyecto_id = b.proyecto_id
  order by b.fecha desc nulls last, b.id desc;
$$;

grant execute on function public.get_cliente_cotizaciones_detalle(integer) to anon, authenticated;
