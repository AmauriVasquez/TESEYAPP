-- 2026-06-27_operaciones_tareas.sql
-- Operaciones F1: Tablero de Tareas (supervisor-first).

-- 1) Puente login <-> empleado (nullable; no afecta nada existente)
alter table public.empleados
  add column if not exists usuario_id uuid null references public.usuarios(id);

-- 2) Tabla de tareas
create table if not exists public.tareas (
  id                   uuid primary key default gen_random_uuid(),
  titulo               text not null,
  descripcion          text null,
  tipo                 text not null default 'general'   check (tipo in ('mejora','mantenimiento','general')),
  estado               text not null default 'pendiente' check (estado in ('pendiente','en_progreso','bloqueada','hecha')),
  prioridad            text not null default 'media'     check (prioridad in ('baja','media','alta')),
  asignado_empleado_id uuid null references public.empleados(id),
  creado_por           uuid null references public.usuarios(id),
  fecha_limite         date null,
  proyecto_id          integer null references public.proyectos(id),
  equipo_id            bigint  null references public.equipos(id),
  completado_en        timestamptz null,
  completado_por       uuid null references public.usuarios(id),
  created_at           timestamptz not null default now()
);

create index if not exists idx_tareas_estado        on public.tareas(estado);
create index if not exists idx_tareas_asignado       on public.tareas(asignado_empleado_id);
create index if not exists idx_tareas_fecha_limite   on public.tareas(fecha_limite);

-- 3) RLS
alter table public.tareas enable row level security;

drop policy if exists tareas_select on public.tareas;
create policy tareas_select on public.tareas for select
using (
  public.tiene_permiso('operaciones','ver','todos')
  or asignado_empleado_id in (select id from public.empleados where usuario_id = auth.uid())
);

drop policy if exists tareas_insert on public.tareas;
create policy tareas_insert on public.tareas for insert
with check ( public.tiene_permiso('operaciones','crear') );

drop policy if exists tareas_update on public.tareas;
create policy tareas_update on public.tareas for update
using      ( public.tiene_permiso('operaciones','editar') )
with check ( public.tiene_permiso('operaciones','editar') );

drop policy if exists tareas_delete on public.tareas;
create policy tareas_delete on public.tareas for delete
using ( public.tiene_permiso('operaciones','eliminar') );

-- 4) Defaults de permiso por rol (añadir 'operaciones' a SUPERVISOR_CAMPO y OPERADOR)
create or replace function public.permiso_por_defecto_rol(p_rol app_role, p_modulo text, p_accion text, p_submodulo text default null::text)
 returns boolean language plpgsql immutable set search_path to 'public'
as $function$
BEGIN
    CASE p_rol
        WHEN 'RH_ALMACEN' THEN RETURN CASE
            WHEN p_modulo IN ('personal','asistencias','empleados','rh_incidencias') THEN true
            WHEN p_modulo IN ('almacen','inventario','materiales','material_unidades') THEN true
            WHEN p_modulo = 'proyectos' AND p_submodulo = 'control_financiero' THEN false
            WHEN p_modulo IN ('proyectos','proyecto_bitacora','proyecto_archivos','proyecto_entregas') AND p_accion IN ('ver','editar') THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'ordenes'     THEN p_accion = 'ver'
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos'     AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'proveedores' AND p_accion = 'ver' THEN true
            WHEN p_modulo IN ('entregas','logistica') AND p_accion IN ('ver','editar') THEN true
            ELSE false END;

        WHEN 'COMPRAS_FACTURACION' THEN RETURN CASE
            WHEN p_modulo = 'clientes'     AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'clientes'     THEN false
            WHEN p_modulo = 'cotizaciones' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'cotizaciones' THEN false
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos'     AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos'     THEN false
            WHEN p_modulo = 'compras' AND p_submodulo = 'proveedores' THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'ordenes'     AND p_accion = 'eliminar' THEN false
            WHEN p_modulo = 'compras' AND p_submodulo = 'ordenes'     THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'oc_pagos'    THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'oc_facturas' THEN true
            WHEN p_modulo IN ('proyectos','proyecto_pagos') AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'finanzas'  AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'finanzas'  THEN false
            WHEN p_modulo IN ('activos','activos_operativos','categorias_activos','historial_activos','responsivas') AND p_accion = 'ver' THEN true
            ELSE false END;

        WHEN 'SUPERVISOR_CAMPO' THEN RETURN CASE
            WHEN p_modulo = 'operaciones' AND p_submodulo = 'todos' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'operaciones' AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo = 'proyectos' AND p_submodulo = 'control_financiero' THEN false
            WHEN p_modulo = 'proyectos' AND p_submodulo = 'cotizacion'         THEN false
            WHEN p_modulo IN ('proyectos','proyecto_bitacora','proyecto_archivos','proyecto_entregas','proyecto_materiales') AND p_accion IN ('ver','editar') THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos' AND p_accion IN ('ver','crear') THEN true
            WHEN p_modulo IN ('entregas','logistica') AND p_accion IN ('ver','editar') THEN true
            ELSE false END;

        WHEN 'OPERADOR' THEN RETURN CASE
            WHEN p_modulo = 'operaciones' AND p_submodulo = 'todos' THEN false
            WHEN p_modulo = 'operaciones' AND p_accion = 'ver' THEN true
            WHEN p_modulo IN ('proyecto_bitacora','proyecto_archivos') AND p_accion = 'ver'   THEN true
            WHEN p_modulo = 'proyecto_bitacora'                        AND p_accion = 'crear' THEN true
            WHEN p_modulo = 'proyectos'                                AND p_accion = 'ver'   THEN true
            ELSE false END;

        WHEN 'VENTAS' THEN RETURN CASE
            WHEN p_modulo = 'clientes' AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo = 'clientes' AND p_accion = 'eliminar' THEN false
            WHEN p_modulo = 'prospectos' THEN true
            WHEN p_modulo IN ('crm_personas','crm_interacciones') THEN true
            WHEN p_modulo = 'cotizaciones' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'cotizaciones' THEN false
            WHEN p_modulo = 'cotizaciones_items' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'cotizaciones_items' THEN false
            WHEN p_modulo IN ('proyectos','proyecto_pagos') AND p_accion = 'ver' THEN true
            WHEN p_modulo IN ('proyectos','proyecto_pagos') THEN false
            WHEN p_modulo IN ('kpi_definitions','kpi_values','kpi_snapshots') AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo IN ('kpi_definitions','kpi_values','kpi_snapshots') AND p_accion = 'eliminar' THEN false
            ELSE false END;

        ELSE RETURN false;
    END CASE;
END;$function$;

-- 5) RPC: empleados asignables (id + nombre) sin exponer el módulo 'personal'
create or replace function public.operaciones_empleados_asignables()
 returns table (id uuid, nombre_completo text)
 language sql stable security definer set search_path to 'public'
as $function$
  select e.id, e.nombre_completo
  from public.empleados e
  where e.activo = true
    and public.tiene_permiso('operaciones','ver')
  order by e.nombre_completo;
$function$;

-- 6) RPC: mover estado (admin/supervisor por permiso, o el propio asignado)
create or replace function public.tarea_mover_estado(p_tarea_id uuid, p_estado text)
 returns void
 language plpgsql security definer set search_path to 'public'
as $function$
declare v_ok boolean;
begin
  if p_estado not in ('pendiente','en_progreso','bloqueada','hecha') then
    raise exception 'estado invalido: %', p_estado;
  end if;
  select (
    public.tiene_permiso('operaciones','editar')
    or exists (
      select 1 from public.tareas t
      join public.empleados e on e.id = t.asignado_empleado_id
      where t.id = p_tarea_id and e.usuario_id = auth.uid()
    )
  ) into v_ok;
  if not v_ok then raise exception 'sin permiso para mover esta tarea'; end if;

  update public.tareas
  set estado         = p_estado,
      completado_en  = case when p_estado = 'hecha' then now()       else null end,
      completado_por = case when p_estado = 'hecha' then auth.uid()  else null end
  where id = p_tarea_id;
end;
$function$;
