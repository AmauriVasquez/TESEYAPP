# Dashboard Ventas – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear un Dashboard de Ventas completo en `/ventas/dashboard` con metas mensuales 2026-2027, gráfica de ingresos reales vs meta, KPIs de pipeline y reordenar el submenú Ventas a: Dashboard → Prospectos → Clientes → Cotizaciones.

**Architecture:** El dashboard es una página React que consulta datos en paralelo desde Supabase (`proyecto_pagos` para ingresos reales, `cotizaciones` para pipeline, `prospectos` para conversión). Las metas mensuales se hardcodean como constantes en `src/config/ventasMetas.js` — no requieren tabla en BD. La visualización usa Recharts `ComposedChart` (barras = real, línea = meta).

**Tech Stack:** React, Recharts (ya instalado), Framer Motion (ya instalado), Tailwind CSS, Supabase, date-fns.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/config/ventasMetas.js` | **Crear** | Constantes: metas mensuales 2026-2027, PE, meta anual |
| `src/pages/VentasDashboard.jsx` | **Crear** | Página principal del dashboard, orquesta queries y componentes |
| `src/components/ventas/KpiHero.jsx` | **Crear** | 4 tarjetas hero: meta del mes, ingreso real, avance %, status PE |
| `src/components/ventas/IngresosChart.jsx` | **Crear** | ComposedChart: barras reales + línea meta + referencia PE |
| `src/components/ventas/MetasTabla.jsx` | **Crear** | Tabla scroll horizontal con todos los meses 2026-2027 |
| `src/components/ventas/PipelineCards.jsx` | **Crear** | Cards con cotizaciones por estatus + resumen prospectos |
| `src/components/module/ModuleSectionLayouts.jsx` | **Modificar** | Reordenar subnav Ventas: Dashboard → Prospectos → Clientes → Cotizaciones |
| `src/App.jsx` | **Modificar** | Cambiar index route ventas de `clientes` → `dashboard`; registrar ruta `/ventas/dashboard` |

---

## Task 1: Constantes de metas mensuales

**Files:**
- Create: `src/config/ventasMetas.js`

- [ ] **Step 1.1: Crear el archivo de configuración**

```js
// src/config/ventasMetas.js

/** Punto de equilibrio mensual (PE) en MXN */
export const PE_MENSUAL = 250_000;

/** Meta anual 2026 (Ene–Dic) */
export const META_ANUAL_2026 = 2_300_000;

/** Meta anual 2027 (12 meses) */
export const META_ANUAL_2027 = 5_100_000;

/**
 * Metas mensuales 2026 y 2027.
 * tipo: 'real' = datos históricos reales, 'proyectado' = plan agresivo
 * meta_ingresos: objetivo de ingresos (MXN)
 * vs_pe: % sobre el punto de equilibrio
 */
export const METAS_VENTAS = [
  // ── 2026 · Datos Reales ──────────────────────────────────
  { mes: 1,  anio: 2026, label: 'Ene 26', meta_ingresos: 23_558,  vs_pe:   9, tipo: 'real' },
  { mes: 2,  anio: 2026, label: 'Feb 26', meta_ingresos: 87_348,  vs_pe:  35, tipo: 'real' },
  { mes: 3,  anio: 2026, label: 'Mar 26', meta_ingresos: 143_682, vs_pe:  57, tipo: 'real' },
  { mes: 4,  anio: 2026, label: 'Abr 26', meta_ingresos: 32_145,  vs_pe:  13, tipo: 'real' },
  { mes: 5,  anio: 2026, label: 'May 26', meta_ingresos: 120_480, vs_pe:  48, tipo: 'real' },
  // ── 2026 · Plan Agresivo ─────────────────────────────────
  { mes: 6,  anio: 2026, label: 'Jun 26', meta_ingresos: 160_000, vs_pe:  64, tipo: 'proyectado' },
  { mes: 7,  anio: 2026, label: 'Jul 26', meta_ingresos: 200_000, vs_pe:  80, tipo: 'proyectado' },
  { mes: 8,  anio: 2026, label: 'Ago 26', meta_ingresos: 230_000, vs_pe:  92, tipo: 'proyectado' },
  { mes: 9,  anio: 2026, label: 'Sep 26', meta_ingresos: 265_000, vs_pe: 106, tipo: 'proyectado' },
  { mes: 10, anio: 2026, label: 'Oct 26', meta_ingresos: 300_000, vs_pe: 120, tipo: 'proyectado' },
  { mes: 11, anio: 2026, label: 'Nov 26', meta_ingresos: 335_000, vs_pe: 134, tipo: 'proyectado' },
  { mes: 12, anio: 2026, label: 'Dic 26', meta_ingresos: 403_000, vs_pe: 161, tipo: 'proyectado' },
  // ── 2027 · Proyección Motor en Marcha ─────────────────────
  { mes: 1,  anio: 2027, label: 'Ene 27', meta_ingresos: 390_000, vs_pe: 156, tipo: 'proyectado' },
  { mes: 2,  anio: 2027, label: 'Feb 27', meta_ingresos: 420_000, vs_pe: 168, tipo: 'proyectado' },
  { mes: 3,  anio: 2027, label: 'Mar 27', meta_ingresos: 460_000, vs_pe: 184, tipo: 'proyectado' },
  { mes: 4,  anio: 2027, label: 'Abr 27', meta_ingresos: 500_000, vs_pe: 200, tipo: 'proyectado' },
  { mes: 5,  anio: 2027, label: 'May 27', meta_ingresos: 540_000, vs_pe: 216, tipo: 'proyectado' },
];

/** Devuelve la entrada de meta para el mes/año indicado, o null. */
export function getMetaMes(mes, anio) {
  return METAS_VENTAS.find((m) => m.mes === mes && m.anio === anio) ?? null;
}

/** Formatea MXN de forma compacta: $23.6K, $160K, $1.2M */
export function fmtMXN(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
}

/** Formatea MXN completo para displays grandes */
export function fmtMXNFull(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
}
```

- [ ] **Step 1.2: Commit**

```bash
git add src/config/ventasMetas.js
git commit -m "feat(ventas): agregar constantes de metas mensuales 2026-2027"
```

---

## Task 2: KpiHero – Tarjetas hero del mes actual

**Files:**
- Create: `src/components/ventas/KpiHero.jsx`

- [ ] **Step 2.1: Crear el componente KpiHero**

```jsx
// src/components/ventas/KpiHero.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Target, DollarSign, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMXNFull, PE_MENSUAL } from '@/config/ventasMetas';

function HeroCard({ icon: Icon, label, value, sub, color, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        'flex flex-col gap-1 rounded-xl border bg-white p-5 shadow-sm',
        color === 'blue'   && 'border-blue-100',
        color === 'green'  && 'border-green-100',
        color === 'amber'  && 'border-amber-100',
        color === 'purple' && 'border-purple-100',
      )}
    >
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg',
        color === 'blue'   && 'bg-blue-50 text-blue-600',
        color === 'green'  && 'bg-green-50 text-green-600',
        color === 'amber'  && 'bg-amber-50 text-amber-600',
        color === 'purple' && 'bg-purple-50 text-purple-600',
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {loading ? (
        <div className="h-8 w-32 animate-pulse rounded-md bg-gray-200" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      )}
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </motion.div>
  );
}

/**
 * @param {{ metaMes: import('@/config/ventasMetas').METAS_VENTAS[0]|null, ingresoReal: number, loading: boolean }} props
 */
export default function KpiHero({ metaMes, ingresoReal, loading }) {
  const meta = metaMes?.meta_ingresos ?? 0;
  const avancePct = meta > 0 ? Math.round((ingresoReal / meta) * 100) : 0;
  const peAlcanzado = ingresoReal >= PE_MENSUAL;
  const superaMeta   = ingresoReal >= meta;

  let statusLabel = 'Por debajo del PE';
  let statusColor = 'amber';
  if (superaMeta)   { statusLabel = '🎯 Meta superada'; statusColor = 'green'; }
  else if (peAlcanzado) { statusLabel = '✅ PE alcanzado'; statusColor = 'green'; }
  else if (avancePct >= 50) { statusLabel = `${avancePct}% hacia meta`; statusColor = 'blue'; }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <HeroCard
        icon={Target}
        label="Meta del mes"
        value={fmtMXNFull(meta)}
        sub={metaMes ? `${metaMes.vs_pe}% del PE` : undefined}
        color="blue"
        delay={0}
        loading={false}
      />
      <HeroCard
        icon={DollarSign}
        label="Ingresos reales"
        value={fmtMXNFull(ingresoReal)}
        sub="Pagos cobrados en el mes"
        color="green"
        delay={0.05}
        loading={loading}
      />
      <HeroCard
        icon={TrendingUp}
        label="Avance vs meta"
        value={`${avancePct}%`}
        sub={`Faltan ${fmtMXNFull(Math.max(0, meta - ingresoReal))}`}
        color={avancePct >= 100 ? 'green' : avancePct >= 50 ? 'blue' : 'amber'}
        delay={0.1}
        loading={loading}
      />
      <HeroCard
        icon={Zap}
        label="Estado"
        value={statusLabel}
        sub={`PE mensual: ${fmtMXNFull(PE_MENSUAL)}`}
        color={statusColor}
        delay={0.15}
        loading={loading}
      />
    </div>
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/ventas/KpiHero.jsx
git commit -m "feat(ventas): componente KpiHero con tarjetas del mes actual"
```

---

## Task 3: IngresosChart – Gráfica ingresos reales vs meta

**Files:**
- Create: `src/components/ventas/IngresosChart.jsx`

- [ ] **Step 3.1: Crear el componente de gráfica**

```jsx
// src/components/ventas/IngresosChart.jsx
import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { METAS_VENTAS, PE_MENSUAL, fmtMXN } from '@/config/ventasMetas';

const NOW_MES  = new Date().getMonth() + 1; // 1-12
const NOW_ANIO = new Date().getFullYear();

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-gray-800">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtMXN(p.value)}
        </p>
      ))}
    </div>
  );
}

/**
 * @param {{ ingresosPorMes: Record<string, number>, anio?: number }} props
 * ingresosPorMes: clave "YYYY-MM" → monto total cobrado
 */
export default function IngresosChart({ ingresosPorMes = {}, anio = 2026 }) {
  const data = useMemo(() => {
    return METAS_VENTAS
      .filter((m) => m.anio === anio)
      .map((m) => {
        const key = `${m.anio}-${String(m.mes).padStart(2, '0')}`;
        const real = ingresosPorMes[key] ?? null;
        const esPasado = m.anio < NOW_ANIO || (m.anio === NOW_ANIO && m.mes <= NOW_MES);
        return {
          label: m.label,
          meta: m.meta_ingresos,
          real: esPasado ? (real ?? 0) : null,
          tipo: m.tipo,
        };
      });
  }, [ingresosPorMes, anio]);

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-gray-800">
        Ingresos {anio} — Real vs Meta mensual
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v) => fmtMXN(v)}
            tick={{ fontSize: 10 }}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <ReferenceLine
            y={PE_MENSUAL}
            stroke="#f59e0b"
            strokeDasharray="5 5"
            label={{ value: 'PE', position: 'insideTopRight', fontSize: 10, fill: '#92400e' }}
          />
          <Bar dataKey="real" name="Ingreso real" maxBarSize={32} radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.real !== null && entry.real >= entry.meta ? '#16a34a' : '#3b82f6'}
                fillOpacity={entry.real === null ? 0 : 1}
              />
            ))}
          </Bar>
          <Line
            dataKey="meta"
            name="Meta"
            type="monotone"
            stroke="#6366f1"
            strokeWidth={2}
            dot={{ r: 3 }}
            strokeDasharray={undefined}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[10px] text-gray-400">
        Barra azul = por debajo de meta · Barra verde = meta superada · Línea punteada amarilla = Punto de Equilibrio ($250K)
      </p>
    </div>
  );
}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/components/ventas/IngresosChart.jsx
git commit -m "feat(ventas): gráfica ComposedChart ingresos reales vs meta mensual"
```

---

## Task 4: MetasTabla – Tabla de metas 2026-2027

**Files:**
- Create: `src/components/ventas/MetasTabla.jsx`

- [ ] **Step 4.1: Crear el componente de tabla**

```jsx
// src/components/ventas/MetasTabla.jsx
import React from 'react';
import { cn } from '@/lib/utils';
import { METAS_VENTAS, META_ANUAL_2026, META_ANUAL_2027, fmtMXNFull } from '@/config/ventasMetas';

const MES_ACTUAL = new Date().getMonth() + 1;
const ANIO_ACTUAL = new Date().getFullYear();

function isMesActual(mes, anio) {
  return mes === MES_ACTUAL && anio === ANIO_ACTUAL;
}

function Badge2026({ tipo }) {
  if (tipo === 'real') {
    return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">Real</span>;
  }
  return <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">Plan</span>;
}

/**
 * @param {{ ingresosPorMes?: Record<string, number> }} props
 */
export default function MetasTabla({ ingresosPorMes = {} }) {
  const metas2026 = METAS_VENTAS.filter((m) => m.anio === 2026);
  const metas2027 = METAS_VENTAS.filter((m) => m.anio === 2027);

  const real2026 = metas2026.filter((m) => m.tipo === 'real').reduce((s, m) => s + m.meta_ingresos, 0);
  const plan2026 = metas2026.filter((m) => m.tipo === 'proyectado').reduce((s, m) => s + m.meta_ingresos, 0);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b px-5 py-3">
        <h3 className="text-sm font-semibold text-gray-800">Plan de metas 2026 – 2027</h3>
        <span className="text-xs text-gray-500">Meta anual 2026: {fmtMXNFull(META_ANUAL_2026)}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Mes</th>
              <th className="px-4 py-2 text-right">Meta MXN</th>
              <th className="px-4 py-2 text-right">vs PE</th>
              <th className="px-4 py-2 text-right">Ingreso real</th>
              <th className="px-4 py-2 text-center">Tipo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {/* 2026 */}
            <tr className="bg-gray-100/60">
              <td colSpan={5} className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                2026 — Ene–May Real · Jun–Dic Plan Agresivo
              </td>
            </tr>
            {metas2026.map((m) => {
              const key = `${m.anio}-${String(m.mes).padStart(2, '0')}`;
              const real = ingresosPorMes[key];
              const superaMeta = real != null && real >= m.meta_ingresos;
              const actual = isMesActual(m.mes, m.anio);
              return (
                <tr key={key} className={cn('hover:bg-gray-50', actual && 'bg-sky-50/60 font-semibold')}>
                  <td className="px-4 py-2">
                    {m.label} {actual && <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">← hoy</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{fmtMXNFull(m.meta_ingresos)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={cn('font-mono', m.vs_pe >= 100 ? 'text-green-700 font-bold' : 'text-gray-700')}>
                      {m.vs_pe}%
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {real != null ? (
                      <span className={cn(superaMeta ? 'text-green-700' : 'text-amber-700')}>
                        {fmtMXNFull(real)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <Badge2026 tipo={m.tipo} />
                  </td>
                </tr>
              );
            })}
            {/* Subtotales 2026 */}
            <tr className="bg-gray-100 font-semibold text-sm">
              <td className="px-4 py-2">Real Ene–May</td>
              <td className="px-4 py-2 text-right font-mono">{fmtMXNFull(real2026)}</td>
              <td className="px-4 py-2 text-right text-gray-500">—</td>
              <td colSpan={2} className="px-4 py-2 text-center text-xs text-gray-500">prom. $81K/mes</td>
            </tr>
            <tr className="bg-indigo-50 font-semibold text-sm">
              <td className="px-4 py-2">Plan Jun–Dic</td>
              <td className="px-4 py-2 text-right font-mono text-indigo-800">{fmtMXNFull(plan2026)}</td>
              <td className="px-4 py-2 text-right text-gray-500">—</td>
              <td colSpan={2} className="px-4 py-2 text-center text-xs text-indigo-600">prom. $270K/mes</td>
            </tr>

            {/* 2027 */}
            <tr className="bg-gray-100/60">
              <td colSpan={5} className="px-4 py-1 text-xs font-bold uppercase tracking-wider text-gray-500">
                2027 — Motor en Marcha · Meta anual ~{fmtMXNFull(META_ANUAL_2027)}
              </td>
            </tr>
            {metas2027.map((m) => {
              const key = `${m.anio}-${String(m.mes).padStart(2, '0')}`;
              const real = ingresosPorMes[key];
              const actual = isMesActual(m.mes, m.anio);
              return (
                <tr key={key} className={cn('hover:bg-gray-50', actual && 'bg-sky-50/60 font-semibold')}>
                  <td className="px-4 py-2">{m.label}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtMXNFull(m.meta_ingresos)}</td>
                  <td className="px-4 py-2 text-right font-mono text-green-700 font-bold">{m.vs_pe}%</td>
                  <td className="px-4 py-2 text-right font-mono text-gray-400">
                    {real != null ? fmtMXNFull(real) : '—'}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700">Proyección</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/ventas/MetasTabla.jsx
git commit -m "feat(ventas): tabla de metas mensuales 2026-2027 con comparativo real vs plan"
```

---

## Task 5: PipelineCards – Cotizaciones y prospectos

**Files:**
- Create: `src/components/ventas/PipelineCards.jsx`

- [ ] **Step 5.1: Crear el componente PipelineCards**

```jsx
// src/components/ventas/PipelineCards.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, UserPlus, CheckCircle, Clock, XCircle } from 'lucide-react';
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
 *   prospectos: Array<{estatus?: string}>,
 *   loading: boolean
 * }} props
 */
export default function PipelineCards({ cotizaciones = [], prospectos = [], loading }) {
  // Cotizaciones agrupadas por estatus
  const borradores = cotizaciones.filter(c => c.estatus === 'Borrador');
  const enviadas   = cotizaciones.filter(c => c.estatus === 'Enviada');
  const aprobadas  = cotizaciones.filter(c => c.estatus === 'Aprobada');
  const rechazadas = cotizaciones.filter(c => c.estatus === 'Rechazada');

  const totalPipeline = [...borradores, ...enviadas].reduce((s, c) => s + (Number(c.total) || 0), 0);
  const totalAprobado = aprobadas.reduce((s, c) => s + (Number(c.total) || 0), 0);

  // Prospectos
  const prospectoActivos    = prospectos.filter(p => !['convertido', 'descartado'].includes(p.estatus));
  const prospectoConvertidos = prospectos.filter(p => p.estatus === 'convertido');
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
      {/* Pipeline Cotizaciones */}
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

      {/* Prospectos */}
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

- [ ] **Step 5.2: Commit**

```bash
git add src/components/ventas/PipelineCards.jsx
git commit -m "feat(ventas): PipelineCards con cotizaciones por estatus y prospectos"
```

---

## Task 6: VentasDashboard – Página principal

**Files:**
- Create: `src/pages/VentasDashboard.jsx`

- [ ] **Step 6.1: Crear la página VentasDashboard**

```jsx
// src/pages/VentasDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { getMetaMes, META_ANUAL_2026, fmtMXNFull } from '@/config/ventasMetas';
import KpiHero from '@/components/ventas/KpiHero';
import IngresosChart from '@/components/ventas/IngresosChart';
import MetasTabla from '@/components/ventas/MetasTabla';
import PipelineCards from '@/components/ventas/PipelineCards';

const NOW = new Date();
const MES_ACTUAL  = NOW.getMonth() + 1;
const ANIO_ACTUAL = NOW.getFullYear();

export default function VentasDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ingresosPorMes, setIngresosPorMes] = useState({});
  const [cotizaciones, setCotizaciones]     = useState([]);
  const [prospectos, setProspectos]         = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pagosRes, cotRes, prospRes] = await Promise.all([
        // Pagos/ingresos reales desde finanzas_ingresos (vista sobre proyecto_pagos)
        supabase
          .from('proyecto_pagos')
          .select('monto, fecha_pago')
          .gte('fecha_pago', '2026-01-01'),

        // Cotizaciones activas (excluyendo Historial y Obsoleta)
        supabase
          .from('cotizaciones')
          .select('estatus, total, fecha')
          .not('estatus', 'in', '("Historial","Obsoleta")'),

        // Prospectos no eliminados
        supabase
          .from('prospectos')
          .select('id, estatus')
          .eq('eliminado', false),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (cotRes.error)   throw cotRes.error;
      if (prospRes.error) throw prospRes.error;

      // Agrupar pagos por "YYYY-MM"
      const mapa = {};
      for (const pago of pagosRes.data || []) {
        if (!pago.fecha_pago) continue;
        const key = pago.fecha_pago.slice(0, 7); // "2026-05"
        mapa[key] = (mapa[key] || 0) + Number(pago.monto || 0);
      }
      setIngresosPorMes(mapa);
      setCotizaciones(cotRes.data || []);
      setProspectos(prospRes.data || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al cargar dashboard', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const metaMes   = useMemo(() => getMetaMes(MES_ACTUAL, ANIO_ACTUAL), []);
  const ingresoMes = useMemo(() => {
    const key = `${ANIO_ACTUAL}-${String(MES_ACTUAL).padStart(2, '0')}`;
    return ingresosPorMes[key] ?? 0;
  }, [ingresosPorMes]);

  // Progreso anual 2026
  const totalReal2026 = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k]) => k.startsWith('2026-'))
      .reduce((s, [, v]) => s + v, 0),
    [ingresosPorMes]
  );
  const pctAnual2026 = META_ANUAL_2026 > 0
    ? Math.min(100, Math.round((totalReal2026 / META_ANUAL_2026) * 100))
    : 0;

  return (
    <>
      <Helmet>
        <title>Dashboard Ventas – IIHEMSA Peninsular</title>
      </Helmet>

      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard de Ventas</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Seguimiento de metas · Meta anual 2026: {fmtMXNFull(META_ANUAL_2026)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
        </div>

        {/* Barra de progreso anual 2026 */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Avance anual 2026</p>
            <p className="text-sm font-bold text-gray-900">
              {fmtMXNFull(totalReal2026)} / {fmtMXNFull(META_ANUAL_2026)} · <span className={pctAnual2026 >= 100 ? 'text-green-700' : 'text-blue-700'}>{pctAnual2026}%</span>
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-blue-500 to-indigo-600"
              style={{ width: `${pctAnual2026}%` }}
            />
          </div>
        </div>

        {/* KPI Hero del mes */}
        <KpiHero metaMes={metaMes} ingresoReal={ingresoMes} loading={loading} />

        {/* Gráfica */}
        <IngresosChart ingresosPorMes={ingresosPorMes} anio={2026} />

        {/* Pipeline */}
        <PipelineCards cotizaciones={cotizaciones} prospectos={prospectos} loading={loading} />

        {/* Tabla completa */}
        <MetasTabla ingresosPorMes={ingresosPorMes} />
      </div>
    </>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/pages/VentasDashboard.jsx
git commit -m "feat(ventas): página VentasDashboard con KPIs, chart y tabla de metas"
```

---

## Task 7: Routing y subnav – Conectar todo

**Files:**
- Modify: `src/components/module/ModuleSectionLayouts.jsx` (líneas 75-90)
- Modify: `src/App.jsx` (líneas 132-166)

- [ ] **Step 7.1: Actualizar VentasModuleLayout**

En `src/components/module/ModuleSectionLayouts.jsx`, importar iconos necesarios y reemplazar la función `VentasModuleLayout`:

Agregar al bloque de imports existente:
```js
import { LayoutDashboard } from 'lucide-react'; // agregar a los imports de lucide-react ya existentes
```

Reemplazar la función `VentasModuleLayout` (líneas ~75-90):

```jsx
export function VentasModuleLayout() {
  return (
    <ModuleSubnavLayout
      persistKey="ventas"
      title="Ventas"
      items={[
        { to: '/ventas/dashboard', label: 'Dashboard Ventas', icon: LayoutDashboard, end: true },
        { to: '/ventas/prospectos', label: 'Prospectos', icon: UserPlus },
        { to: '/ventas/clientes',  label: 'Clientes',   icon: Users },
        { to: '/ventas/cotizaciones', label: 'Cotizaciones', icon: FileText },
      ]}
    >
      <Outlet />
    </ModuleSubnavLayout>
  );
}
```

> **Nota**: El ítem `crm` se elimina del subnav. La ruta `/ventas/crm` se mantiene en App.jsx para no romper bookmarks existentes.

- [ ] **Step 7.2: Actualizar rutas en App.jsx**

En `src/App.jsx`, dentro del `<Route path="ventas" element={<VentasModuleLayout />}>`, cambiar:

```jsx
// ANTES (línea ~133):
<Route index element={<Navigate to="clientes" replace />} />

// DESPUÉS:
<Route index element={<Navigate to="dashboard" replace />} />
```

Y agregar la ruta `dashboard` e importar `VentasDashboard`. Al final de los imports de páginas (antes del import de `CRM`):

```js
import VentasDashboard from '@/pages/VentasDashboard';
```

Dentro del bloque de rutas de ventas, agregar después del `<Route index ...>`:

```jsx
<Route path="dashboard" element={<VentasDashboard />} />
```

El bloque completo de ventas debe quedar así:

```jsx
<Route path="ventas" element={<VentasModuleLayout />}>
  <Route index element={<Navigate to="dashboard" replace />} />
  <Route path="dashboard" element={<VentasDashboard />} />
  <Route
    path="clientes"
    element={
      <ProtectedRoute requiredPermission={{ modulo: 'clientes', accion: 'ver' }}>
        <Clientes />
      </ProtectedRoute>
    }
  />
  <Route
    path="cotizaciones"
    element={
      <ProtectedRoute requiredPermission={{ modulo: 'cotizaciones', accion: 'ver' }}>
        <Cotizaciones />
      </ProtectedRoute>
    }
  />
  <Route
    path="prospectos"
    element={
      <ProtectedRoute requiredPermission={{ modulo: 'prospectos', accion: 'ver' }}>
        <Prospectos />
      </ProtectedRoute>
    }
  />
  <Route
    path="crm"
    element={
      <ProtectedRoute requiredPermission={{ modulo: 'prospectos', accion: 'ver' }}>
        <CRM />
      </ProtectedRoute>
    }
  />
</Route>
```

- [ ] **Step 7.3: Build de verificación**

```bash
npm run build
```

Resultado esperado: `✓ built` sin errores. Si hay error de TypeScript o import no encontrado, revisar que todos los archivos estén en las rutas exactas indicadas.

- [ ] **Step 7.4: Commit final**

```bash
git add src/components/module/ModuleSectionLayouts.jsx src/App.jsx
git commit -m "feat(ventas): reordenar subnav y conectar ruta /ventas/dashboard"
```

---

## Task 8: Push y verificación final

- [ ] **Step 8.1: Push a remoto**

```bash
git push origin main
```

- [ ] **Step 8.2: Verificar en browser**

1. Navegar a `/ventas` → debe redirigir a `/ventas/dashboard`
2. Subnav debe mostrar: Dashboard Ventas | Prospectos | Clientes | Cotizaciones
3. Dashboard carga KPI hero del mes actual (mayo 2026 → meta $120,480)
4. Gráfica muestra barras Jan–May con datos reales y meses futuros sin barra
5. Tabla muestra todos los meses 2026-2027 con colores correctos
6. Pipeline cards muestran cotizaciones por estatus y prospectos
7. `/ventas/clientes`, `/ventas/prospectos`, `/ventas/cotizaciones` siguen funcionando normal

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| Reordenar subnav: Dashboard → Prospectos → Clientes → Cotizaciones | Task 7 |
| Meta mensual hardcodeada (plan proporcionado) | Task 1 |
| KPI hero: meta del mes, ingreso real, avance %, PE status | Task 2 |
| Gráfica ingresos reales vs meta | Task 3 |
| Tabla metas 2026-2027 con reales vs plan | Task 4 |
| Pipeline cotizaciones por estatus | Task 5 |
| Resumen prospectos y conversión | Task 5 |
| Página VentasDashboard en `/ventas/dashboard` | Task 6 |
| `/ventas` redirige a dashboard | Task 7 |
| No se rompen rutas existentes | Task 7 (crm route mantenida) |
| Build sin errores | Task 7.3 |
| Push a origin/main | Task 8 |

**Migraciones BD requeridas:** ❌ Ninguna — los datos de metas son constantes JS, los ingresos reales vienen de `proyecto_pagos` (ya existe).
