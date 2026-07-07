import React from 'react';
import { formatDateForPrint } from '@/lib/dateUtils';
import { getBrandingConfig, getMarcaColores } from '@/lib/brandingConfig';
import { getLogoByMarca } from '@/lib/brandLogos';

// Componente SOLO de presentación (sin estado, sin efectos). Se monta oculto y su
// innerHTML se extrae (.estado-cuenta-root) para imprimir el estado de cuenta.
const money = (n) =>
  `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function FormatoEstadoCuenta({ datos }) {
  const { cliente = {}, fechaCorte, marca = 'tesey', branding, proyectos = [], totalAdeudo, sinAdeudos } =
    datos || {};
  const brandingCfg = getBrandingConfig(branding);
  const colores = getMarcaColores(marca);

  const rootStyle = {
    ['--color-primario']: colores.primario,
    ['--color-secundario']: colores.secundario,
    ['--color-acento']: colores.acento,
  };

  const rootClass =
    'estado-cuenta-root w-full max-w-[216mm] bg-white p-8 text-black relative box-border mx-auto flex flex-col';

  const Header = () => (
    <header
      className="flex justify-between items-start pb-3 border-b-4 mb-4"
      style={{ borderBottomColor: 'var(--color-acento)' }}
    >
      <div className="w-48 flex items-center justify-center min-h-[64px]">
        <img
          alt={brandingCfg.nombre}
          className="h-20 w-44 object-contain object-center"
          src={getLogoByMarca(marca)}
        />
      </div>
      <div className="text-right flex-1 pl-8">
        <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-secundario)' }}>
          {brandingCfg.datos?.razonSocial || brandingCfg.nombre}
        </h1>
        <div className="text-[10px] text-gray-500 mt-2 leading-snug">
          <p>{brandingCfg.datos?.direccion}</p>
          {brandingCfg.datos?.direccion2 && <p>{brandingCfg.datos.direccion2}</p>}
          <p>R.F.C. {brandingCfg.datos?.rfc}</p>
        </div>
      </div>
    </header>
  );

  const TituloDatos = () => (
    <div className="mb-4">
      <h2 className="text-xl font-bold uppercase tracking-wide" style={{ color: 'var(--color-primario)' }}>
        Estado de Cuenta
      </h2>
      <div className="grid grid-cols-2 gap-x-6 mt-1 text-xs">
        <div>
          <span className="text-gray-500 font-semibold text-[10px] uppercase block">Cliente:</span>
          <span className="font-bold text-gray-700">{cliente?.nombre || '—'}</span>
          {cliente?.rfc && (
            <>
              <span className="text-gray-500 font-semibold text-[10px] uppercase block mt-1">R.F.C.:</span>
              <span className="font-bold text-gray-700">{cliente.rfc}</span>
            </>
          )}
        </div>
        <div className="text-right">
          <span className="text-gray-500 font-semibold text-[10px] uppercase block">Saldos al:</span>
          <span className="font-bold text-gray-700">{formatDateForPrint(fechaCorte)}</span>
        </div>
      </div>
    </div>
  );

  if (sinAdeudos) {
    return (
      <div className={rootClass} style={rootStyle}>
        <Header />
        <TituloDatos />
        <p className="text-center text-gray-500 py-16">
          Este cliente no tiene trabajos entregados con saldo pendiente.
        </p>
      </div>
    );
  }

  return (
    <div className={rootClass} style={rootStyle}>
      <Header />
      <TituloDatos />

      {/* --- BLOQUE POR PROYECTO --- */}
      {proyectos.map((p) => {
        const { proyecto = {}, cotizacion = {}, total, pagado, saldo, subtotalEntregado, pagos = [], lineas = [] } = p;
        return (
          <div
            key={proyecto.id}
            className="proyecto-bloque pt-3 mt-4 border-t border-gray-200"
            style={{ breakInside: 'avoid' }}
          >
            {/* Subencabezado */}
            <p className="text-sm font-bold text-gray-800 mb-2">
              Cotización {cotizacion?.folio || '—'} · {formatDateForPrint(cotizacion?.fecha)} · Proyecto{' '}
              {proyecto?.folio || '—'}
              {proyecto?.descripcion ? ` — ${proyecto.descripcion}` : ''}
            </p>

            {/* Tabla de líneas (partidas entregadas) */}
            {lineas.length > 0 && (
              <table className="w-full text-[11px] border-collapse mb-2">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200">
                    <th className="py-1 px-2 text-left font-semibold">Partida</th>
                    <th className="py-1 px-2 text-center font-semibold w-24">Cant. entregada</th>
                    <th className="py-1 px-2 text-right font-semibold w-28">Importe (s/IVA)</th>
                    <th className="py-1 px-2 text-center font-semibold w-24">Fecha entrega</th>
                    <th className="py-1 px-2 text-center font-semibold w-28">Firma</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l, j) => (
                    <tr key={j} className="border-b border-gray-100 align-top">
                      <td className="py-1 px-2 text-gray-800">
                        <p className="font-bold">{l.descripcion}</p>
                        {l.observaciones && (
                          <p className="text-[10px] text-gray-500 italic leading-tight">{l.observaciones}</p>
                        )}
                      </td>
                      <td className="py-1 px-2 text-center font-mono">{l.cantidad_entregada}</td>
                      <td className="py-1 px-2 text-right font-mono">{money(l.importe)}</td>
                      <td className="py-1 px-2 text-center text-gray-600">
                        {l.entrega_fecha ? formatDateForPrint(l.entrega_fecha) : '—'}
                      </td>
                      <td className="py-1 px-2 text-center">
                        {l.firma_url ? (
                          <img
                            src={l.firma_url}
                            alt="Firma de recibido"
                            className="max-h-10 mx-auto object-contain bg-white"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-400">Sin firma</span>
                        )}
                        {l.recibe_nombre && (
                          <p className="text-[9px] text-gray-500 leading-tight mt-0.5">{l.recibe_nombre}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Ledger de pagos aplicados */}
            {pagos.length > 0 && (
              <div className="mb-2">
                <span className="text-[10px] uppercase font-semibold text-gray-500 block mb-1">
                  Pagos aplicados:
                </span>
                <ul className="text-[11px] text-gray-700 leading-snug">
                  {pagos.map((pg, k) => (
                    <li key={k}>
                      {formatDateForPrint(pg.fecha_pago)} · {pg.metodo_pago || '—'} · {money(pg.monto)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Renglón de totales del proyecto */}
            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs pt-1">
              <span className="text-gray-600">
                Subtotal entregado (s/IVA): <span className="font-mono text-gray-800">{money(subtotalEntregado)}</span>
              </span>
              <span className="text-gray-600">
                Total (c/IVA): <span className="font-mono text-gray-800">{money(total)}</span>
              </span>
              <span className="text-gray-600">
                Pagado: <span className="font-mono text-gray-800">{money(pagado)}</span>
              </span>
              <span className={Number(saldo) > 0 ? 'font-bold text-amber-700' : 'text-gray-600'}>
                Saldo: <span className="font-mono">{money(saldo)}</span>
              </span>
            </div>
          </div>
        );
      })}

      {/* --- TOTAL GENERAL --- */}
      <div className="mt-5 pt-3 border-t-2 border-gray-200 text-right">
        <span className="text-sm font-bold uppercase tracking-wide text-gray-600">Adeudo total del cliente: </span>
        <span className="text-lg font-bold" style={{ color: 'var(--color-primario)' }}>
          {money(totalAdeudo)}
        </span>
      </div>

      {/* --- PIE SOBRIO --- */}
      <footer className="mt-auto pt-3 border-t-2 border-gray-100">
        <p className="text-[9px] text-gray-500 text-center leading-snug">
          Estado de cuenta informativo. Saldos según pagos registrados a la fecha de corte. Las firmas
          corresponden a los acuses de entrega registrados digitalmente en sitio.
        </p>
      </footer>
    </div>
  );
}
