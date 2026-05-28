// src/components/ventas/MarcaCards.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const MARCAS = [
  { id: 'tesey', nombre: 'TESEY', accent: '#35C759' },
  { id: 'kutra', nombre: 'KUTRA', accent: '#4F8CFF' },
  { id: 'arkeo', nombre: 'ARKEO', accent: '#FFB547' },
];

function fmtK(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * @param {{
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string, fecha?: string}>,
 *   loading: boolean,
 *   mes?: number,
 *   anio?: number,
 * }} props
 * Si mes/anio se proveen, filtra cotizaciones por mes (modo mensual).
 */
export default function MarcaCards({ cotizaciones = [], loading, mes, anio }) {
  const stats = useMemo(() => {
    let cots = cotizaciones;
    if (mes != null && anio != null) {
      const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
      cots = cotizaciones.filter(c => c.fecha && c.fecha.startsWith(prefix));
    }

    const totalValor = cots.reduce((s, c) => s + (Number(c.total) || 0), 0) || 1;

    return MARCAS.map(m => {
      const propias    = cots.filter(c => c.marca_comercial === m.id);
      const aprobadas  = propias.filter(c => c.estatus === 'Aprobada');
      const activas    = propias.filter(c => ['Borrador', 'Enviada'].includes(c.estatus));
      const valorMarca = propias.reduce((s, c) => s + (Number(c.total) || 0), 0);
      const pct        = Math.round((valorMarca / totalValor) * 100);
      return { ...m, aprobadas: aprobadas.length, activas: activas.length, valor: valorMarca, pct, total: propias.length };
    });
  }, [cotizaciones, mes, anio]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MARCAS.map(m => (
          <div key={m.id} className="h-40 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stats.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.3 }}
          className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: m.accent }} />
              <span className="text-sm font-bold text-gray-900 tracking-wider">{m.nombre}</span>
            </div>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${m.accent}18`, color: m.accent }}
            >
              {m.pct}%
            </span>
          </div>

          {/* Valor */}
          <div>
            <p className="text-2xl font-bold text-gray-900">{fmtK(m.valor)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Valor en cotizaciones</p>
          </div>

          {/* Stats */}
          <div className="flex gap-5">
            <div>
              <p className="text-sm font-semibold text-green-600">{m.aprobadas}</p>
              <p className="text-xs text-gray-400">Aprobadas</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-600">{m.activas}</p>
              <p className="text-xs text-gray-400">Activas</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-500">{m.total}</p>
              <p className="text-xs text-gray-400">Total</p>
            </div>
          </div>

          {/* Barra de participación */}
          <div className="h-1.5 w-full rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${m.pct}%`, background: m.accent }}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
