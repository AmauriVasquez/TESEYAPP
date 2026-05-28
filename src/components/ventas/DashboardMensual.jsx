// src/components/ventas/DashboardMensual.jsx
import React, { useMemo } from 'react';
import { getMetaMes } from '@/config/ventasMetas';
import KpiHero from '@/components/ventas/KpiHero';
import MetaMesCard from '@/components/ventas/MetaMesCard';
import TendenciaChart from '@/components/ventas/TendenciaChart';
import PipelineCards from '@/components/ventas/PipelineCards';

/**
 * Contenido del tab Mensual del Dashboard de Ventas.
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
