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
 * Contenido del tab Anual del Dashboard de Ventas.
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
          value={fmtMXNFull(pipelineVal)}
          sub="Cotizaciones activas"
          color="blue"
          delay={0.1}
          loading={loading}
        />
        <StatCard
          icon={CheckCircle}
          label="Cotizaciones aprobadas"
          value={aprobadas.length}
          sub={fmtMXNFull(aprobadas.reduce((s, c) => s + (Number(c.total) || 0), 0))}
          color="green"
          delay={0.15}
          loading={loading}
        />
        <StatCard
          icon={Users}
          label="Prospectos activos"
          value={activos.length}
          sub="En proceso de conversión"
          color="purple"
          delay={0.2}
          loading={loading}
        />
        <StatCard
          icon={TrendingUp}
          label="Tasa de conversión"
          value={`${convPct}%`}
          sub={`${convertidos.length} convertidos de ${prospectos.length}`}
          color="indigo"
          delay={0.25}
          loading={loading}
        />
      </div>
    </div>
  );
}
