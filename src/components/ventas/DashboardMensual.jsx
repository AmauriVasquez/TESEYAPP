// src/components/ventas/DashboardMensual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getMetaMes, PE_MENSUAL, fmtMXNFull } from '@/config/ventasMetas';
import FunnelComercial from '@/components/ventas/FunnelComercial';
import MarcaCards from '@/components/ventas/MarcaCards';
import OportunidadesTabla from '@/components/ventas/OportunidadesTabla';

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

function MensualKpiCard({ label, value, sub, progress, progressColor, delay, loading }) {
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
      {progress != null && (
        <div className="mt-1 space-y-1">
          <div className="h-1.5 w-full rounded-full" style={{ background: DARK.border }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, progress)}%`, background: progressColor || DARK.primary }} />
          </div>
          <p className="text-[10px]" style={{ color: DARK.muted }}>{Math.min(100, progress)}% del objetivo</p>
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

  const meta = metaMes?.meta_ingresos ?? 0;
  const pctMeta = meta > 0 ? Math.min(100, Math.round((ingresoMes / meta) * 100)) : 0;
  const progressColor = ingresoMes >= meta ? DARK.success : pctMeta >= 50 ? DARK.primary : DARK.warning;

  // Cotizaciones activas (Borrador + Enviada)
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
