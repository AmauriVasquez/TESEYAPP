// src/components/ventas/FunnelComercial.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const ETAPAS = [
  { id: 'nuevo',             label: 'Prospectos',  color: '#4F8CFF' },
  { id: 'contactado',        label: 'Contactados', color: '#8B7CF8' },
  { id: 'propuesta_enviada', label: 'Propuesta',   color: '#FFB547' },
  { id: 'en_negociacion',    label: 'Negociación', color: '#FF8547' },
  { id: 'convertido',        label: 'Convertidos', color: '#35C759' },
];

/**
 * @param {{
 *   prospectos: Array<{etapa: string}>,
 *   loading: boolean,
 * }} props
 */
export default function FunnelComercial({ prospectos = [], loading }) {
  const data = useMemo(() => {
    return ETAPAS.map(e => ({
      ...e,
      count: prospectos.filter(p => p.etapa === e.id).length,
    }));
  }, [prospectos]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  if (loading) {
    return (
      <div className="rounded-xl p-6 animate-pulse"
        style={{ background: '#171A21', border: '1px solid #262B36', height: 160 }} />
    );
  }

  return (
    <div className="rounded-xl p-5 space-y-4"
      style={{ background: '#171A21', border: '1px solid #262B36' }}>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#E8EDF5' }}>
          Funnel Comercial
        </h3>
        <span className="text-xs" style={{ color: '#8892A4' }}>
          {prospectos.filter(p => p.etapa !== 'descartado').length} prospectos activos
        </span>
      </div>

      {/* Funnel bars */}
      <div className="space-y-2.5">
        {data.map((e, i) => {
          const widthPct = maxCount > 0 ? Math.max(15, Math.round((e.count / maxCount) * 100)) : 15;
          const prevCount = i > 0 ? data[i - 1].count : e.count;
          const convPct = prevCount > 0 && i > 0
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
              {/* Label */}
              <div className="w-24 shrink-0">
                <p className="text-xs font-medium" style={{ color: '#E8EDF5' }}>{e.label}</p>
                {convPct !== null && (
                  <p className="text-[10px]" style={{ color: '#8892A4' }}>
                    {convPct}% conv.
                  </p>
                )}
              </div>

              {/* Bar + count */}
              <div className="flex flex-1 items-center gap-3">
                <div className="flex-1 h-8 rounded-md overflow-hidden"
                  style={{ background: '#262B36' }}>
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
                <span className="w-6 text-right text-sm font-bold shrink-0"
                  style={{ color: e.color }}>
                  {e.count}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex gap-6 pt-1 border-t" style={{ borderColor: '#262B36' }}>
        <div>
          <p className="text-xs" style={{ color: '#8892A4' }}>Tasa global</p>
          <p className="text-sm font-bold" style={{ color: '#35C759' }}>
            {prospectos.length > 0
              ? `${Math.round((data[4].count / prospectos.length) * 100)}%`
              : '—'
            }
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: '#8892A4' }}>Descartados</p>
          <p className="text-sm font-bold" style={{ color: '#FF5C5C' }}>
            {prospectos.filter(p => p.etapa === 'descartado').length}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: '#8892A4' }}>Total en CRM</p>
          <p className="text-sm font-bold" style={{ color: '#E8EDF5' }}>
            {prospectos.length}
          </p>
        </div>
      </div>
    </div>
  );
}
