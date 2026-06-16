-- supabase/migrations/2026-06-16_get_cliente_resumen.sql
create or replace function public.get_cliente_resumen(p_cliente_id integer)
returns table (
  cotizado numeric,
  autorizado numeric,
  pagado numeric,
  por_cobrar numeric,
  num_cotizaciones integer,
  num_proyectos integer
)
language sql
stable
security definer
set search_path = public
as $$
  with cot as (
    select coalesce(sum(total), 0)::numeric as cotizado,
           count(*)::integer as num_cotizaciones
    from cotizaciones
    where cliente_id = p_cliente_id and es_ultima_version = true
  ),
  proy as (
    select coalesce(sum(coalesce(c.total, pr.costo_total, 0)), 0)::numeric as autorizado,
           count(*)::integer as num_proyectos
    from proyectos pr
    left join cotizaciones c on c.id = pr.cotizacion_id
    where pr.cliente_id = p_cliente_id
  ),
  pag as (
    select coalesce(sum(pg.monto), 0)::numeric as pagado
    from proyecto_pagos pg
    join proyectos pr on pr.id = pg.proyecto_id
    where pr.cliente_id = p_cliente_id
  )
  select cot.cotizado,
         proy.autorizado,
         pag.pagado,
         (proy.autorizado - pag.pagado)::numeric as por_cobrar,
         cot.num_cotizaciones,
         proy.num_proyectos
  from cot, proy, pag;
$$;

grant execute on function public.get_cliente_resumen(integer) to anon, authenticated;
