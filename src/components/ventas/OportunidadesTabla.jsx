// src/components/ventas/OportunidadesTabla.jsx
import React, { useMemo } from 'react';

const ESTATUS_STYLE = {
  Borrador: { color: '#8892A4', bg: '#8892A420' },
  Enviada:  { color: '#4F8CFF', bg: '#4F8CFF20' },
  Aprobada: { color: '#35C759', bg: '#35C75920' },
};

const MARCA_STYLE = {
  tesey: { label: 'TESEY', color: '#35C759' },
  kutra: { label: 'KUTRA', color: '#4F8CFF' },
  arkeo: { label: 'ARKEO', color: '#FFB547' },
};

function fmtMXN(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function fmtFecha(str) {
  if (!str) return '—';
  try {
    return new Date(str + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: '2-digit',
    });
  } catch { return str; }
}

/**
 * @param {{
 *   cotizaciones: Array<{
 *     id: number, folio: string, estatus: string, total: number,
 *     fecha: string, marca_comercial: string, cliente_nombre: string
 *   }>,
 *   loading: boolean,
 * }} props
 */
export default function OportunidadesTabla({ cotizaciones = [], loading }) {
  const activas = useMemo(() =>
    cotizaciones
      .filter(c => ['Borrador', 'Enviada', 'Aprobada'].includes(c.estatus))
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 10),
    [cotizaciones]
  );

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: '#171A21', border: '1px solid #262B36' }}>

      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid #262B36' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#E8EDF5' }}>
          Oportunidades activas
        </h3>
        <span className="text-xs" style={{ color: '#8892A4' }}>
          {activas.length} cotizaciones
        </span>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded animate-pulse"
              style={{ background: '#262B36' }} />
          ))}
        </div>
      ) : activas.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm" style={{ color: '#8892A4' }}>
            No hay oportunidades activas
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #262B36' }}>
                {['Cliente', 'Folio', 'Monto', 'Estatus', 'Marca', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: '#8892A4' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activas.map((c, i) => {
                const estStyle  = ESTATUS_STYLE[c.estatus] || ESTATUS_STYLE.Borrador;
                const marcaStyle = MARCA_STYLE[c.marca_comercial] || { label: c.marca_comercial?.toUpperCase() || '—', color: '#8892A4' };
                return (
                  <tr key={c.id}
                    className="transition-colors"
                    style={{
                      borderBottom: i < activas.length - 1 ? '1px solid #262B36' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1E2330'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: '#E8EDF5' }}>
                      {c.cliente_nombre || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8892A4' }}>
                      {c.folio || `#${c.id}`}
                    </td>
                    <td className="px-4 py-3 font-semibold font-mono" style={{ color: '#E8EDF5' }}>
                      {fmtMXN(c.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: estStyle.bg, color: estStyle.color }}>
                        {c.estatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold" style={{ color: marcaStyle.color }}>
                        {marcaStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8892A4' }}>
                      {fmtFecha(c.fecha)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
