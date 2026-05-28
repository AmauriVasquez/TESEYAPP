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
