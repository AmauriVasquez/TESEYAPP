# Dashboard Ventas – Light Mode + Gauge Anual

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revertir el tema oscuro del Dashboard de Ventas para respetar el diseño light del resto de la app, y reemplazar el KPI "Ventas Acumuladas" con un gauge tipo velocímetro (semicírculo) que muestra el avance vs la meta anual.

**Architecture:** Todos los componentes de ventas vuelven a usar clases Tailwind estándar (`bg-white border border-gray-100 shadow-sm`). Se crea `GaugeAnual.jsx` (nuevo componente con Recharts PieChart semicircular). `DashboardAnual` usa el gauge como pieza principal junto a 3 KPI cards a su derecha. Los demás componentes solo cambian los colores del theme.

**Tech Stack:** React, Recharts (PieChart para gauge), Framer Motion, Tailwind CSS clases estándar.

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/pages/VentasDashboard.jsx` | **Modificar** | Quitar dark wrapper, restaurar layout light con `<Button>` shadcn |
| `src/components/ventas/GaugeAnual.jsx` | **Crear** | Velocímetro semicircular: avance real vs META_ANUAL_2026 |
| `src/components/ventas/DashboardAnual.jsx` | **Modificar** | Reemplazar dark KPIs con KpiCard light + integrar GaugeAnual en row 1 |
| `src/components/ventas/DashboardMensual.jsx` | **Modificar** | Quitar DARK constant, cambiar styles a Tailwind light |
| `src/components/ventas/MarcaCards.jsx` | **Modificar** | Quitar dark background/border, usar `bg-white border-gray-100` |
| `src/components/ventas/FunnelComercial.jsx` | **Modificar** | Quitar dark styles, usar `bg-white border-gray-100` |
| `src/components/ventas/OportunidadesTabla.jsx` | **Modificar** | Quitar dark styles, usar `bg-white border-gray-100` + `hover:bg-gray-50` |

---

## Task 1: Restaurar VentasDashboard – light mode

**Files:**
- Modify: `src/pages/VentasDashboard.jsx`

Cambios vs versión actual:
- Quitar el dark wrapper (`<div style={{ background: '#0F1115' }} className="-m-4 sm:-m-6 lg:-m-8 ...">`)
- Restaurar `<div className="space-y-5">` como contenedor principal
- Volver al header light: `text-gray-900`, `text-gray-500`
- Restaurar `<Button variant="outline" size="sm">` de shadcn (con `import { Button } from '@/components/ui/button'`)
- Tab switcher: `bg-white border shadow-sm` + active tab `bg-blue-600 text-white` + Tailwind cn() para toggle
- Error banner: `border-red-200 bg-red-50 text-red-700`
- Mantener queries expandidas y normalización de `cliente_nombre` de la versión actual
- Mantener `role="tablist"` / `role="tab"` / `aria-selected` por accesibilidad
- Mantener `aria-hidden="true"` en iconos
- Mantener dinámica `ANIO_ACTUAL` en la query de pagos

- [ ] **Step 1.1: Leer el archivo actual**

```bash
# Read src/pages/VentasDashboard.jsx antes de editar
```

- [ ] **Step 1.2: Escribir el archivo completo**

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
          .gte('fecha_pago', `${ANIO_ACTUAL}-01-01`),

        supabase
          .from('cotizaciones')
          .select('id, folio, estatus, total, fecha, marca_comercial, cliente:cliente_id(nombre), cliente_nombre_externo')
          .not('estatus', 'in', '("Historial","Obsoleta")')
          .eq('es_ultima_version', true),

        supabase
          .from('prospectos')
          .select('id, etapa, marca_origen, nombre')
          .eq('eliminado', false),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (cotRes.error)   throw cotRes.error;
      if (prospRes.error) throw prospRes.error;

      const cotNormalizadas = (cotRes.data || []).map(c => ({
        ...c,
        cliente_nombre: c.cliente?.nombre || c.cliente_nombre_externo || 'Sin cliente',
      }));

      const mapa = {};
      for (const pago of pagosRes.data || []) {
        if (!pago.fecha_pago) continue;
        const key = pago.fecha_pago.slice(0, 7);
        mapa[key] = (mapa[key] || 0) + Number(pago.monto || 0);
      }
      setIngresosPorMes(mapa);
      setCotizaciones(cotNormalizadas);
      setProspectos(prospRes.data || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al cargar dashboard', description: err.message });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [toast, ANIO_ACTUAL]);

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
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <RefreshCw className="h-4 w-4" aria-hidden="true" />
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
        <div role="tablist" className="flex rounded-xl border bg-white p-1 shadow-sm w-fit gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'anual'}
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
            role="tab"
            aria-selected={tab === 'mensual'}
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

- [ ] **Step 1.3: Commit**

```bash
git add src/pages/VentasDashboard.jsx
git commit -m "refactor(ventas): restaurar VentasDashboard light mode"
```

---

## Task 2: Crear GaugeAnual – velocímetro ventas vs meta

**Files:**
- Create: `src/components/ventas/GaugeAnual.jsx`

Gauge de semicírculo (∩) usando Recharts `PieChart` con `startAngle=180` y `endAngle=0`. El arco de fondo es gris (`#F3F4F6`), el arco de avance tiene color según porcentaje (rojo < 25%, ámbar < 50%, azul < 75%, verde ≥ 75%). Overlay textual: porcentaje grande centrado en la "boca" del velocímetro, valor real y meta debajo.

- [ ] **Step 2.1: Crear el componente**

```jsx
// src/components/ventas/GaugeAnual.jsx
import React from 'react';
import { PieChart, Pie, Cell } from 'recharts';
import { META_ANUAL_2026, fmtMXNFull } from '@/config/ventasMetas';

function gaugeColor(pct) {
  if (pct >= 75) return '#22C55E'; // green-500
  if (pct >= 50) return '#3B82F6'; // blue-500
  if (pct >= 25) return '#F59E0B'; // amber-500
  return '#EF4444';                 // red-500
}

/**
 * @param {{
 *   totalReal: number,
 *   loading: boolean,
 * }} props
 */
export default function GaugeAnual({ totalReal, loading }) {
  const pctAnual = Math.min(100, Math.round((totalReal / META_ANUAL_2026) * 100));
  const color    = gaugeColor(pctAnual);
  const restante = META_ANUAL_2026 - totalReal;

  // Mínimo 0.5 para que se vea un trazo cuando pct = 0
  const data = [
    { value: pctAnual || 0.5 },
    { value: 100 - pctAnual },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-4"
        style={{ minHeight: 240 }}>
        <div className="w-40 h-24 rounded-t-full bg-gray-100 animate-pulse" />
        <div className="h-5 w-28 rounded bg-gray-100 animate-pulse" />
        <div className="h-3 w-36 rounded bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col items-center">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Ventas Acumuladas {new Date().getFullYear()}
      </p>

      {/* Gauge — semicírculo superior (∩), boca en la parte baja */}
      <div className="relative" style={{ width: 220, height: 125 }}>
        <PieChart width={220} height={125}>
          <Pie
            data={data}
            cx={110}
            cy={115}
            startAngle={180}
            endAngle={0}
            innerRadius={65}
            outerRadius={100}
            paddingAngle={1}
            strokeWidth={0}
            dataKey="value"
            isAnimationActive
            animationBegin={0}
            animationDuration={900}
          >
            <Cell fill={color} />
            <Cell fill="#F3F4F6" />
          </Pie>
        </PieChart>
        {/* Porcentaje centrado en la boca del gauge */}
        <div
          className="absolute flex items-end justify-center pb-1"
          style={{ inset: 0 }}
        >
          <span className="text-3xl font-bold text-gray-900 leading-none">{pctAnual}%</span>
        </div>
      </div>

      {/* Datos debajo */}
      <div className="text-center mt-3 space-y-1 w-full">
        <p className="text-xl font-bold text-gray-900">{fmtMXNFull(totalReal)}</p>
        <p className="text-xs text-gray-400">Meta anual: {fmtMXNFull(META_ANUAL_2026)}</p>
        <p className="text-xs font-semibold" style={{ color }}>
          {restante > 0
            ? `Faltan ${fmtMXNFull(restante)} para la meta`
            : '¡Meta anual superada!'
          }
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/ventas/GaugeAnual.jsx
git commit -m "feat(ventas): GaugeAnual velocímetro semicircular para avance vs meta"
```

---

## Task 3: Actualizar DashboardAnual – light + gauge

**Files:**
- Modify: `src/components/ventas/DashboardAnual.jsx`

Layout nuevo:
- **Fila 1**: `grid-cols-1 md:grid-cols-3` — GaugeAnual (col 1) + 3 KpiCard light (col 2-3 con `md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4`)
- **Fila 2**: Tendencia anual chart con colores light (grid stroke `#E5E7EB`, ticks `#9CA3AF`, área azul, línea índigo)
- **Fila 3**: MarcaCards (sin cambios en props)

Eliminar `const DARK = {...}`, `DarkKpiCard`, `DarkTooltip`. Crear `KpiCard` light con prop `valueColor` opcional.

- [ ] **Step 3.1: Leer el archivo actual**

Leer `src/components/ventas/DashboardAnual.jsx` antes de escribir.

- [ ] **Step 3.2: Escribir el archivo completo**

```jsx
// src/components/ventas/DashboardAnual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area,
} from 'recharts';
import { METAS_VENTAS, META_ANUAL_2026, fmtMXN, fmtMXNFull } from '@/config/ventasMetas';
import MarcaCards from '@/components/ventas/MarcaCards';
import GaugeAnual from '@/components/ventas/GaugeAnual';

/**
 * KPI card genérico, light mode.
 * @param {{ label: string, value: string|number, sub?: string, valueColor?: string, delay?: number, loading: boolean }} props
 */
function KpiCard({ label, value, sub, valueColor, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1.5"
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {loading
        ? <div className="h-7 w-28 rounded bg-gray-100 animate-pulse" />
        : <p className={`text-2xl font-bold ${valueColor || 'text-gray-900'}`}>{value}</p>
      }
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </motion.div>
  );
}

function LightTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-white border border-gray-200 p-3 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtMXN(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string}>,
 *   prospectos: Array<{etapa: string}>,
 *   loading: boolean,
 *   anio: number,
 * }} props
 */
export default function DashboardAnual({ ingresosPorMes, cotizaciones, prospectos, loading, anio }) {
  const NOW_MES = new Date().getMonth() + 1;

  const totalReal = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k]) => k.startsWith(`${anio}-`))
      .reduce((s, [, v]) => s + v, 0),
    [ingresosPorMes, anio]
  );

  const mesesConDatos = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k, v]) => k.startsWith(`${anio}-`) && v > 0).length,
    [ingresosPorMes, anio]
  );
  const promedioMensual = mesesConDatos > 0 ? Math.round(totalReal / mesesConDatos) : 0;

  const crecimientoMes = useMemo(() => {
    const mesKey   = `${anio}-${String(NOW_MES).padStart(2, '0')}`;
    const prevMes  = NOW_MES === 1 ? 12 : NOW_MES - 1;
    const prevAnio = NOW_MES === 1 ? anio - 1 : anio;
    const prevKey  = `${prevAnio}-${String(prevMes).padStart(2, '0')}`;
    const actual   = ingresosPorMes[mesKey] ?? 0;
    const anterior = ingresosPorMes[prevKey] ?? 0;
    if (anterior === 0) return null;
    return Math.round(((actual - anterior) / anterior) * 100);
  }, [ingresosPorMes, anio, NOW_MES]);

  const convertidos = prospectos.filter(p => p.etapa === 'convertido');
  const tasaConv    = prospectos.length > 0
    ? Math.round((convertidos.length / prospectos.length) * 100)
    : 0;

  const crecimientoColor = crecimientoMes === null
    ? 'text-gray-400'
    : crecimientoMes >= 0 ? 'text-green-600' : 'text-red-500';

  const chartData = useMemo(() =>
    (METAS_VENTAS || [])
      .filter(m => m.anio === anio)
      .map(m => {
        const key      = `${m.anio}-${String(m.mes).padStart(2, '0')}`;
        const esPasado = m.mes <= NOW_MES;
        return {
          label: m.label,
          real:  esPasado ? (ingresosPorMes[key] ?? 0) : null,
          meta:  m.meta_ingresos,
        };
      }),
    [ingresosPorMes, anio, NOW_MES]
  );

  return (
    <div className="space-y-5">
      {/* ── Fila 1: Gauge + 3 KPIs ──────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <GaugeAnual totalReal={totalReal} loading={loading} />

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 content-start">
          <KpiCard
            label="Promedio mensual"
            value={fmtMXNFull(promedioMensual)}
            sub={`${mesesConDatos} meses con datos`}
            delay={0.07}
            loading={loading}
          />
          <KpiCard
            label="Crecimiento mensual"
            value={crecimientoMes === null ? '—' : `${crecimientoMes > 0 ? '+' : ''}${crecimientoMes}%`}
            valueColor={crecimientoColor}
            sub="vs mes anterior"
            delay={0.14}
            loading={loading}
          />
          <KpiCard
            label="Tasa de conversión"
            value={`${tasaConv}%`}
            sub={`${convertidos.length} de ${prospectos.length} prospectos`}
            delay={0.21}
            loading={loading}
          />
        </div>
      </div>

      {/* ── Fila 2: Tendencia anual ──────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Tendencia anual {anio}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Ingresos reales vs meta mensual</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-indigo-400" />
              Meta
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAnualLight" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtMXN} tick={{ fontSize: 9, fill: '#9CA3AF' }} width={50} axisLine={false} tickLine={false} />
            <Tooltip content={<LightTooltip />} />
            <ReferenceLine y={250000} stroke="#F59E0B" strokeDasharray="5 5"
              label={{ value: 'PE', position: 'insideTopRight', fontSize: 9, fill: '#F59E0B' }} />
            <Area dataKey="real" name="Ingreso real" stroke="#3B82F6" fill="url(#gradAnualLight)"
              strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 4 }} />
            <Line dataKey="meta" name="Meta" stroke="#6366F1" strokeDasharray="4 4"
              strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Fila 3: Cards por marca ──────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <MarcaCards cotizaciones={cotizaciones} loading={loading} />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 3.3: Commit**

```bash
git add src/components/ventas/DashboardAnual.jsx
git commit -m "refactor(ventas): DashboardAnual light con gauge velocímetro"
```

---

## Task 4: Actualizar DashboardMensual – light mode

**Files:**
- Modify: `src/components/ventas/DashboardMensual.jsx`

Cambios: eliminar `const DARK`, reemplazar todos los `style={{ background: '...' }}` por clases Tailwind equivalentes. `MensualKpiCard` usa `bg-white border-gray-100 shadow-sm`. Barra de progreso con `bg-gray-100` de fondo y colores inline para el fill.

- [ ] **Step 4.1: Leer el archivo actual**

Leer `src/components/ventas/DashboardMensual.jsx` antes de escribir.

- [ ] **Step 4.2: Escribir el archivo completo**

```jsx
// src/components/ventas/DashboardMensual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getMetaMes, PE_MENSUAL, fmtMXNFull } from '@/config/ventasMetas';
import FunnelComercial from '@/components/ventas/FunnelComercial';
import MarcaCards from '@/components/ventas/MarcaCards';
import OportunidadesTabla from '@/components/ventas/OportunidadesTabla';

function MensualKpiCard({ label, value, sub, progress, progressColor, delay, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-1.5"
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {loading
        ? <div className="h-7 w-28 rounded bg-gray-100 animate-pulse" />
        : <p className="text-2xl font-bold text-gray-900">{value}</p>
      }
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {progress != null && (
        <div className="mt-1 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, progress)}%`, background: progressColor || '#3B82F6' }}
            />
          </div>
          <p className="text-[10px] text-gray-400">{Math.min(100, progress)}% del objetivo</p>
        </div>
      )}
    </motion.div>
  );
}

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string, fecha: string, cliente_nombre: string}>,
 *   prospectos: Array<{etapa: string, marca_origen: string}>,
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

  const meta        = metaMes?.meta_ingresos ?? 0;
  const pctMeta     = meta > 0 ? Math.min(100, Math.round((ingresoMes / meta) * 100)) : 0;
  const progressColor = ingresoMes >= meta ? '#22C55E'
    : pctMeta >= 50 ? '#3B82F6'
    : '#F59E0B';

  const activas  = cotizaciones.filter(c => ['Borrador', 'Enviada'].includes(c.estatus));
  const pipeline = cotizaciones
    .filter(c => ['Borrador', 'Enviada', 'Aprobada'].includes(c.estatus))
    .reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-5">
      {/* ── Fila 1: 4 KPIs mensuales ─────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MensualKpiCard
          label="Objetivo del mes"
          value={fmtMXNFull(meta)}
          sub={metaMes ? `${metaMes.vs_pe}% del PE` : '—'}
          progress={pctMeta}
          progressColor={progressColor}
          delay={0}
          loading={false}
        />
        <MensualKpiCard
          label="Ventas del mes"
          value={fmtMXNFull(ingresoMes)}
          sub={`PE: ${fmtMXNFull(PE_MENSUAL)}`}
          delay={0.07}
          loading={loading}
        />
        <MensualKpiCard
          label="Cotizaciones activas"
          value={activas.length}
          sub="Borrador + Enviadas"
          delay={0.14}
          loading={loading}
        />
        <MensualKpiCard
          label="Pipeline monetario"
          value={fmtMXNFull(pipeline)}
          sub="Borrador + Enviadas + Aprobadas"
          delay={0.21}
          loading={loading}
        />
      </div>

      {/* ── Fila 2: Funnel comercial ─────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <FunnelComercial prospectos={prospectos} loading={loading} />
      </motion.div>

      {/* ── Fila 3: Cards por marca (filtradas por mes) ─ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <MarcaCards cotizaciones={cotizaciones} loading={loading} mes={mes} anio={anio} />
      </motion.div>

      {/* ── Fila 4: Tabla oportunidades ──────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <OportunidadesTabla cotizaciones={cotizaciones} loading={loading} />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 4.3: Commit**

```bash
git add src/components/ventas/DashboardMensual.jsx
git commit -m "refactor(ventas): DashboardMensual light mode"
```

---

## Task 5: Actualizar MarcaCards – light mode

**Files:**
- Modify: `src/components/ventas/MarcaCards.jsx`

Cambios: loading skeleton usa `bg-gray-100`. Tarjetas usan `bg-white rounded-xl border border-gray-100 shadow-sm`. Textos con Tailwind (`text-gray-900`, `text-gray-400`). Stats: aprobadas `text-green-600`, activas `text-blue-600`, total `text-gray-500`. Barra de participación con fondo `bg-gray-100`. Badge usa hex con opacidad `${accent}18` (tono muy suave, funciona en light).

- [ ] **Step 5.1: Leer el archivo actual**

Leer `src/components/ventas/MarcaCards.jsx` antes de escribir.

- [ ] **Step 5.2: Escribir el archivo completo**

```jsx
// src/components/ventas/MarcaCards.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const MARCAS = [
  { id: 'tesey', nombre: 'TESEY', accent: '#35C759' },
  { id: 'kutra', nombre: 'KUTRA', accent: '#4F8CFF' },
  { id: 'arkeo', nombre: 'ARKEO', accent: '#FFB547' },
];

function fmtK(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * @param {{
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string, fecha?: string}>,
 *   loading: boolean,
 *   mes?: number,
 *   anio?: number,
 * }} props
 * Si mes/anio se proveen, filtra cotizaciones por mes (modo mensual).
 */
export default function MarcaCards({ cotizaciones = [], loading, mes, anio }) {
  const stats = useMemo(() => {
    let cots = cotizaciones;
    if (mes != null && anio != null) {
      const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
      cots = cotizaciones.filter(c => c.fecha && c.fecha.startsWith(prefix));
    }

    const totalValor = cots.reduce((s, c) => s + (Number(c.total) || 0), 0) || 1;

    return MARCAS.map(m => {
      const propias    = cots.filter(c => c.marca_comercial === m.id);
      const aprobadas  = propias.filter(c => c.estatus === 'Aprobada');
      const activas    = propias.filter(c => ['Borrador', 'Enviada'].includes(c.estatus));
      const valorMarca = propias.reduce((s, c) => s + (Number(c.total) || 0), 0);
      const pct        = Math.round((valorMarca / totalValor) * 100);
      return { ...m, aprobadas: aprobadas.length, activas: activas.length, valor: valorMarca, pct, total: propias.length };
    });
  }, [cotizaciones, mes, anio]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MARCAS.map(m => (
          <div key={m.id} className="h-40 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stats.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.3 }}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: m.accent }} />
              <span className="text-sm font-bold text-gray-900 tracking-wider">{m.nombre}</span>
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${m.accent}18`, color: m.accent }}
            >
              {m.pct}%
            </span>
          </div>

          {/* Valor */}
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmtK(m.valor)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Valor en cotizaciones</p>
          </div>

          {/* Stats */}
          <div className="flex gap-5">
            <div>
              <p className="text-sm font-semibold text-green-600">{m.aprobadas}</p>
              <p className="text-xs text-gray-400">Aprobadas</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600">{m.activas}</p>
              <p className="text-xs text-gray-400">Activas</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">{m.total}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
          </div>

          {/* Barra de participación */}
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${m.pct}%`, background: m.accent }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5.3: Commit**

```bash
git add src/components/ventas/MarcaCards.jsx
git commit -m "refactor(ventas): MarcaCards light mode"
```

---

## Task 6: Actualizar FunnelComercial – light mode

**Files:**
- Modify: `src/components/ventas/FunnelComercial.jsx`

Cambios: contenedor `bg-white rounded-xl border border-gray-100 shadow-sm`. Textos con Tailwind (`text-gray-800`, `text-gray-700`, `text-gray-400`). Barra de fondo `bg-gray-100`. Footer border `border-gray-100`. Tasa global `text-green-600`, descartados `text-red-500`, total `text-gray-700`. Los colores de las barras del funnel se mantienen igual (son datos, no UI).

- [ ] **Step 6.1: Leer el archivo actual**

Leer `src/components/ventas/FunnelComercial.jsx` antes de escribir.

- [ ] **Step 6.2: Escribir el archivo completo**

```jsx
// src/components/ventas/FunnelComercial.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const ETAPAS = [
  { id: 'nuevo',             label: 'Prospectos',  color: '#3B82F6' },
  { id: 'contactado',        label: 'Contactados', color: '#8B5CF6' },
  { id: 'propuesta_enviada', label: 'Propuesta',   color: '#F59E0B' },
  { id: 'en_negociacion',    label: 'Negociación', color: '#EF4444' },
  { id: 'convertido',        label: 'Convertidos', color: '#22C55E' },
];

/**
 * @param {{
 *   prospectos: Array<{etapa: string}>,
 *   loading: boolean,
 * }} props
 */
export default function FunnelComercial({ prospectos = [], loading }) {
  const data = useMemo(() =>
    ETAPAS.map(e => ({
      ...e,
      count: prospectos.filter(p => p.etapa === e.id).length,
    })),
    [prospectos]
  );

  const maxCount = Math.max(...data.map(d => d.count), 1);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse"
        style={{ height: 200 }} />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Funnel Comercial</h3>
        <span className="text-xs text-gray-400">
          {prospectos.filter(p => p.etapa !== 'descartado').length} prospectos activos
        </span>
      </div>

      <div className="space-y-2.5">
        {data.map((e, i) => {
          const widthPct  = Math.max(15, Math.round((e.count / maxCount) * 100));
          const prevCount = i > 0 ? data[i - 1].count : e.count;
          const convPct   = prevCount > 0 && i > 0
            ? Math.round((e.count / prevCount) * 100)
            : null;

          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              <div className="w-24 shrink-0">
                <p className="text-xs font-medium text-gray-700">{e.label}</p>
                {convPct !== null && (
                  <p className="text-[10px] text-gray-400">{convPct}% conv.</p>
                )}
              </div>
              <div className="flex flex-1 items-center gap-3">
                <div className="flex-1 h-8 rounded-md overflow-hidden bg-gray-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-md flex items-center pl-3"
                    style={{ background: e.color }}
                  >
                    <span className="text-xs font-bold text-white">
                      {e.count > 0 ? e.count : ''}
                    </span>
                  </motion.div>
                </div>
                <span className="w-6 text-right text-sm font-bold shrink-0" style={{ color: e.color }}>
                  {e.count}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="flex gap-6 pt-2 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-400">Tasa global</p>
          <p className="text-sm font-bold text-green-600">
            {prospectos.length > 0
              ? `${Math.round((data[4].count / prospectos.length) * 100)}%`
              : '—'
            }
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Descartados</p>
          <p className="text-sm font-bold text-red-500">
            {prospectos.filter(p => p.etapa === 'descartado').length}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Total en CRM</p>
          <p className="text-sm font-bold text-gray-700">{prospectos.length}</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.3: Commit**

```bash
git add src/components/ventas/FunnelComercial.jsx
git commit -m "refactor(ventas): FunnelComercial light mode"
```

---

## Task 7: Actualizar OportunidadesTabla – light mode

**Files:**
- Modify: `src/components/ventas/OportunidadesTabla.jsx`

Cambios: contenedor `bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden`. Header border `border-gray-100`. Títulos con Tailwind. Loading skeleton `bg-gray-100`. Filas con `hover:bg-gray-50 transition-colors` en lugar de handlers inline. Estatus badges: Borrador gris (`#6B7280` / `#F3F4F6`), Enviada azul (`#2563EB` / `#EFF6FF`), Aprobada verde (`#16A34A` / `#F0FDF4`). Marca: tesey verde `#16A34A`, kutra azul `#2563EB`, arkeo ámbar `#D97706`.

- [ ] **Step 7.1: Leer el archivo actual**

Leer `src/components/ventas/OportunidadesTabla.jsx` antes de escribir.

- [ ] **Step 7.2: Escribir el archivo completo**

```jsx
// src/components/ventas/OportunidadesTabla.jsx
import React, { useMemo } from 'react';

const ESTATUS_STYLE = {
  Borrador: { color: '#6B7280', bg: '#F3F4F6' },
  Enviada:  { color: '#2563EB', bg: '#EFF6FF' },
  Aprobada: { color: '#16A34A', bg: '#F0FDF4' },
};

const MARCA_STYLE = {
  tesey: { label: 'TESEY', color: '#16A34A' },
  kutra: { label: 'KUTRA', color: '#2563EB' },
  arkeo: { label: 'ARKEO', color: '#D97706' },
};

function fmtMXN(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function fmtFecha(str) {
  if (!str) return '—';
  try {
    return new Date(str + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: '2-digit',
    });
  } catch { return str; }
}

/**
 * @param {{
 *   cotizaciones: Array<{
 *     id: number, folio: string, estatus: string, total: number,
 *     fecha: string, marca_comercial: string, cliente_nombre: string
 *   }>,
 *   loading: boolean,
 * }} props
 */
export default function OportunidadesTabla({ cotizaciones = [], loading }) {
  const activas = useMemo(() =>
    cotizaciones
      .filter(c => ['Borrador', 'Enviada', 'Aprobada'].includes(c.estatus))
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 10),
    [cotizaciones]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Oportunidades activas</h3>
        <span className="text-xs text-gray-400">{activas.length} cotizaciones</span>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : activas.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-gray-400">No hay oportunidades activas</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-50">
                {['Cliente', 'Folio', 'Monto', 'Estatus', 'Marca', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activas.map((c, i) => {
                const estStyle   = ESTATUS_STYLE[c.estatus] || ESTATUS_STYLE.Borrador;
                const marcaStyle = MARCA_STYLE[c.marca_comercial] || {
                  label: c.marca_comercial?.toUpperCase() || '—',
                  color: '#6B7280',
                };
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < activas.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.folio || `#${c.id}`}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-gray-900">{fmtMXN(c.total)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: estStyle.bg, color: estStyle.color }}>
                        {c.estatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold" style={{ color: marcaStyle.color }}>
                        {marcaStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtFecha(c.fecha)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7.3: Commit**

```bash
git add src/components/ventas/OportunidadesTabla.jsx
git commit -m "refactor(ventas): OportunidadesTabla light mode"
```

---

## Task 8: Build + push

- [ ] **Step 8.1: Build**

```bash
npm run build
```

Resultado esperado: `✓ built` sin errores de código. Las advertencias de CSS (`@import`) y bundle size son pre-existentes.

- [ ] **Step 8.2: Push**

```bash
git push origin main
```

- [ ] **Step 8.3: Verificar en browser**

1. `/ventas/dashboard` → fondo blanco, mismo look que el resto de la app
2. Tab "Anual 2026":
   - Gauge semicircular (velocímetro) a la izquierda, coloreado según % (rojo/ámbar/azul/verde)
   - 3 KPI cards a la derecha (promedio, crecimiento, conversión)
   - Gráfica de tendencia light (fondo blanco, grid gris claro)
   - Cards TESEY / KUTRA / ARKEO con fondo blanco
3. Tab "Mayo 2026": 4 KPIs light + funnel + marcas + tabla, todos blancos
4. No hay errores de consola
5. Sidebar y header no se ven afectados

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| Quitar dark theme en VentasDashboard | Task 1 |
| Gauge velocímetro para ventas acumuladas vs meta | Task 2 |
| DashboardAnual layout con gauge + 3 KPIs | Task 3 |
| DashboardMensual light mode | Task 4 |
| MarcaCards light mode | Task 5 |
| FunnelComercial light mode | Task 6 |
| OportunidadesTabla light mode con hover Tailwind | Task 7 |
| Build + push | Task 8 |
