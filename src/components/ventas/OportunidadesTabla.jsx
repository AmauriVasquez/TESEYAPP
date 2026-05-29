// src/components/ventas/OportunidadesTabla.jsx
import React, { useMemo } from 'react';

const ESTATUS_STYLE = {
  Borrador: { color: '#6B7280', bg: '#F3F4F6' },
  Enviada:  { color: '#2563EB', bg: '#EFF6FF' },
  Aprobada: { color: '#16A34A', bg: '#F0FDF4' },
};

const MARCA_STYLE = {
  tesey: { label: 'TESEY', color: '#16A34A' },
  kutra: { label: 'KUTRA', color: '#2563EB' },
  arkeo: { label: 'ARKEO', color: '#D97706' },
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
      .filter(c => ['Borrador', 'Enviada'].includes(c.estatus))
      .sort((a, b) => (b.total || 0) - (a.total || 0)),
    [cotizaciones]
  );

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Oportunidades activas</h3>
        <span className="text-xs text-gray-400">{activas.length} cotizaciones</span>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : activas.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-gray-400">No hay oportunidades activas</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[28rem]">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-50">
                {['Cliente', 'Folio', 'Monto', 'Estatus', 'Marca', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activas.map((c, i) => {
                const estStyle   = ESTATUS_STYLE[c.estatus] || ESTATUS_STYLE.Borrador;
                const marcaStyle = MARCA_STYLE[c.marca_comercial] || {
                  label: c.marca_comercial?.toUpperCase() || '—',
                  color: '#6B7280',
                };
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ borderBottom: i < activas.length - 1 ? '1px solid #F9FAFB' : 'none' }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{c.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{c.folio || `#${c.id}`}</td>
                    <td className="px-4 py-3 font-semibold font-mono text-gray-900">{fmtMXN(c.total)}</td>
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
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtFecha(c.fecha)}</td>
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
