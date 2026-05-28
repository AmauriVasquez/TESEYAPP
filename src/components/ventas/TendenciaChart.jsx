// src/components/ventas/TendenciaChart.jsx
import React, { useMemo } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { METAS_VENTAS, fmtMXN } from '@/config/ventasMetas';

/**
 * Mini área chart mostrando real + meta de los últimos 6 meses.
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
