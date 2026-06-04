# Dashboard Ventas v2 – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el Dashboard de Ventas con dos tabs (Anual / Mensual), corregir el bug de columna `prospectos.estatus` → `etapa`, eliminar la tabla completa de metas y reemplazarla con una card de progreso del mes actual.

**Architecture:** VentasDashboard.jsx actúa como orquestador que fetchea datos y los pasa a dos componentes de tab (`DashboardAnual`, `DashboardMensual`). El bug de `etapa` se corrige en la query y en PipelineCards. Se crean dos nuevos componentes reutilizables: `MetaMesCard` (card horizontal de progreso del mes) y `TendenciaChart` (mini área chart últimos 6 meses).

**Tech Stack:** React, Recharts, Framer Motion, Tailwind CSS, Supabase, `@/config/ventasMetas`.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/ventas/PipelineCards.jsx` | **Modificar** | Corregir `p.estatus` → `p.etapa` (3 líneas) |
| `src/components/ventas/MetaMesCard.jsx` | **Crear** | Card horizontal: mes, meta MXN, ingreso real, barra de progreso, badge estado |
| `src/components/ventas/TendenciaChart.jsx` | **Crear** | AreaChart mini mostrando real + meta de los últimos 6 meses |
| `src/components/ventas/DashboardAnual.jsx` | **Crear** | Contenido del tab Anual: barra anual + IngresosChart + 4 stat cards pipeline |
| `src/components/ventas/DashboardMensual.jsx` | **Crear** | Contenido del tab Mensual: KpiHero + MetaMesCard + TendenciaChart + PipelineCards |
| `src/pages/VentasDashboard.jsx` | **Modificar** | Corregir query prospectos, agregar tab switcher, usar DashboardAnual/DashboardMensual, eliminar MetasTabla |

---

## Task 1: Corregir bug prospectos.etapa en PipelineCards

**Files:**
- Modify: `src/components/ventas/PipelineCards.jsx`

La columna real en la tabla `prospectos` se llama `etapa`, no `estatus`. El componente usa `p.estatus` en 3 lugares (líneas 36–37) y en el JSDoc (línea 23). Corregir todo.

- [ ] **Step 1.1: Corregir las 3 referencias en PipelineCards.jsx**

Reemplazar el bloque completo del componente (conservar el resto igual):

```jsx
// src/components/ventas/PipelineCards.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, UserPlus } from 'lucide-react';
import { fmtMXNFull } from '@/config/ventasMetas';
import { cn } from '@/lib/utils';

function StatRow({ label, value, sub, color }) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg border p-3', color)}>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/**
 * @param {{
 *   cotizaciones: Array<{estatus: string, total: number}>,
 *   prospectos: Array<{etapa?: string}>,
 *   loading: boolean
 * }} props
 */
export default function PipelineCards({ cotizaciones = [], prospectos = [], loading }) {
  const borradores = cotizaciones.filter(c => c.estatus === 'Borrador');
  const enviadas   = cotizaciones.filter(c => c.estatus === 'Enviada');
  const aprobadas  = cotizaciones.filter(c => c.estatus === 'Aprobada');
  const rechazadas = cotizaciones.filter(c => c.estatus === 'Rechazada');

  const totalPipeline = [...borradores, ...enviadas].reduce((s, c) => s + (Number(c.total) || 0), 0);
  const totalAprobado = aprobadas.reduce((s, c) => s + (Number(c.total) || 0), 0);

  // FIX: usar etapa (no estatus) — columna real en tabla prospectos
  const prospectoActivos     = prospectos.filter(p => !['convertido', 'descartado'].includes(p.etapa));
  const prospectoConvertidos = prospectos.filter(p => p.etapa === 'convertido');
  const conversionPct = prospectos.length > 0
    ? Math.round((prospectoConvertidos.length / prospectos.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />)}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Pipeline de Cotizaciones</h3>
        </div>
        <StatRow
          label="En proceso (Borrador + Enviadas)"
          value={borradores.length + enviadas.length}
          sub={`Valor: ${fmtMXNFull(totalPipeline)}`}
          color="bg-blue-50/60 border-blue-100"
        />
        <StatRow
          label="Aprobadas"
          value={aprobadas.length}
          sub={`Valor: ${fmtMXNFull(totalAprobado)}`}
          color="bg-green-50/60 border-green-100"
        />
        <StatRow
          label="Rechazadas"
          value={rechazadas.length}
          sub="Oportunidades perdidas"
          color="bg-red-50/40 border-red-100"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-800">Pipeline de Prospectos</h3>
        </div>
        <StatRow
          label="Prospectos activos"
          value={prospectoActivos.length}
          sub="En proceso de conversión"
          color="bg-purple-50/60 border-purple-100"
        />
        <StatRow
          label="Convertidos a clientes"
          value={prospectoConvertidos.length}
          sub={`Tasa: ${conversionPct}% de conversión`}
          color="bg-green-50/60 border-green-100"
        />
        <StatRow
          label="Total prospectos registrados"
          value={prospectos.length}
          sub="Histórico completo"
          color="bg-gray-50 border-gray-100"
        />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 1.2: Commit**

```bash
git add src/components/ventas/PipelineCards.jsx
git commit -m "fix(ventas): corregir columna prospectos.etapa (era estatus)"
```

---

## Task 2: Crear MetaMesCard – Card horizontal de progreso del mes

**Files:**
- Create: `src/components/ventas/MetaMesCard.jsx`

Card ancha que muestra: mes actual, meta MXN, ingreso real cobrado, barra de progreso coloreada y badge de estado vs PE.

- [ ] **Step 2.1: Crear el componente**

```jsx
// src/components/ventas/MetaMesCard.jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMXNFull, PE_MENSUAL } from '@/config/ventasMetas';

/**
 * @param {{
 *   metaMes: { label: string, meta_ingresos: number, vs_pe: number } | null,
 *   ingresoReal: number,
 *   loading: boolean
 * }} props
 */
export default function MetaMesCard({ metaMes, ingresoReal, loading }) {
  const meta = metaMes?.meta_ingresos ?? 0;
  const pct  = meta > 0 ? Math.min(100, Math.round((ingresoReal / meta) * 100)) : 0;
  const peAlcanzado = ingresoReal >= PE_MENSUAL;
  const superaMeta  = ingresoReal >= meta && meta > 0;

  let badgeText, badgeClass;
  if (superaMeta)         { badgeText = '🎯 Meta superada';      badgeClass = 'bg-green-100 text-green-800'; }
  else if (peAlcanzado)   { badgeText = '✅ PE alcanzado';        badgeClass = 'bg-green-100 text-green-800'; }
  else if (pct >= 50)     { badgeText = `${pct}% hacia la meta`; badgeClass = 'bg-blue-100 text-blue-800'; }
  else                    { badgeText = '⚠ Por debajo del PE';   badgeClass = 'bg-amber-100 text-amber-800'; }

  const barClass = superaMeta ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Icono + nombre del mes */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Meta del mes
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {metaMes?.label ?? '—'}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {metaMes?.vs_pe ?? 0}% del PE
              </span>
            </p>
          </div>
        </div>
        {/* Badge estado */}
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', badgeClass)}>
          {badgeText}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-600">
            Meta: <span className="font-semibold text-gray-900">{fmtMXNFull(meta)}</span>
          </span>
          <span className="text-gray-600">
            Real: <span className="font-semibold text-gray-900">
              {loading ? '…' : fmtMXNFull(ingresoReal)}
            </span>
          </span>
          <span className="font-bold text-gray-900">{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          Faltan {fmtMXNFull(Math.max(0, meta - ingresoReal))} · PE mensual: {fmtMXNFull(PE_MENSUAL)}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/ventas/MetaMesCard.jsx
git commit -m "feat(ventas): MetaMesCard con barra de progreso del mes actual"
```

---

## Task 3: Crear TendenciaChart – Mini área chart últimos 6 meses

**Files:**
- Create: `src/components/ventas/TendenciaChart.jsx`

AreaChart compacto (alto 150px) mostrando los últimos 6 meses: área azul = real, línea punteada indigo = meta. Maneja correctamente meses sin datos en METAS_VENTAS (antes de Ene 2026).

- [ ] **Step 3.1: Crear el componente**

```jsx
// src/components/ventas/TendenciaChart.jsx
import React, { useMemo } from 'react';
import {
  AreaChart, Area, Line, ComposedChart, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { METAS_VENTAS, fmtMXN } from '@/config/ventasMetas';

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   mes: number,
 *   anio: number
 * }} props
 */
export default function TendenciaChart({ ingresosPorMes = {}, mes, anio }) {
  const data = useMemo(() => {
    // Construir array de los últimos 6 meses terminando en mes/anio actual
    const months = [];
    let m = mes, y = anio;
    for (let i = 0; i < 6; i++) {
      months.unshift({ mes: m, anio: y });
      m -= 1;
      if (m === 0) { m = 12; y -= 1; }
    }

    return months.map(({ mes: mo, anio: yr }) => {
      const key = `${yr}-${String(mo).padStart(2, '0')}`;
      const metaEntry = METAS_VENTAS.find(x => x.mes === mo && x.anio === yr);
      return {
        label: metaEntry?.label ?? `${mo}/${yr}`,
        real:  ingresosPorMes[key] ?? 0,
        meta:  metaEntry?.meta_ingresos ?? null,
      };
    });
  }, [ingresosPorMes, mes, anio]);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">
        Tendencia — últimos 6 meses
      </h3>
      <ResponsiveContainer width="100%" height={150}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradTendencia" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis tickFormatter={fmtMXN} tick={{ fontSize: 9 }} width={46} />
          <Tooltip
            formatter={(v, name) => [fmtMXN(v ?? 0), name === 'real' ? 'Ingreso real' : 'Meta']}
            labelStyle={{ fontSize: 11 }}
            contentStyle={{ fontSize: 11 }}
          />
          <Area
            dataKey="real"
            name="real"
            stroke="#3b82f6"
            fill="url(#gradTendencia)"
            strokeWidth={2}
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 4 }}
          />
          <Line
            dataKey="meta"
            name="meta"
            stroke="#6366f1"
            strokeDasharray="4 4"
            strokeWidth={1.5}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/components/ventas/TendenciaChart.jsx
git commit -m "feat(ventas): TendenciaChart mini área chart últimos 6 meses"
```

---

## Task 4: Crear DashboardAnual – Contenido del tab anual

**Files:**
- Create: `src/components/ventas/DashboardAnual.jsx`

Recibe todos los datos como props y renderiza: barra de progreso anual, gráfica IngresosChart 12 meses, y 4 stat cards de pipeline global (pipeline total, cotizaciones aprobadas, prospectos activos, tasa de conversión).

- [ ] **Step 4.1: Crear el componente**

```jsx
// src/components/ventas/DashboardAnual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CheckCircle, Users, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMXNFull, META_ANUAL_2026 } from '@/config/ventasMetas';
import IngresosChart from '@/components/ventas/IngresosChart';

function StatCard({ icon: Icon, label, value, sub, color, delay, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        'flex flex-col gap-2 rounded-xl border bg-white p-5 shadow-sm',
        color === 'blue'   && 'border-blue-100',
        color === 'green'  && 'border-green-100',
        color === 'purple' && 'border-purple-100',
        color === 'indigo' && 'border-indigo-100',
      )}
    >
      <div className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg',
        color === 'blue'   && 'bg-blue-50   text-blue-600',
        color === 'green'  && 'bg-green-50  text-green-600',
        color === 'purple' && 'bg-purple-50 text-purple-600',
        color === 'indigo' && 'bg-indigo-50 text-indigo-600',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {loading
        ? <div className="h-7 w-24 animate-pulse rounded bg-gray-200" />
        : <p className="text-xl font-bold text-gray-900">{value}</p>
      }
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </motion.div>
  );
}

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   cotizaciones: Array<{estatus: string, total: number}>,
 *   prospectos: Array<{etapa?: string}>,
 *   loading: boolean,
 *   anio: number,
 * }} props
 */
export default function DashboardAnual({ ingresosPorMes, cotizaciones, prospectos, loading, anio }) {
  const totalReal = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k]) => k.startsWith(`${anio}-`))
      .reduce((s, [, v]) => s + v, 0),
    [ingresosPorMes, anio]
  );
  const pct = META_ANUAL_2026 > 0
    ? Math.min(100, Math.round((totalReal / META_ANUAL_2026) * 100))
    : 0;

  // Pipeline stats
  const aprobadas   = cotizaciones.filter(c => c.estatus === 'Aprobada');
  const enProceso   = cotizaciones.filter(c => ['Borrador', 'Enviada'].includes(c.estatus));
  const pipelineVal = [...enProceso, ...aprobadas].reduce((s, c) => s + (Number(c.total) || 0), 0);
  const convertidos = prospectos.filter(p => p.etapa === 'convertido');
  const activos     = prospectos.filter(p => !['convertido', 'descartado'].includes(p.etapa));
  const convPct     = prospectos.length > 0
    ? Math.round((convertidos.length / prospectos.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Barra de progreso anual */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0 }}
        className="rounded-xl border bg-white p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-gray-700">Avance anual {anio}</p>
          <p className="text-sm font-bold text-gray-900">
            {loading ? '…' : fmtMXNFull(totalReal)} / {fmtMXNFull(META_ANUAL_2026)}
            {' · '}
            <span className={pct >= 100 ? 'text-green-700' : 'text-blue-700'}>{pct}%</span>
          </p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          Meta anual: {fmtMXNFull(META_ANUAL_2026)} · Faltan {fmtMXNFull(Math.max(0, META_ANUAL_2026 - totalReal))}
        </p>
      </motion.div>

      {/* Gráfica 12 meses */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <IngresosChart ingresosPorMes={ingresosPorMes} anio={anio} />
      </motion.div>

      {/* 4 stat cards pipeline global */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={DollarSign}
          label="Valor pipeline"
          value={loading ? '…' : fmtMXNFull(pipelineVal)}
          sub="Cotizaciones activas"
          color="blue"
          delay={0.1}
          loading={loading}
        />
        <StatCard
          icon={CheckCircle}
          label="Cotizaciones aprobadas"
          value={loading ? '…' : aprobadas.length}
          sub={loading ? '…' : fmtMXNFull(aprobadas.reduce((s, c) => s + (Number(c.total) || 0), 0))}
          color="green"
          delay={0.15}
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="Prospectos activos"
          value={loading ? '…' : activos.length}
          sub="En proceso de conversión"
          color="purple"
          delay={0.2}
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="Tasa de conversión"
          value={loading ? '…' : `${convPct}%`}
          sub={loading ? '…' : `${convertidos.length} convertidos de ${prospectos.length}`}
          color="indigo"
          delay={0.25}
          loading={loading}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/ventas/DashboardAnual.jsx
git commit -m "feat(ventas): DashboardAnual con barra anual, chart 12 meses y stats pipeline"
```

---

## Task 5: Crear DashboardMensual – Contenido del tab mensual

**Files:**
- Create: `src/components/ventas/DashboardMensual.jsx`

Recibe todos los datos y el mes/año actual. Renderiza en orden: KpiHero (4 cards), MetaMesCard (card de progreso), TendenciaChart (mini chart 6 meses), PipelineCards (detalle cotizaciones + prospectos).

- [ ] **Step 5.1: Crear el componente**

```jsx
// src/components/ventas/DashboardMensual.jsx
import React, { useMemo } from 'react';
import { getMetaMes } from '@/config/ventasMetas';
import KpiHero from '@/components/ventas/KpiHero';
import MetaMesCard from '@/components/ventas/MetaMesCard';
import TendenciaChart from '@/components/ventas/TendenciaChart';
import PipelineCards from '@/components/ventas/PipelineCards';

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   cotizaciones: Array<{estatus: string, total: number}>,
 *   prospectos: Array<{etapa?: string}>,
 *   loading: boolean,
 *   mes: number,
 *   anio: number,
 * }} props
 */
export default function DashboardMensual({ ingresosPorMes, cotizaciones, prospectos, loading, mes, anio }) {
  const metaMes = useMemo(() => getMetaMes(mes, anio), [mes, anio]);

  const ingresoMes = useMemo(() => {
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    return ingresosPorMes[key] ?? 0;
  }, [ingresosPorMes, mes, anio]);

  return (
    <div className="space-y-5">
      {/* 4 KPI cards: Meta del mes / Ingreso real / Avance % / Estado */}
      <KpiHero metaMes={metaMes} ingresoReal={ingresoMes} loading={loading} />

      {/* Card horizontal con barra de progreso del mes */}
      <MetaMesCard metaMes={metaMes} ingresoReal={ingresoMes} loading={loading} />

      {/* Mini chart tendencia últimos 6 meses */}
      <TendenciaChart ingresosPorMes={ingresosPorMes} mes={mes} anio={anio} />

      {/* Pipeline detallado: cotizaciones por estatus + funnel prospectos */}
      <PipelineCards cotizaciones={cotizaciones} prospectos={prospectos} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/ventas/DashboardMensual.jsx
git commit -m "feat(ventas): DashboardMensual con KPIs, MetaMesCard, TendenciaChart y Pipeline"
```

---

## Task 6: Refactorizar VentasDashboard – Agregar tabs y conectar todo

**Files:**
- Modify: `src/pages/VentasDashboard.jsx`

Cambios principales:
1. Corregir query de prospectos: `.select('id, etapa')` (era `id, estatus`)
2. Agregar estado `tab` ('anual' | 'mensual') con default 'anual'
3. Agregar tab switcher UI (pill-style buttons: "Anual 2026" | "{Mes} {Año}")
4. Reemplazar el contenido principal por `<DashboardAnual>` o `<DashboardMensual>` según tab activo
5. Eliminar import y uso de `MetasTabla`
6. Eliminar la barra de progreso anual del nivel superior (ya está dentro de `DashboardAnual`)
7. Eliminar el `KpiHero` del nivel superior (ya está dentro de `DashboardMensual`)
8. Eliminar `IngresosChart` del nivel superior (ya está dentro de `DashboardAnual`)
9. Eliminar `PipelineCards` del nivel superior (ya están dentro de ambos dashboards)

- [ ] **Step 6.1: Reemplazar el archivo completo**

```jsx
// src/pages/VentasDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { META_ANUAL_2026, fmtMXNFull } from '@/config/ventasMetas';
import { cn } from '@/lib/utils';
import DashboardAnual from '@/components/ventas/DashboardAnual';
import DashboardMensual from '@/components/ventas/DashboardMensual';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function VentasDashboard() {
  const { toast } = useToast();

  // Calcular mes/año al montar — no en nivel de módulo
  const { mes: MES_ACTUAL, anio: ANIO_ACTUAL } = useMemo(() => {
    const now = new Date();
    return { mes: now.getMonth() + 1, anio: now.getFullYear() };
  }, []);

  const [tab, setTab] = useState('anual');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [ingresosPorMes, setIngresosPorMes] = useState({});
  const [cotizaciones, setCotizaciones]     = useState([]);
  const [prospectos, setProspectos]         = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    setIngresosPorMes({});
    setCotizaciones([]);
    setProspectos([]);
    try {
      const [pagosRes, cotRes, prospRes] = await Promise.all([
        supabase
          .from('proyecto_pagos')
          .select('monto, fecha_pago')
          .gte('fecha_pago', '2026-01-01'),

        supabase
          .from('cotizaciones')
          .select('estatus, total, fecha')
          .not('estatus', 'in', '("Historial","Obsoleta")'),

        // FIX: columna correcta es etapa, no estatus
        supabase
          .from('prospectos')
          .select('id, etapa')
          .eq('eliminado', false),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (cotRes.error)   throw cotRes.error;
      if (prospRes.error) throw prospRes.error;

      const mapa = {};
      for (const pago of pagosRes.data || []) {
        if (!pago.fecha_pago) continue;
        const key = pago.fecha_pago.slice(0, 7);
        mapa[key] = (mapa[key] || 0) + Number(pago.monto || 0);
      }
      setIngresosPorMes(mapa);
      setCotizaciones(cotRes.data || []);
      setProspectos(prospRes.data || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al cargar dashboard', description: err.message });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mesLabel = `${NOMBRES_MES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`;

  return (
    <>
      <Helmet>
        <title>Dashboard Ventas – IIHEMSA Peninsular</title>
      </Helmet>

      <div className="space-y-5">
        {/* ── Encabezado ─────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard de Ventas</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Seguimiento de metas · Meta anual {ANIO_ACTUAL}: {fmtMXNFull(META_ANUAL_2026)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            disabled={loading}
            className="gap-2"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <RefreshCw className="h-4 w-4" />
            }
            Actualizar
          </Button>
        </div>

        {/* ── Error banner ───────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudieron cargar los datos. Usa el botón{' '}
            <strong>Actualizar</strong> para reintentar.
          </div>
        )}

        {/* ── Tab switcher ───────────────────────────── */}
        <div className="flex rounded-xl border bg-white p-1 shadow-sm w-fit gap-1">
          <button
            type="button"
            onClick={() => setTab('anual')}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
              tab === 'anual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            Anual {ANIO_ACTUAL}
          </button>
          <button
            type="button"
            onClick={() => setTab('mensual')}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
              tab === 'mensual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            {mesLabel}
          </button>
        </div>

        {/* ── Contenido del tab activo ───────────────── */}
        {tab === 'anual' ? (
          <DashboardAnual
            ingresosPorMes={ingresosPorMes}
            cotizaciones={cotizaciones}
            prospectos={prospectos}
            loading={loading}
            anio={ANIO_ACTUAL}
          />
        ) : (
          <DashboardMensual
            ingresosPorMes={ingresosPorMes}
            cotizaciones={cotizaciones}
            prospectos={prospectos}
            loading={loading}
            mes={MES_ACTUAL}
            anio={ANIO_ACTUAL}
          />
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/pages/VentasDashboard.jsx
git commit -m "feat(ventas): agregar tabs Anual/Mensual y corregir query prospectos.etapa"
```

---

## Task 7: Build + push

- [ ] **Step 7.1: Build**

```bash
npm run build
```

Resultado esperado: `✓ built` sin errores TypeScript ni import no encontrado. Las advertencias de `@import` CSS (react-big-calendar) y bundle size son pre-existentes y se pueden ignorar.

- [ ] **Step 7.2: Push**

```bash
git push origin main
```

- [ ] **Step 7.3: Verificar en browser**

1. Navegar a `/ventas/dashboard`
2. Tab "Anual 2026" activo por defecto → debe mostrar barra de progreso + gráfica 12 meses + 4 stat cards
3. Click en tab "Mayo 2026" → debe mostrar 4 KPI cards + MetaMesCard + TendenciaChart + PipelineCards
4. Botón "Actualizar" funciona (spinner aparece, datos se recargan)
5. Pipeline de Prospectos muestra datos reales (ya no hay error `estatus does not exist`)
6. La tabla completa de metas ya NO aparece en ningún tab

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| Bug: `prospectos.estatus` → `etapa` | Task 1 + Task 6 |
| Tab Anual: barra anual + gráfica 12 meses + pipeline global stats | Task 4 |
| Tab Mensual: 4 KPI cards + card de progreso mes + tendencia + pipeline detallado | Task 2 + Task 3 + Task 5 |
| Tab switcher pill-style "Anual YYYY / Mes YYYY" | Task 6 |
| MetaMesCard horizontal con barra de progreso | Task 2 |
| TendenciaChart área últimos 6 meses | Task 3 |
| Eliminar MetasTabla del dashboard | Task 6 |
| Build sin errores + push | Task 7 |
