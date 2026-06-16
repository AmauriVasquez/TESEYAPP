# Tablero por cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar 4 KPIs financieros (Cotizado, Autorizado, Pagado, Por cobrar) + conversión y contadores dentro del modal `ClienteDetalle`, alimentados por una RPC.

**Architecture:** Una función Postgres `get_cliente_resumen(p_cliente_id)` agrega los montos en el servidor (1 round-trip). El frontend la consume al abrir el modal y renderiza un componente presentacional `ClienteResumenCards`. Sin estado nuevo de escritura.

**Tech Stack:** Supabase (Postgres 17, RPC), React 19 + Vite, Tailwind, `@/lib/customSupabaseClient`.

**Verificación (este repo no tiene test runner):** cada tarea de código termina con `npm run lint` y, en la última, `npm run build`; las RPC se verifican con SQL directo. project_id Supabase: `czbmqzimjlwwgcglubey`. Migraciones se aplican **manualmente** en el SQL Editor (el harness no aplica migraciones a producción).

---

## File Structure

- **Create:** `supabase/migrations/2026-06-16_get_cliente_resumen.sql` — la RPC (referencia; se pega manual en SQL Editor).
- **Create:** `src/components/clientes/ClienteResumenCards.jsx` — componente presentacional de los KPIs.
- **Modify:** `src/components/clientes/ClienteDetalle.jsx` — fetch de la RPC + render de `ClienteResumenCards` bajo el header.

---

## Task 1: RPC `get_cliente_resumen`

**Files:**
- Create: `supabase/migrations/2026-06-16_get_cliente_resumen.sql`

- [ ] **Step 1: Escribir el SQL de la función**

```sql
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
```

Notas de diseño:
- `autorizado` usa `cotizacion.total` (lo que la UI muestra por proyecto) con fallback a `proyectos.costo_total` para proyectos sin cotización.
- `security definer` + `set search_path = public` sigue el patrón de `get_items_con_pendiente` (evita el lint `function_search_path_mutable`).

- [ ] **Step 2: Aplicar la migración manualmente**

Pegar el contenido del archivo en el **SQL Editor de Supabase** (proyecto ADMINPROYECTOS) y ejecutar.

- [ ] **Step 3: Verificar la función con un cliente real**

Ejecutar en SQL Editor (reemplazar `<ID>` por un `clientes.id` con cotizaciones y proyectos):

```sql
select * from public.get_cliente_resumen(<ID>);
```

Esperado: una fila con `cotizado >= autorizado` típicamente, `por_cobrar = autorizado - pagado`, y contadores coherentes.

- [ ] **Step 4: Verificar un cliente sin proyectos**

```sql
select * from public.get_cliente_resumen(<ID_sin_proyectos>);
```

Esperado: `autorizado = 0`, `pagado = 0`, `por_cobrar = 0`, `num_proyectos = 0`, sin error.

- [ ] **Step 5: Commit del archivo de migración**

```bash
git add supabase/migrations/2026-06-16_get_cliente_resumen.sql
git commit -m "feat(db): get_cliente_resumen para tablero por cliente"
```

---

## Task 2: Componente `ClienteResumenCards`

**Files:**
- Create: `src/components/clientes/ClienteResumenCards.jsx`

- [ ] **Step 1: Crear el componente presentacional**

```jsx
// src/components/clientes/ClienteResumenCards.jsx
import React from 'react';
import { Loader2, FileText, CheckCircle2, DollarSign, AlertCircle } from 'lucide-react';

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const Card = ({ icon: Icon, label, value, tone = 'gray', hint }) => {
  const tones = {
    gray: 'text-gray-900',
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-base font-bold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
};

const ClienteResumenCards = ({ resumen, loading, error }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }
  if (error || !resumen) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-400">
        No se pudo cargar el resumen financiero.
      </div>
    );
  }

  const { cotizado, autorizado, pagado, por_cobrar, num_cotizaciones, num_proyectos } = resumen;
  const conversion = Number(cotizado) > 0 ? Math.round((Number(autorizado) / Number(cotizado)) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card icon={FileText} label="Cotizado" value={formatMXN(cotizado)} tone="blue" hint="IVA mixto" />
        <Card icon={CheckCircle2} label="Autorizado" value={formatMXN(autorizado)} tone="green" />
        <Card icon={DollarSign} label="Pagado" value={formatMXN(pagado)} tone="gray" />
        <Card
          icon={AlertCircle}
          label="Por cobrar"
          value={formatMXN(por_cobrar)}
          tone={Number(por_cobrar) > 0 ? 'red' : 'gray'}
        />
      </div>
      <p className="text-[11px] text-gray-500">
        Conversión {conversion}% · {num_cotizaciones} cotización{num_cotizaciones === 1 ? '' : 'es'} · {num_proyectos} proyecto{num_proyectos === 1 ? '' : 's'}
      </p>
    </div>
  );
};

export default ClienteResumenCards;
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sin errores nuevos en `ClienteResumenCards.jsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/clientes/ClienteResumenCards.jsx
git commit -m "feat(clientes): componente ClienteResumenCards (KPIs)"
```

---

## Task 3: Integrar fetch + render en `ClienteDetalle`

**Files:**
- Modify: `src/components/clientes/ClienteDetalle.jsx`

- [ ] **Step 1: Importar el componente**

En la zona de imports (junto a la línea 12), añadir:

```jsx
import ClienteResumenCards from '@/components/clientes/ClienteResumenCards';
```

- [ ] **Step 2: Añadir estado del resumen**

Después de la línea 50 (`const [cotizacionesLoaded, setCotizacionesLoaded] = useState(false);`), añadir:

```jsx
  const [resumen, setResumen] = useState(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenError, setResumenError] = useState(false);
```

- [ ] **Step 3: Cargar el resumen cuando hay cliente y el modal está abierto**

Después del `useEffect` que limpia estado al cerrar (línea 82), añadir:

```jsx
  useEffect(() => {
    if (!open || !cliente?.id) {
      setResumen(null);
      setResumenError(false);
      return;
    }
    let cancelled = false;
    setResumenLoading(true);
    setResumenError(false);
    supabase
      .rpc('get_cliente_resumen', { p_cliente_id: cliente.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setResumenError(true);
          setResumen(null);
        } else {
          setResumen(Array.isArray(data) ? data[0] ?? null : data);
        }
      })
      .finally(() => {
        if (!cancelled) setResumenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cliente?.id]);
```

- [ ] **Step 4: Renderizar la franja de KPIs bajo el header**

Entre el cierre de `</DialogHeader>` (línea 112) y `<Tabs ...>` (línea 114), insertar:

```jsx
        <div className="mt-3">
          <ClienteResumenCards resumen={resumen} loading={resumenLoading} error={resumenError} />
        </div>
```

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 7: Verificación manual en navegador**

Run: `npm run dev` → abrir Clientes → ver un cliente con cotizaciones y proyectos.
Esperado: los 4 KPIs muestran montos; la línea de conversión y contadores aparece; cambiar de pestaña Información/Cotizaciones no parpadea ni recalcula los KPIs.

- [ ] **Step 8: Commit**

```bash
git add src/components/clientes/ClienteDetalle.jsx
git commit -m "feat(clientes): tablero de KPIs en ClienteDetalle"
```

---

## Despliegue (al cerrar la feature)

- [ ] `npm run build`, commit del `dist/`, push a `origin/main` (despliegue manual a Hostinger/tesey.com.mx).

---

## Self-Review (cobertura del spec)

- Cotizado/Autorizado/Pagado/Por cobrar → Task 1 (RPC) + Task 2/3 (render). ✓
- Autorizado basado en proyectos → Task 1 CTE `proy`. ✓
- Pipeline = todas las ctz última versión → Task 1 CTE `cot`. ✓
- Conversión + contadores → Task 1 (campos) + Task 2 (línea secundaria). ✓
- Cliente sin proyectos sin romper → Task 1 Step 4. ✓
- No parpadeo al cambiar pestaña → estado separado del de cotizaciones (Task 3). ✓
