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
