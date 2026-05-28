// src/components/ventas/DashboardAnual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Area,
} from 'recharts';
import { METAS_VENTAS, META_ANUAL_2026, fmtMXN, fmtMXNFull } from '@/config/ventasMetas';
import MarcaCards from '@/components/ventas/MarcaCards';

const DARK = {
  card:    '#171A21',
  border:  '#262B36',
  muted:   '#8892A4',
  text:    '#E8EDF5',
  primary: '#4F8CFF',
  success: '#35C759',
  warning: '#FFB547',
  danger:  '#FF5C5C',
};

function DarkKpiCard({ label, value, sub, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{ background: DARK.card, border: `1px solid ${DARK.border}` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: DARK.muted }}>
        {label}
      </p>
      {loading
        ? <div className="h-7 w-28 rounded animate-pulse" style={{ background: DARK.border }} />
        : <p className="text-2xl font-bold" style={{ color: DARK.text }}>{value}</p>
      }
      {sub && <p className="text-xs" style={{ color: DARK.muted }}>{sub}</p>}
    </motion.div>
  );
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs space-y-1 shadow-xl"
      style={{ background: '#1E2330', border: `1px solid ${DARK.border}`, color: DARK.text }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
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

  // Totales anuales
  const totalReal = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k]) => k.startsWith(`${anio}-`))
      .reduce((s, [, v]) => s + v, 0),
    [ingresosPorMes, anio]
  );
  const pctAnual = META_ANUAL_2026 > 0
    ? Math.min(100, Math.round((totalReal / META_ANUAL_2026) * 100))
    : 0;

  // Promedio mensual (solo meses con datos)
  const mesesConDatos = useMemo(
    () => Object.entries(ingresosPorMes).filter(([k, v]) => k.startsWith(`${anio}-`) && v > 0).length,
    [ingresosPorMes, anio]
  );
  const promedioMensual = mesesConDatos > 0 ? Math.round(totalReal / mesesConDatos) : 0;

  // Crecimiento vs mes anterior
  const crecimientoMes = useMemo(() => {
    const mesKey  = `${anio}-${String(NOW_MES).padStart(2, '0')}`;
    const prevMes  = NOW_MES === 1 ? 12 : NOW_MES - 1;
    const prevAnio = NOW_MES === 1 ? anio - 1 : anio;
    const prevKey  = `${prevAnio}-${String(prevMes).padStart(2, '0')}`;
    const actual   = ingresosPorMes[mesKey] ?? 0;
    const anterior = ingresosPorMes[prevKey] ?? 0;
    if (anterior === 0) return null;
    return Math.round(((actual - anterior) / anterior) * 100);
  }, [ingresosPorMes, anio, NOW_MES]);

  // Tasa de conversión
  const convertidos = prospectos.filter(p => p.etapa === 'convertido');
  const tasaConv = prospectos.length > 0
    ? Math.round((convertidos.length / prospectos.length) * 100)
    : 0;

  // Data para gráfica anual
  const chartData = useMemo(() =>
    (METAS_VENTAS || [])
      .filter(m => m.anio === anio)
      .map(m => {
        const key = `${m.anio}-${String(m.mes).padStart(2, '0')}`;
        const real = ingresosPorMes[key] ?? null;
        const esPasado = m.mes <= NOW_MES;
        return {
          label: m.label,
          real:  esPasado ? (real ?? 0) : null,
          meta:  m.meta_ingresos,
        };
      }),
    [ingresosPorMes, anio, NOW_MES]
  );

  return (
    <div className="space-y-5">
      {/* ── Fila 1: 4 KPI cards ──────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DarkKpiCard
          label="Ventas acumuladas"
          value={fmtMXNFull(totalReal)}
          sub={`${pctAnual}% de la meta anual`}
          delay={0}
          loading={loading}
        />
        <DarkKpiCard
          label="Promedio mensual"
          value={fmtMXNFull(promedioMensual)}
          sub={`${mesesConDatos} meses con datos`}
          delay={0.07}
          loading={loading}
        />
        <DarkKpiCard
          label="Crecimiento mensual"
          value={crecimientoMes === null ? '—' : `${crecimientoMes > 0 ? '+' : ''}${crecimientoMes}%`}
          sub="vs mes anterior"
          delay={0.14}
          loading={loading}
        />
        <DarkKpiCard
          label="Tasa de conversión"
          value={`${tasaConv}%`}
          sub={`${convertidos.length} de ${prospectos.length} prospectos`}
          delay={0.21}
          loading={loading}
        />
      </div>

      {/* ── Fila 2: Tendencia anual ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl p-5"
        style={{ background: DARK.card, border: `1px solid ${DARK.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: DARK.text }}>
              Tendencia anual {anio}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: DARK.muted }}>
              Ingresos reales vs meta mensual
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: DARK.muted }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: DARK.primary }} />
              Real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ borderTop: '2px dashed #6366f1' }} />
              Meta
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAnual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={DARK.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={DARK.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: DARK.muted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtMXN} tick={{ fontSize: 9, fill: DARK.muted }} width={50} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine y={250000} stroke={DARK.warning} strokeDasharray="5 5"
              label={{ value: 'PE', position: 'insideTopRight', fontSize: 9, fill: DARK.warning }} />
            <Area dataKey="real" name="Ingreso real" stroke={DARK.primary} fill="url(#gradAnual)"
              strokeWidth={2} dot={{ r: 3, fill: DARK.primary }} activeDot={{ r: 4 }} />
            <Line dataKey="meta" name="Meta" stroke="#6366f1" strokeDasharray="4 4"
              strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Fila 3: Cards por marca ───────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <MarcaCards cotizaciones={cotizaciones} loading={loading} />
      </motion.div>
    </div>
  );
}
