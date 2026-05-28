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
