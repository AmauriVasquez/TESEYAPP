// src/components/ventas/IngresosChart.jsx
import React, { useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts';
import { METAS_VENTAS, PE_MENSUAL, fmtMXN } from '@/config/ventasMetas';

const NOW_MES  = new Date().getMonth() + 1;
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
          />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[10px] text-gray-400">
        Barra azul = por debajo de meta · Barra verde = meta superada · Línea punteada amarilla = Punto de Equilibrio ($250K)
      </p>
    </div>
  );
}
