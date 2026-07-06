import React from 'react';
import { formatDateForPrint } from '@/lib/dateUtils';
import { getBrandingConfig, getMarcaColores } from '@/lib/brandingConfig';
import { getLogoByMarca } from '@/lib/brandLogos';

// Componente SOLO de presentación (sin estado, sin efectos). Se monta oculto y su
// innerHTML se concatena tras la cotización para imprimir el anexo de entrega.
export default function FormatoReporteEntrega({ datos }) {
  const { cotizacion = {}, entregas = [], reconciliacion = {}, proyecto = {}, sinEntregas } = datos || {};
  const marca = cotizacion?.marca_comercial || cotizacion?.branding || 'tesey';
  const branding = getBrandingConfig(cotizacion?.branding);
  const colores = getMarcaColores(marca);

  const nombreCliente =
    cotizacion?.cliente?.nombre || cotizacion?.cliente_nombre_externo || 'Cliente General';
  const hoy = formatDateForPrint(new Date().toISOString());

  const horaEntrega = (fecha) => {
    try {
      return new Date(fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const rootStyle = {
    ['--color-primario']: colores.primario,
    ['--color-secundario']: colores.secundario,
    ['--color-acento']: colores.acento,
  };

  const rootClass =
    'report-entrega-root w-full max-w-[216mm] bg-white p-8 text-black relative box-border mx-auto flex flex-col';

  if (sinEntregas) {
    return (
      <div className={rootClass} style={rootStyle}>
        <p className="text-center text-gray-500 py-16">
          Este proyecto no tiene entregas registradas en el sistema actual.
        </p>
      </div>
    );
  }

  const { partidas = [], partidasTotales = 0, partidasCompletas = 0, hayPendiente = false } =
    reconciliacion;

  return (
    <div className={rootClass} style={rootStyle}>
      {/* --- ENCABEZADO --- */}
      <header
        className="flex justify-between items-start pb-3 border-b-4 mb-4"
        style={{ borderBottomColor: 'var(--color-acento)' }}
      >
        <div className="w-48 flex items-center justify-center min-h-[64px]">
          <img
            alt={branding.nombre}
            className="h-20 w-44 object-contain object-center"
            src={getLogoByMarca(marca)}
          />
        </div>
        <div className="text-right flex-1 pl-8">
          <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-secundario)' }}>
            {branding.datos?.razonSocial || branding.nombre}
          </h1>
          <div className="text-[10px] text-gray-500 mt-2 leading-snug">
            <p>{branding.datos?.direccion}</p>
            {branding.datos?.direccion2 && <p>{branding.datos.direccion2}</p>}
            <p>R.F.C. {branding.datos?.rfc}</p>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            <p className="font-medium text-gray-800">Fecha de emisión: {hoy}</p>
          </div>
        </div>
      </header>

      {/* --- TÍTULO + DATOS --- */}
      <div className="mb-3">
        <h2
          className="text-xl font-bold uppercase tracking-wide"
          style={{ color: 'var(--color-primario)' }}
        >
          Reporte de Entrega
        </h2>
        <div className="grid grid-cols-2 gap-x-6 mt-1 text-xs">
          <div>
            <span className="text-gray-500 font-semibold text-[10px] uppercase block">Cliente:</span>
            <span className="font-bold text-gray-700">{nombreCliente}</span>
          </div>
          <div className="text-right">
            <span className="text-gray-500 font-semibold text-[10px] uppercase block">Folio cotización:</span>
            <span className="font-bold text-gray-700">{cotizacion?.folio || '—'}</span>
            {(proyecto?.folio || proyecto?.descripcion) && (
              <>
                <span className="text-gray-500 font-semibold text-[10px] uppercase block mt-1">Proyecto:</span>
                <span className="font-bold text-gray-700">
                  {[proyecto?.folio, proyecto?.descripcion].filter(Boolean).join(' — ')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* --- RECONCILIACIÓN (pedido vs entregado) --- */}
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Estado de la entrega
          </span>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              hayPendiente ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {hayPendiente ? 'PARCIAL' : 'COMPLETO'}
          </span>
          <span className="text-sm text-gray-600">
            {partidasCompletas} de {partidasTotales} partidas entregadas
          </span>
        </div>
        {partidas.length > 0 && (
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-gray-500 border-b-2 border-gray-200">
                <th className="py-1 px-2 text-left font-semibold">Partida</th>
                <th className="py-1 px-2 text-center font-semibold w-16">Pedido</th>
                <th className="py-1 px-2 text-center font-semibold w-16">Entreg.</th>
                <th className="py-1 px-2 text-center font-semibold w-16">Pend.</th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p, i) => {
                const pend = Number(p.pendiente);
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 px-2 text-gray-700">{p.descripcion}</td>
                    <td className="py-1 px-2 text-center font-mono text-gray-500">{p.total}</td>
                    <td className="py-1 px-2 text-center font-mono text-gray-700">{p.entregado}</td>
                    <td
                      className={`py-1 px-2 text-center font-mono ${
                        pend > 0 ? 'font-bold text-amber-700' : 'text-gray-300'
                      }`}
                    >
                      {pend}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* --- BLOQUE POR ENTREGA --- */}
      {entregas.map((e, idx) => (
        <div
          key={e.id}
          className="entrega-bloque pt-3 mt-4 border-t border-gray-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="text-sm font-bold text-gray-800">
              Entrega #{idx + 1} — {formatDateForPrint(e.fecha)} {horaEntrega(e.fecha)}
            </span>
            <span className="text-xs text-gray-600">
              Recibió: <span className="font-semibold text-gray-800">{e.recibe_nombre || '—'}</span>
            </span>
          </div>

          {e.items.length > 0 && (
            <table className="w-full text-[11px] border-collapse mb-2">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200">
                  <th className="py-1 px-2 text-left font-semibold">Descripción</th>
                  <th className="py-1 px-2 text-center font-semibold w-24">Cant. entregada</th>
                  <th className="py-1 px-2 text-center font-semibold w-16">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {e.items.map((it, j) => (
                  <tr key={j} className="border-b border-gray-100 align-top">
                    <td className="py-1 px-2 text-gray-800">
                      <p className="font-bold">{it.descripcion}</p>
                      {it.observaciones && (
                        <p className="text-[10px] text-gray-500 italic leading-tight">{it.observaciones}</p>
                      )}
                    </td>
                    <td className="py-1 px-2 text-center font-mono">{it.cantidad_entregada}</td>
                    <td className="py-1 px-2 text-center uppercase text-gray-500">{it.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {e.comentarios && (
            <p className="text-xs text-gray-600 italic mb-2">Comentarios: {e.comentarios}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">
                Evidencia
              </span>
              {e.foto_url ? (
                <img
                  src={e.foto_url}
                  alt="Evidencia de entrega"
                  className="max-h-56 w-full object-contain border border-gray-200 rounded"
                />
              ) : (
                <div className="h-24 flex items-center justify-center border border-dashed border-gray-300 rounded text-[10px] text-gray-400">
                  Sin foto
                </div>
              )}
            </div>
            <div className="text-center">
              <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">
                Firma de recibido
              </span>
              {e.firma_url ? (
                <img
                  src={e.firma_url}
                  alt="Firma de recibido"
                  className="max-h-56 w-full object-contain border border-gray-200 rounded bg-white"
                />
              ) : (
                <div className="h-24 flex items-center justify-center border border-dashed border-gray-300 rounded text-[10px] text-gray-400">
                  Sin firma
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* --- PIE LEGAL SOBRIO --- */}
      <footer className="mt-auto pt-3 border-t-2 border-gray-100">
        <p className="text-[9px] text-gray-500 text-center leading-snug">
          Acuse de recibido firmado digitalmente en sitio. Cada firma corresponde a la fecha y hora
          indicadas en su entrega.
        </p>
      </footer>
    </div>
  );
}
