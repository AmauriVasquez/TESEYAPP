# Operaciones · Tablero de Tareas F1 — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un tablero de tareas supervisor-first al módulo Operaciones de tesey-app, donde admin/supervisor crean y asignan tareas a empleados y las mueven por un kanban; el operativo con cuenta vinculada ve y mueve solo las suyas.

**Architecture:** Una tabla nueva `tareas` + columna puente `empleados.usuario_id` (nullable). Seguridad con RLS reusando los helpers existentes `tiene_permiso()`/`es_admin()`, y dos RPC `SECURITY DEFINER` (`operaciones_empleados_asignables`, `tarea_mover_estado`) para no exponer el módulo `personal` ni debilitar RLS. Frontend: una pestaña nueva en el `OperacionesModuleLayout` con dos vistas (Tablero kanban sin drag, Por colaborador) y un modal de alta/edición.

**Tech Stack:** React 19 + Vite, TailwindCSS, Radix UI, lucide-react, `@supabase/supabase-js` (cliente `supabase` de `@/lib/customSupabaseClient`), Supabase Postgres + RLS.

---

## Convenciones de verificación (este repo)

- **No hay framework de tests** (sin vitest/jest, sin archivos `*.test.*`). No se añade uno (YAGNI). La verificación es: chequeos SQL de solo lectura, `npm run lint`, `npm run build`, y humo manual en la app.
- **Migraciones:** `apply_migration` está bloqueado a producción. El archivo `.sql` se crea en el repo y **el dueño lo pega en el SQL Editor de Supabase**. La verificación posterior usa `execute_sql` (solo lectura) o el SQL Editor.
- **Despliegue:** `npm run build` → commit del `dist` → push a `origin/main` (Hostinger manual).
- Project ref de Supabase: `czbmqzimjlwwgcglubey`.

---

## Estructura de archivos

**Crear:**
- `supabase/migrations/2026-06-27_operaciones_tareas.sql` — DDL: tabla `tareas`, `empleados.usuario_id`, índices, RLS, update de `permiso_por_defecto_rol`, RPCs.
- `src/services/tareasService.js` — acceso a datos (listar, crear, actualizar, mover estado, empleados asignables).
- `src/pages/OperacionesTareas.jsx` — página de la pestaña Tareas (sub-vistas Tablero / Por colaborador).
- `src/components/operaciones/TableroTareas.jsx` — kanban sin drag.
- `src/components/operaciones/TareasPorColaborador.jsx` — agrupado por empleado.
- `src/components/operaciones/TareaModal.jsx` — alta/edición.

**Modificar:**
- `src/contexts/PermissionsContext.jsx` — añadir `operaciones` al matriz `ROLE_PERMISSIONS` para `SUPERVISOR_CAMPO` y `OPERADOR`.
- `src/App.jsx` — ruta `operaciones/tareas`.
- `src/components/module/ModuleSectionLayouts.jsx` — pestaña "Tareas".

---

## Task 1: Migración SQL (esquema + RLS + permisos + RPCs)

**Files:**
- Create: `supabase/migrations/2026-06-27_operaciones_tareas.sql`

- [ ] **Step 1: Escribir el archivo de migración completo**

```sql
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
```

- [ ] **Step 2: El dueño aplica la migración**

Pegar el contenido del archivo en el SQL Editor de Supabase (proyecto `czbmqzimjlwwgcglubey`) y ejecutarlo. Debe terminar sin errores.

- [ ] **Step 3: Verificar esquema y RLS (solo lectura)**

Ejecutar en el SQL Editor o vía `execute_sql`:

```sql
select count(*) as col_puente from information_schema.columns
  where table_schema='public' and table_name='empleados' and column_name='usuario_id';
select count(*) as policies from pg_policies where schemaname='public' and tablename='tareas';
select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and proname in ('operaciones_empleados_asignables','tarea_mover_estado');
```
Esperado: `col_puente = 1`, `policies = 4`, y las dos funciones listadas.

- [ ] **Step 4: Verificar defaults de permiso por rol**

```sql
select
  permiso_por_defecto_rol('SUPERVISOR_CAMPO','operaciones','ver','todos') as sup_ve_todos,   -- true
  permiso_por_defecto_rol('SUPERVISOR_CAMPO','operaciones','crear',null)  as sup_crea,        -- true
  permiso_por_defecto_rol('OPERADOR','operaciones','ver',null)            as op_ve,           -- true
  permiso_por_defecto_rol('OPERADOR','operaciones','ver','todos')         as op_ve_todos,     -- false
  permiso_por_defecto_rol('OPERADOR','operaciones','crear',null)          as op_crea;         -- false
```
Esperado: `true, true, true, false, false`.

- [ ] **Step 5: Commit del archivo de migración**

```bash
git add supabase/migrations/2026-06-27_operaciones_tareas.sql
git commit -m "feat(operaciones): migración F1 tareas (tabla, RLS, permisos, RPCs)"
```

---

## Task 2: Permisos en el frontend (`PermissionsContext`)

**Files:**
- Modify: `src/contexts/PermissionsContext.jsx` (objeto `ROLE_PERMISSIONS`, roles `SUPERVISOR_CAMPO` y `OPERADOR`)

- [ ] **Step 1: Añadir claves `operaciones` a SUPERVISOR_CAMPO**

En `ROLE_PERMISSIONS.SUPERVISOR_CAMPO`, agregar estas dos entradas (junto a las existentes):

```js
    operaciones: { ver: true, crear: true, editar: true, eliminar: false },
    'operaciones.todos': { ver: true, crear: false, editar: false, eliminar: false },
```

- [ ] **Step 2: Añadir clave `operaciones` a OPERADOR**

En `ROLE_PERMISSIONS.OPERADOR`, agregar:

```js
    operaciones: { ver: true, crear: false, editar: false, eliminar: false },
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos en `PermissionsContext.jsx`.

- [ ] **Step 4: Commit**

```bash
git add src/contexts/PermissionsContext.jsx
git commit -m "feat(operaciones): permisos de módulo operaciones (supervisor/operador)"
```

---

## Task 3: Servicio de datos (`tareasService.js`)

**Files:**
- Create: `src/services/tareasService.js`

- [ ] **Step 1: Escribir el servicio**

```js
/**
 * Servicio de Operaciones · Tareas.
 * RLS y RPCs definidos en supabase/migrations/2026-06-27_operaciones_tareas.sql
 */
import { supabase } from '@/lib/customSupabaseClient';

/** Lista las tareas visibles para el usuario actual (RLS filtra). */
export async function listarTareas() {
  const { data, error } = await supabase
    .from('tareas')
    .select('id, titulo, descripcion, tipo, estado, prioridad, asignado_empleado_id, fecha_limite, proyecto_id, equipo_id, completado_en, created_at')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

/** Empleados asignables (id + nombre) vía RPC SECURITY DEFINER. */
export async function empleadosAsignables() {
  const { data, error } = await supabase.rpc('operaciones_empleados_asignables');
  return { data: data ?? [], error };
}

/** Crea una tarea. `creado_por` lo setea la app con el usuario actual. */
export async function crearTarea(payload, creadoPor) {
  const { error } = await supabase.from('tareas').insert({
    titulo: payload.titulo,
    descripcion: payload.descripcion ?? null,
    tipo: payload.tipo ?? 'general',
    prioridad: payload.prioridad ?? 'media',
    asignado_empleado_id: payload.asignado_empleado_id ?? null,
    fecha_limite: payload.fecha_limite || null,
    creado_por: creadoPor ?? null,
  });
  return { error };
}

/** Actualiza campos editables de una tarea (admin/supervisor). */
export async function actualizarTarea(id, payload) {
  const { error } = await supabase.from('tareas').update({
    titulo: payload.titulo,
    descripcion: payload.descripcion ?? null,
    tipo: payload.tipo ?? 'general',
    prioridad: payload.prioridad ?? 'media',
    asignado_empleado_id: payload.asignado_empleado_id ?? null,
    fecha_limite: payload.fecha_limite || null,
  }).eq('id', id);
  return { error };
}

/** Mueve el estado de una tarea (RPC: admin/supervisor o el propio asignado). */
export async function moverEstado(id, estado) {
  const { error } = await supabase.rpc('tarea_mover_estado', { p_tarea_id: id, p_estado: estado });
  return { error };
}
```

- [ ] **Step 2: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: build OK, sin errores de import.

- [ ] **Step 3: Commit**

```bash
git add src/services/tareasService.js
git commit -m "feat(operaciones): tareasService (listar/crear/actualizar/mover/asignables)"
```

---

## Task 4: Modal de alta/edición (`TareaModal.jsx`)

**Files:**
- Create: `src/components/operaciones/TareaModal.jsx`

- [ ] **Step 1: Escribir el componente**

```jsx
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TIPOS = [
  { v: 'general', l: 'General' },
  { v: 'mejora', l: 'Mejora interna' },
  { v: 'mantenimiento', l: 'Mantenimiento' },
];
const PRIORIDADES = [
  { v: 'baja', l: 'Baja' },
  { v: 'media', l: 'Media' },
  { v: 'alta', l: 'Alta' },
];

const VACIA = { titulo: '', descripcion: '', tipo: 'general', prioridad: 'media', asignado_empleado_id: '', fecha_limite: '' };

export default function TareaModal({ open, onOpenChange, empleados, tarea, onGuardar }) {
  const [form, setForm] = useState(VACIA);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(tarea
        ? {
            titulo: tarea.titulo ?? '',
            descripcion: tarea.descripcion ?? '',
            tipo: tarea.tipo ?? 'general',
            prioridad: tarea.prioridad ?? 'media',
            asignado_empleado_id: tarea.asignado_empleado_id ?? '',
            fecha_limite: tarea.fecha_limite ?? '',
          }
        : VACIA);
    }
  }, [open, tarea]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const guardar = async () => {
    if (!form.titulo.trim()) return;
    setGuardando(true);
    await onGuardar({ ...form, asignado_empleado_id: form.asignado_empleado_id || null });
    setGuardando(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tarea ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="t-titulo">Título</Label>
            <Input id="t-titulo" value={form.titulo} onChange={set('titulo')} placeholder="Qué hay que hacer" />
          </div>
          <div>
            <Label htmlFor="t-desc">Descripción</Label>
            <textarea id="t-desc" value={form.descripcion} onChange={set('descripcion')}
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-tipo">Tipo</Label>
              <select id="t-tipo" value={form.tipo} onChange={set('tipo')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="t-prio">Prioridad</Label>
              <select id="t-prio" value={form.prioridad} onChange={set('prioridad')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="t-asig">Asignar a</Label>
              <select id="t-asig" value={form.asignado_empleado_id} onChange={set('asignado_empleado_id')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">— Sin asignar —</option>
                {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre_completo}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="t-fecha">Fecha límite</Label>
              <Input id="t-fecha" type="date" value={form.fecha_limite} onChange={set('fecha_limite')} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={guardar} disabled={guardando || !form.titulo.trim()}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Confirmar primitivos UI**

Verificar que existen los componentes importados:

Run: `ls src/components/ui/dialog.jsx src/components/ui/button.jsx src/components/ui/input.jsx src/components/ui/label.jsx`
Expected: los 4 archivos existen. Si alguno tiene otra extensión/ruta, ajustar el import. (Si `dialog` no exporta `DialogFooter`, usar un `<div className="flex justify-end gap-2 mt-4">` en su lugar.)

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/operaciones/TareaModal.jsx
git commit -m "feat(operaciones): modal de alta/edición de tarea"
```

---

## Task 5: Tablero kanban sin drag (`TableroTareas.jsx`)

**Files:**
- Create: `src/components/operaciones/TableroTareas.jsx`

- [ ] **Step 1: Escribir el componente**

```jsx
import React from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Calendar } from 'lucide-react';

const COLUMNAS = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'en_progreso', label: 'En progreso' },
  { id: 'bloqueada', label: 'Bloqueada' },
  { id: 'hecha', label: 'Hecha' },
];
const PRIO_COLOR = { alta: 'bg-red-100 text-red-700', media: 'bg-amber-100 text-amber-700', baja: 'bg-slate-100 text-slate-600' };

function Tarjeta({ tarea, nombreEmpleado, puedeEditar, onEditar, onMover }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{tarea.titulo}</p>
        {puedeEditar && (
          <button type="button" onClick={() => onEditar(tarea)} className="text-gray-400 hover:text-gray-600" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 ${PRIO_COLOR[tarea.prioridad] || ''}`}>{tarea.prioridad}</span>
        {tarea.fecha_limite && (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Calendar className="h-3 w-3" />{tarea.fecha_limite}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">{nombreEmpleado || 'Sin asignar'}</p>
      <select
        value={tarea.estado}
        onChange={(e) => onMover(tarea, e.target.value)}
        className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Mover a"
      >
        {COLUMNAS.map((c) => <option key={c.id} value={c.id}>Mover a: {c.label}</option>)}
      </select>
    </div>
  );
}

export default function TableroTareas({ tareas, nombrePorEmpleado, puedeEditar, onEditar, onMover }) {
  const porColumna = (estado) => tareas.filter((t) => t.estado === estado);

  return (
    <>
      {/* Web: 4 columnas */}
      <div className="hidden sm:grid grid-cols-4 gap-3">
        {COLUMNAS.map((col) => (
          <div key={col.id} className="rounded-xl bg-gray-50 p-2">
            <h3 className="px-1 pb-2 text-sm font-semibold text-gray-700">
              {col.label} <span className="text-gray-400">({porColumna(col.id).length})</span>
            </h3>
            <div className="space-y-2">
              {porColumna(col.id).map((t) => (
                <Tarjeta key={t.id} tarea={t} nombreEmpleado={nombrePorEmpleado[t.asignado_empleado_id]}
                  puedeEditar={puedeEditar} onEditar={onEditar} onMover={onMover} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Móvil: lista de tarjetas agrupada por estado */}
      <div className="sm:hidden space-y-4">
        {COLUMNAS.map((col) => (
          <div key={col.id}>
            <h3 className="pb-1 text-sm font-semibold text-gray-700">
              {col.label} <span className="text-gray-400">({porColumna(col.id).length})</span>
            </h3>
            <div className="space-y-2">
              {porColumna(col.id).map((t) => (
                <Tarjeta key={t.id} tarea={t} nombreEmpleado={nombrePorEmpleado[t.asignado_empleado_id]}
                  puedeEditar={puedeEditar} onEditar={onEditar} onMover={onMover} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK. (Si `lucide-react` no exporta `Pencil`/`Calendar`, usar iconos existentes equivalentes.)

- [ ] **Step 3: Commit**

```bash
git add src/components/operaciones/TableroTareas.jsx
git commit -m "feat(operaciones): tablero kanban sin drag (web + móvil)"
```

---

## Task 6: Vista Por colaborador (`TareasPorColaborador.jsx`)

**Files:**
- Create: `src/components/operaciones/TareasPorColaborador.jsx`

- [ ] **Step 1: Escribir el componente**

```jsx
import React, { useMemo } from 'react';

const ABIERTAS = new Set(['pendiente', 'en_progreso', 'bloqueada']);
const ESTADO_LABEL = { pendiente: 'Pendiente', en_progreso: 'En progreso', bloqueada: 'Bloqueada', hecha: 'Hecha' };

export default function TareasPorColaborador({ tareas, empleados, nombrePorEmpleado }) {
  const grupos = useMemo(() => {
    const base = new Map();
    empleados.forEach((e) => base.set(e.id, []));
    tareas.forEach((t) => {
      const key = t.asignado_empleado_id ?? '__sin__';
      if (!base.has(key)) base.set(key, []);
      base.get(key).push(t);
    });
    return Array.from(base.entries()).map(([id, lista]) => ({
      id,
      nombre: id === '__sin__' ? 'Sin asignar' : (nombrePorEmpleado[id] || 'Empleado'),
      lista,
      pendientes: lista.filter((t) => ABIERTAS.has(t.estado)).length,
    })).filter((g) => g.lista.length > 0);
  }, [tareas, empleados, nombrePorEmpleado]);

  if (grupos.length === 0) {
    return <p className="text-sm text-gray-500">No hay tareas todavía.</p>;
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.id} className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-800">{g.nombre}</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              {g.pendientes} pendientes
            </span>
          </div>
          <ul className="divide-y">
            {g.lista.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className={t.estado === 'hecha' ? 'text-gray-400 line-through' : ''}>{t.titulo}</span>
                <span className="text-xs text-gray-500">{ESTADO_LABEL[t.estado]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/components/operaciones/TareasPorColaborador.jsx
git commit -m "feat(operaciones): vista por colaborador con conteo de pendientes"
```

---

## Task 7: Página de la pestaña (`OperacionesTareas.jsx`)

**Files:**
- Create: `src/pages/OperacionesTareas.jsx`

- [ ] **Step 1: Escribir la página**

```jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useToast } from '@/components/ui/use-toast';
import {
  listarTareas, empleadosAsignables, crearTarea, actualizarTarea, moverEstado,
} from '@/services/tareasService';
import TableroTareas from '@/components/operaciones/TableroTareas';
import TareasPorColaborador from '@/components/operaciones/TareasPorColaborador';
import TareaModal from '@/components/operaciones/TareaModal';

export default function OperacionesTareas() {
  const { can, userId } = usePermissions();
  const { toast } = useToast();
  const puedeCrear = can('operaciones', 'crear');
  const puedeEditar = can('operaciones', 'editar');

  const [vista, setVista] = useState('tablero');
  const [tareas, setTareas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tareaEdit, setTareaEdit] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [{ data: t, error: e1 }, { data: emp, error: e2 }] = await Promise.all([
      listarTareas(), empleadosAsignables(),
    ]);
    if (e1 || e2) toast({ title: 'Error al cargar', description: (e1 || e2).message, variant: 'destructive' });
    setTareas(t);
    setEmpleados(emp);
    setCargando(false);
  }, [toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const nombrePorEmpleado = useMemo(() => {
    const m = {};
    empleados.forEach((e) => { m[e.id] = e.nombre_completo; });
    return m;
  }, [empleados]);

  const abrirNueva = () => { setTareaEdit(null); setModalOpen(true); };
  const abrirEditar = (t) => { setTareaEdit(t); setModalOpen(true); };

  const guardar = async (form) => {
    const { error } = tareaEdit
      ? await actualizarTarea(tareaEdit.id, form)
      : await crearTarea(form, userId);
    if (error) { toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: tareaEdit ? 'Tarea actualizada' : 'Tarea creada' });
    await cargar();
  };

  const mover = async (tarea, estado) => {
    if (estado === tarea.estado) return;
    const { error } = await moverEstado(tarea.id, estado);
    if (error) { toast({ title: 'No se pudo mover', description: error.message, variant: 'destructive' }); return; }
    await cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border bg-white p-0.5 text-sm">
          <button type="button" onClick={() => setVista('tablero')}
            className={`rounded-md px-3 py-1.5 ${vista === 'tablero' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
            Tablero
          </button>
          <button type="button" onClick={() => setVista('colaborador')}
            className={`rounded-md px-3 py-1.5 ${vista === 'colaborador' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
            Por colaborador
          </button>
        </div>
        {puedeCrear && (
          <Button onClick={abrirNueva}><Plus className="mr-1 h-4 w-4" /> Nueva tarea</Button>
        )}
      </div>

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : vista === 'tablero' ? (
        <TableroTareas tareas={tareas} nombrePorEmpleado={nombrePorEmpleado}
          puedeEditar={puedeEditar} onEditar={abrirEditar} onMover={mover} />
      ) : (
        <TareasPorColaborador tareas={tareas} empleados={empleados} nombrePorEmpleado={nombrePorEmpleado} />
      )}

      <TareaModal open={modalOpen} onOpenChange={setModalOpen}
        empleados={empleados} tarea={tareaEdit} onGuardar={guardar} />
    </div>
  );
}
```

- [ ] **Step 2: Confirmar el hook de toast**

Run: `ls src/components/ui/use-toast.* 2>/dev/null; grep -rl "export function useToast\|export const useToast" src/components/ui src/hooks | head`
Expected: encontrar la ruta real de `useToast`. Ajustar el import si difiere (p. ej. `@/hooks/use-toast`). Confirmar también que `usePermissions` expone `userId` (lo hace, ver `PermissionsContext.jsx`).

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/pages/OperacionesTareas.jsx
git commit -m "feat(operaciones): página de tareas (tablero + por colaborador)"
```

---

## Task 8: Ruta y pestaña en el módulo Operaciones

**Files:**
- Modify: `src/App.jsx` (bloque `<Route path="operaciones" ...>`, ~líneas 275-290)
- Modify: `src/components/module/ModuleSectionLayouts.jsx` (items del layout de Operaciones, ~línea 117)

- [ ] **Step 1: Importar la página en `App.jsx`**

Junto a los demás imports de páginas (cerca de `import Proyectos from '@/pages/Proyectos';`):

```jsx
import OperacionesTareas from '@/pages/OperacionesTareas';
```

- [ ] **Step 2: Añadir la ruta dentro de `<Route path="operaciones" element={<OperacionesModuleLayout />}>`**

Agregar como hijo (junto a la ruta `proyectos`):

```jsx
              <Route
                path="tareas"
                element={
                  <ProtectedRoute requiredPermission={{ modulo: 'operaciones', accion: 'ver' }}>
                    <OperacionesTareas />
                  </ProtectedRoute>
                }
              />
```

- [ ] **Step 3: Añadir la pestaña en `ModuleSectionLayouts.jsx`**

En el array `items` del layout de Operaciones (donde está `{ to: '/operaciones/proyectos', label: 'Proyectos', ... }`), agregar:

```jsx
        { to: '/operaciones/tareas', label: 'Tareas', icon: ListChecks },
```

Y asegurar que `ListChecks` esté importado desde `lucide-react` en ese archivo (añadirlo a la lista de imports de iconos si falta).

- [ ] **Step 4: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: build OK, sin imports faltantes.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/module/ModuleSectionLayouts.jsx
git commit -m "feat(operaciones): ruta y pestaña Tareas en el módulo Operaciones"
```

---

## Task 9: Humo manual + despliegue

**Files:** ninguno (verificación y deploy)

- [ ] **Step 1: Correr la app en local**

Run: `npm run dev`
Abrir `/operaciones/tareas`.

- [ ] **Step 2: Smoke como admin/supervisor**

- La pestaña "Tareas" aparece en Operaciones.
- "Nueva tarea": crear con título, asignar a un empleado (el dropdown carga vía RPC), fecha y prioridad → aparece en columna Pendiente.
- "Mover a: En progreso" en la tarjeta → la tarjeta cambia de columna tras recargar.
- Vista "Por colaborador": el empleado aparece con su conteo de pendientes.
- En móvil (DevTools responsive): las columnas se vuelven lista de tarjetas.

- [ ] **Step 3: Verificar RLS (solo lectura)**

En el SQL Editor, confirmar que un OPERADOR sin `usuario_id` mapeado no vería tareas ajenas. Comprobación de lógica:

```sql
-- Debe devolver true solo para quien tenga el submódulo 'todos'
select permiso_por_defecto_rol('OPERADOR','operaciones','ver','todos'); -- false
```
(La verificación end-to-end por operativo requiere una cuenta OPERADOR con `empleados.usuario_id` mapeado; opcional en F1.)

- [ ] **Step 4: Build de producción y despliegue**

Run: `npm run build`
Expected: build OK.

```bash
git add dist
git commit -m "build: Operaciones F1 tablero de tareas"
git push origin main
```

---

## Self-Review (cobertura del spec)

- **Tabla `tareas` + `empleados.usuario_id`** → Task 1. ✔
- **RLS por rol (admin/supervisor/operador) reusando helpers** → Task 1 (políticas + `permiso_por_defecto_rol`). ✔
- **Permiso de módulo `operaciones` en frontend** → Task 2. ✔
- **Kanban sin drag (4 estados)** → Task 5. ✔
- **Vista por colaborador con conteo de pendientes** → Task 6. ✔
- **Crear/editar/asignar (modal)** → Task 4 + Task 7. ✔
- **Operativo mueve solo las suyas** → RPC `tarea_mover_estado` (Task 1) usado por el tablero (Task 5/7). ✔
- **Empleados asignables sin exponer `personal`** → RPC `operaciones_empleados_asignables` (Task 1). ✔
- **Pestaña + ruta en módulo Operaciones** → Task 8. ✔
- **Responsive tarjetas/tabla** → Task 5 (web + móvil). ✔
- **Funciona sin logins de operativos** → asignación libre + supervisor-first; el operativo es aditivo. ✔
- **Tipos mejora/mantenimiento/general** → Task 1 (CHECK) + Task 4 (modal). ✔
- **Despliegue manual** → Task 9. ✔

**Decisión confirmada del spec (OPERADOR puede mover estado):** sí, vía RPC `tarea_mover_estado`, sin debilitar RLS ni dar UPDATE directo. El resto de edición queda en admin/supervisor.

**Fuera de alcance (F2/F3), no en este plan:** rutinas/recurrencia por fecha + calendario; seguimientos solo-lectura de pedidos/OC; conciliación de mantenimiento con `mantenimientos`; tareas auto-generadas; métricas de productividad.
```
