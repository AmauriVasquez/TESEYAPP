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
 * Velocímetro semicircular que muestra ventas reales vs meta anual.
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
      <div
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center gap-4"
        style={{ minHeight: 240 }}
      >
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
