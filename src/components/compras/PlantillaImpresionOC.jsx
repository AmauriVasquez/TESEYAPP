import React, { useState, useMemo, useEffect } from 'react';
import { getLogoByMarca } from '@/lib/brandLogos';

// ---------------------------------------------------------------------------
// INYECCIÓN DE ESTILOS Y FUENTES (CRÍTICO)
// ---------------------------------------------------------------------------
const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Segoe+UI:wght@400;600;700&display=swap');
  .theme-tesey { font-family: 'Inter', sans-serif; }
  .theme-iihem { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
  
  @media print {
    /* 1. Ocultar el esqueleto de la app original para no generar hojas fantasma */
    #root, #__next, main { display: none !important; }

    /* 2. Colapsar body y html */
    html, body {
        height: auto !important;
        min-height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        background-color: white !important;
    }
    
    /* 3. X-Ray: Ocultar el resto de la interfaz */
    body * { visibility: hidden; }
    
    /* 4. Hacer visible SOLO la orden de compra */
    .print-container, .print-container * { visibility: visible; }
    
    /* 5. Posicionar la hoja y dejar que la altura fluya naturalmente (Auto) */
    .print-container {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        height: auto !important; 
        margin: 0 !important;
        padding: 10mm 10mm 0 10mm !important; 
        box-shadow: none !important;
        border: none !important;
        display: block !important; /* Estructura de bloque clásica, NO flex */
    }
    
    /* 6. Anular transformaciones de Shadcn/Radix */
    [role="dialog"], [data-radix-popper-content-wrapper] {
        position: static !important;
        transform: none !important;
        padding: 0 !important;
        margin: 0 !important;
        min-height: 0 !important;
    }

    /* 7. Eliminar botones */
    .no-print, .no-print * {
        display: none !important;
        visibility: hidden !important;
        height: 0 !important;
    }

    /* 8. Paginación segura: Repetir encabezados de tabla en cada página nueva */
    thead { display: table-header-group !important; }
    
    /* 9. Paginación segura: Evitar partir filas a la mitad */
    tr, .avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
    }

    /* 10. Paginación segura: Permitir que la tabla salte de página */
    table { page-break-inside: auto !important; }
    
    @page { size: letter; margin: 0; }
  }
`;

const toCurrency = (num) => '$' + Number(num || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTESEY = (dateString) => {
  const d = dateString ? new Date(dateString) : null;
  if (!d || isNaN(d.getTime())) return dateString ?? '--';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const formatDateIIHEM = (dateString) => {
  const d = dateString ? new Date(dateString) : null;
  if (!d || isNaN(d.getTime())) return dateString ?? '--';
  const month = d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
  return `${d.getDate()} de ${month.charAt(0).toUpperCase() + month.slice(1)}, ${d.getFullYear()}`;
};

/** Normaliza data: soporta data.items (Supabase/API) y data.partidas (OrdenesCompraTab). */
function useNormalizedData(data) {
  return useMemo(() => {
    if (!data) return { items: [], data: null };
    const rawItems = data.items ?? data.partidas ?? [];
    const items = Array.isArray(rawItems)
      ? rawItems.map((p) => ({
          clave: p.clave ?? '--',
          descripcion: p.descripcion ?? p.concepto ?? '--',
          notas: p.notas ?? p.observaciones ?? '',
          cantidad: Number(p.cantidad) || 0,
          unidad: p.unidad ?? p.unid ?? '--',
          precio_unitario: Number(p.precio_unitario ?? p.valor_unitario ?? p.pUnitario) || 0,
        }))
      : [];
    return { items, data };
  }, [data]);
}

/** Cálculo de totales en tiempo real a partir de items y data. */
function useTotales(normalized) {
  const { items, data } = normalized;
  return useMemo(() => {
    const subtotal = items.reduce((s, item) => {
      const cant = parseFloat(item.cantidad || 0);
      const pUnit = parseFloat(item.precio_unitario || 0);
      const dscp = parseFloat(item.descuento || 0);
      const pUnitNeto = pUnit * (1 - dscp / 100);
      return s + cant * pUnitNeto;
    }, 0);
    const tasaIva = parseFloat(data?.tasa_iva ?? data?.iva_pct ?? 16) || 16;
    const iva = subtotal * (tasaIva / 100);
    const retenciones = Number(data?.retenciones_monto ?? 0) || (Number(data?.retencion_iva ?? 0) + Number(data?.retencion_isr ?? 0)) || 0;
    const total = subtotal + iva - retenciones;
    return { subtotal, iva, retenciones, total, tasaIva };
  }, [items, data]);
}

// ---------------------------------------------------------------------------
// COMPONENTE RAÍZ: inyección de estilos + barra de controles + plantillas
// ---------------------------------------------------------------------------
const PlantillaImpresionOC = ({ data: rawData, format: formatProp, marca: marcaProp, embedded }) => {
  const normalized = useNormalizedData(rawData);
  const { items, data } = normalized;
  const { subtotal, iva, retenciones, total, tasaIva } = useTotales(normalized);

  const empresaFromData = (data?.empresa || 'TESEY').toUpperCase().includes('IIHEM') ? 'IIHEM' : 'TESEY';
  const defaultMarcaFromEmpresa = empresaFromData === 'IIHEM' ? 'iihemsa' : 'iihemsa_peninsular';

  const [marca, setMarca] = useState(() => {
    if (marcaProp != null) return marcaProp;
    if (formatProp != null) return formatProp === 'IIHEM' ? 'iihemsa' : 'iihemsa_peninsular';
    return defaultMarcaFromEmpresa;
  });

  useEffect(() => {
    if (embedded) {
      if (marcaProp != null) setMarca(marcaProp);
      else if (formatProp != null) setMarca(formatProp === 'IIHEM' ? 'iihemsa' : 'iihemsa_peninsular');
      return;
    }
    if (formatProp != null) setMarca(formatProp === 'IIHEM' ? 'iihemsa' : 'iihemsa_peninsular');
    else setMarca(defaultMarcaFromEmpresa);
  }, [embedded, marcaProp, formatProp, defaultMarcaFromEmpresa]);

  const useBlueTemplate = marca === 'iihemsa';
  const logoAlt =
    marca === 'tesey' ? 'TESEY' : marca === 'iihemsa_peninsular' ? 'IIHEMSA Peninsular' : 'IIHEMSA';

  const folioDisplay = data?.folio_oc ?? data?.folio ?? (data?.folio_oc != null ? String(data.folio_oc) : '--');
  const folioTesey = folioDisplay && !String(folioDisplay).startsWith('OC-') ? `OC-${String(folioDisplay).replace(/^OC-?/i, '')}` : (folioDisplay || '--');
  const condicionPago = data?.condicion_pago ?? data?.forma_pago ?? '--';
  const metodoPago = data?.metodo_pago ?? '--';
  const parcialidades = data?.parcialidades ?? [];
  const cuentasBancarias = data?.cuentas_bancarias ?? [];
  const observacionesGenerales = data?.observaciones_generales ?? data?.observaciones ?? '';
  const tieneObservaciones = !!String(observacionesGenerales).trim();

  return (
    <div className="flex flex-col items-center w-full p-4 relative bg-[#f3f4f6] min-h-screen print:bg-white print:p-0">
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Barra de controles: no se imprime (oculta si se usa embebida en diálogo) */}
      {!embedded && (
      <div className="w-full max-w-[215mm] flex justify-between items-center mb-4 no-print bg-white p-3 rounded shadow" id="actionBar">
        <div className="flex items-center gap-3">
          <label className="text-sm font-bold text-gray-700">Previsualizar Formato:</label>
          <select
            id="selectorEmpresa"
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-sm font-semibold focus:outline-none focus:border-blue-500"
          >
            <option value="iihemsa">IIHEMSA</option>
            <option value="iihemsa_peninsular">IIHEMSA Peninsular</option>
            <option value="tesey">TESEY</option>
          </select>
        </div>
        <button type="button" onClick={() => window.print()} className="bg-gray-800 hover:bg-black text-white font-semibold shadow-md transition-all px-4 py-2 rounded-md text-sm">
          Imprimir Documento
        </button>
      </div>
      )}

      {!data ? (
        <div className="w-full max-w-[215mm] bg-white p-8 rounded shadow text-center text-gray-500">No hay datos de OC para mostrar.</div>
      ) : useBlueTemplate ? (
        /* ========== PLANTILLA IIHEM ========== */
        <div id="plantilla_iihem" className="theme-iihem print-container print:block w-full max-w-[215mm] min-h-[279mm] bg-white px-8 py-6 shadow-xl text-black relative box-border mx-auto flex flex-col">
          <header className="flex justify-between items-center mb-4">
            <div className="w-[20%]">
              <img alt={logoAlt} className="h-[78px] w-[100px] object-contain" src={getLogoByMarca(marca)} />
            </div>
            <div className="w-[55%] text-center">
              <h1 className="text-[13px] font-bold text-black leading-tight">Ingeniería e Instalaciones Hidroneumáticas Eléctricas y Montajes SA de CV</h1>
            </div>
            <div className="w-[25%] text-[11px] text-right">
              <div><span className="font-bold">FECHA:</span> <span id="iihem_lblFecha">{formatDateIIHEM(data.fecha)}</span></div>
            </div>
          </header>

          <div className="text-[13px] mb-4"><span className="font-bold">ORDEN DE COMPRA: </span> <span className="font-bold" id="iihem_lblFolio">{folioDisplay || '--'}</span></div>

          <div className="text-[12px] leading-relaxed mb-4">
            <div className="flex">
              <div className="w-1/2"><span className="font-bold">ORDEN DE PEDIDO: </span> <span id="iihem_lblOrdenPedido">{data.proyecto_cuenta ?? data.orden_pedido ?? '--'}</span></div>
              <div className="w-1/2"><span className="font-bold">PROVEEDOR: </span> <span id="iihem_lblProveedor">{data.proveedor ?? '--'}</span></div>
            </div>
            <div className="flex mt-1">
              <div className="w-1/2"><span className="font-bold">OBRA: </span> <span id="iihem_lblObra">{data.obra ?? '--'}</span></div>
              <div className="w-1/2"><span className="font-bold">CLIENTE: </span> <span id="iihem_lblCliente">{data.cliente ?? '--'}</span></div>
            </div>
          </div>

          <div className="flex-grow mb-4">
            <table className="w-full text-[10px] border-collapse border-b border-gray-400">
              <thead>
                <tr className="bg-[#2EB1EF] text-white">
                  <th className="py-2 px-1 border-r border-gray-300 text-center w-[5%] font-bold">PDA.</th>
                  <th className="py-2 px-1 border-r border-gray-300 text-center w-[12%] font-bold">CLAVE</th>
                  <th className="py-2 px-1 border-r border-gray-300 text-left w-[53%] font-bold">DESCRIPCIÓN</th>
                  <th className="py-2 px-1 border-r border-gray-300 text-center w-[8%] font-bold">UNIDAD</th>
                  <th className="py-2 px-1 border-r border-gray-300 text-center w-[7%] font-bold">CANTIDAD</th>
                  <th className="py-2 px-1 border-r border-gray-300 text-center w-[7%] font-bold">VALOR UNITARIO</th>
                  <th className="py-2 px-1 text-center w-[8%] font-bold">IMPORTE</th>
                </tr>
              </thead>
              <tbody id="iihem_tablaItems" className="text-black">
                {items.length === 0 ? (
                  <tr><td colSpan="7" className="py-6 text-center text-gray-400 italic">Sin partidas.</td></tr>
                ) : (
                  items.map((item, index) => {
                    const cant = parseFloat(item.cantidad || 0);
                    const pUnit = parseFloat(item.precio_unitario || 0);
                    const importe = cant * pUnit;
                    return (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-1 px-1 border border-gray-300 text-center">{index + 1}</td>
                        <td className="py-1 px-1 border border-gray-300 text-center">{item.clave}</td>
                        <td className="py-1 px-1 border border-gray-300"><span className="font-bold">{item.descripcion}</span>{item.notas ? <><br /><span className="text-gray-500 italic font-normal">{item.notas}</span></> : null}</td>
                        <td className="py-1 px-1 border border-gray-300 text-center">{item.unidad}</td>
                        <td className="py-1 px-1 border border-gray-300 text-center">{cant}</td>
                        <td className="py-1 px-1 border border-gray-300 text-right">{toCurrency(pUnit)}</td>
                        <td className="py-1 px-1 border border-gray-300 text-right font-bold">{toCurrency(importe)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-start avoid-break mb-4 gap-6">
            <div className="w-3/5 text-[10px]">
              <p className="font-bold mb-1">DATOS DE FACTURACIÓN Y PAGO</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div><span className="font-bold">MÉTODO DE PAGO:</span> <span id="iihem_lblMetodoPago">{metodoPago}</span></div>
                <div><span className="font-bold">USO DE CFDI:</span> <span id="iihem_lblUsoCFDI">{data.uso_cfdi ?? '--'}</span></div>
              </div>
              <div id="iihem_lblCondicionesPago" className="mt-1"><span className="font-bold">CONDICIÓN DE PAGO:</span> {condicionPago}</div>
              <div id="iihem_lblParcialidades" className="mb-3">
                {parcialidades.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-[11px]">
                    {parcialidades.map((p, i) => (
                      <li key={i} className="flex justify-between border-b border-gray-200 border-dashed last:border-0 pb-0.5 pr-4">
                        <span>• {p.concepto} ({p.porcentaje}%)</span>
                        <span className="font-bold">{toCurrency(p.monto)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="font-bold mb-1">CUENTAS BANCARIAS DEL PROVEEDOR</p>
              <div id="iihem_lblDatosBancarios" className="border border-gray-300 p-2 min-h-[40px]">
                {cuentasBancarias.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {cuentasBancarias.map((cta, i) => (
                      <li key={i} className="leading-tight"><strong>{cta.banco}</strong> — Cta: <strong>{cta.cuenta}</strong>, CLABE: <strong>{cta.clabe}</strong></li>
                    ))}
                  </ul>
                ) : (
                  <span className="italic text-gray-400">Sin datos bancarios.</span>
                )}
              </div>
            </div>

            <div className="w-2/5 flex flex-col">
              <table className="w-full text-[11px] border-collapse">
                <tbody>
                  <tr><th className="py-1 px-2 text-right font-bold border-t border-gray-300 w-[50%]">SUBTOTAL:</th><th className="py-1 px-2 text-right font-normal border-t border-gray-300" id="iihem_lblSubtotal">{toCurrency(subtotal)}</th></tr>
                  <tr><th className="py-1 px-2 text-right font-bold w-[50%]">I.V.A.:</th><th className="py-1 px-2 text-right font-normal" id="iihem_lblIva">{toCurrency(iva)}</th></tr>
                  <tr><th className="py-1 px-2 text-right font-bold w-[50%]"><span className="text-[9px]">RETENCIONES</span>:</th><th className="py-1 px-2 text-right font-normal" id="iihem_lblRetenciones">{toCurrency(retenciones)}</th></tr>
                  <tr><th className="py-1.5 px-2 text-right font-bold border-t border-b-2 border-gray-500 w-[50%]">TOTAL</th><th className="py-1.5 px-2 text-right font-bold border border-b-2 border-gray-500" id="iihem_lblTotal">{toCurrency(total)}</th></tr>
                </tbody>
              </table>
              <div className="mt-3 text-[10px] text-right border-t border-gray-300 pt-2">
                <span className="font-bold block mb-0.5">IMPORTE CON LETRA:</span>
                <span className="block italic text-gray-700 leading-tight mb-2" id="iihem_lblImporteLetra">{data.importe_letra ?? '--'}</span>
                <span className="font-bold">DIVISA:</span> <span id="iihem_lblDivisa">{data.moneda ?? 'MXN'}</span>
              </div>
            </div>
          </div>

          <div className="avoid-break mb-4 mt-2">
            <div className="border border-gray-300 w-full min-h-[50px]">
              <div className="bg-gray-100 border-b border-gray-300 py-1 px-2 text-[10px] font-bold text-center">COMENTARIOS</div>
              <div className="p-2 text-[10px] text-justify whitespace-pre-line" id="iihem_lblComentarios">{observacionesGenerales || 'Sin comentarios adicionales.'}</div>
            </div>
          </div>
          <div className="text-[9px] text-justify leading-snug border border-gray-100 p-2 avoid-break mt-auto">
            <p className="font-bold mb-1">CONDICIONES GENERALES DE CONTRATACION</p>
            <p>Las condiciones generales de contratación que constan en la presente orden de compra (&quot;OC&quot;), expedida por la Empresa señalada CLIENTE, consignadas en el presente documento, regirán y serán de obligatorio cumplimiento...</p>
            <p className="mt-1"><strong>1.OBJETO:</strong> EL PROVEEDOR se compromete a entregar/prestar los bienes/servicios señalados en la OC...</p>
          </div>
        </div>
      ) : (
        /* ========== PLANTILLA TESEY ========== */
        <div id="plantilla_tesey" className="theme-tesey print-container print:block w-full max-w-[215mm] min-h-[279mm] bg-white px-10 py-8 shadow-xl text-black relative box-border mx-auto flex flex-col">
          <header className="flex justify-between items-start pb-3 border-b-2 border-orange-600 mb-4">
            <div className="flex items-center gap-4">
              <img alt={logoAlt} className="h-16 w-auto object-contain" src={getLogoByMarca(marca)} onError={(e) => { e.target.src = 'https://via.placeholder.com/200x80?text=IIHEMSA+Peninsular'; }} />
              <div>
                <h1 className="text-sm font-bold text-gray-900 leading-tight">Tecnomaquila y Servicios de Yucatán</h1>
                <div className="text-[10px] font-semibold text-gray-700 mt-1">R.F.C. TSY221213TIA</div>
                <div className="text-[9px] text-gray-500 leading-snug mt-0.5">CALLE 24 # 73-4, RESID. XCANATUN, MÉRIDA, YUC., C.P. 97302</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <h2 className="text-xl font-black text-orange-600 uppercase tracking-widest leading-none mb-2">Orden de Compra</h2>
              <div className="text-xs text-gray-800 text-right">
                <span className="font-bold uppercase text-gray-500 text-[10px]">Folio:</span> <span className="text-red-600 font-black text-base ml-1" id="tesey_lblFolio">{folioTesey}</span><br />
                <span className="font-bold uppercase text-gray-500 text-[10px]">Fecha:</span> <span className="font-semibold ml-1" id="tesey_lblFecha">{formatDateTESEY(data.fecha)}</span>
              </div>
            </div>
          </header>

          <div className="mb-4 text-xs border border-gray-200 rounded-md p-3 bg-white shadow-sm">
            <div className="grid grid-cols-12 gap-x-4 gap-y-2">
              <div className="col-span-8 truncate"><span className="text-gray-500 font-semibold uppercase text-[10px] mr-1">Proveedor:</span> <span className="font-bold text-gray-900" id="tesey_lblProveedor">{data.proveedor ?? '--'}</span></div>
              <div className="col-span-4 text-right truncate"><span className="text-gray-500 font-semibold uppercase text-[10px] mr-1">Comprador:</span> <span className="font-bold text-gray-800" id="tesey_lblComprador">{data.comprador ?? '--'}</span></div>
              <div className="col-span-8 truncate"><span className="text-gray-500 font-semibold uppercase text-[10px] mr-1">Proyecto / Cuenta:</span> <span className="font-bold text-gray-800" id="tesey_lblProyecto">{data.proyecto_cuenta ?? data.orden_pedido ?? '--'}</span></div>
              <div className="col-span-4 text-right truncate"><span className="text-gray-500 font-semibold uppercase text-[10px] mr-1">Solicitante:</span> <span className="font-bold text-gray-800" id="tesey_lblSolicitante">{data.solicitante ?? '--'}</span></div>
              <div className="col-span-12 border-t border-gray-100 pt-2 mt-1 flex justify-between">
                <div className="truncate mr-4"><span className="text-gray-500 font-semibold uppercase text-[10px] mr-1">Descripción:</span> <span className="text-gray-800 font-medium" id="tesey_lblDescripcion">{data.descripcion_pedido ?? data.descripcion ?? '--'}</span></div>
                <div className="shrink-0"><span className="text-gray-500 font-semibold uppercase text-[10px] mr-1">Moneda:</span> <span className="font-bold text-gray-900" id="tesey_lblMoneda">{data.moneda ?? 'MXN'}</span></div>
              </div>
            </div>
          </div>

          <div className="flex-grow">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="py-1.5 px-2 text-center w-8 rounded-tl-md font-bold">#</th>
                  <th className="py-1.5 px-2 text-center w-16 font-bold">Clave</th>
                  <th className="py-1.5 px-2 text-left font-bold">Concepto</th>
                  <th className="py-1.5 px-2 text-center w-14 font-bold">Cant.</th>
                  <th className="py-1.5 px-2 text-center w-14 font-bold">Unid.</th>
                  <th className="py-1.5 px-2 text-right w-[88px] font-bold">P. Unitario</th>
                  <th className="py-1.5 px-2 text-right w-24 rounded-tr-md font-bold">Importe</th>
                </tr>
              </thead>
              <tbody id="tesey_tablaItems" className="text-gray-800 text-[11px]">
                {items.length === 0 ? (
                  <tr><td colSpan="7" className="py-6 text-center text-gray-400 italic">No hay conceptos.</td></tr>
                ) : (
                  items.map((item, index) => {
                    const cant = parseFloat(item.cantidad || 0);
                    const pUnit = parseFloat(item.precio_unitario || 0);
                    const importe = cant * pUnit;
                    return (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-2 px-2 text-center text-gray-500">{index + 1}</td>
                        <td className="py-2 px-2 text-center text-gray-700 font-medium">{item.clave}</td>
                        <td className="py-2 px-2"><span className="font-bold text-gray-900">{item.descripcion}</span>{item.notas ? <div className="text-[10px] text-gray-500 italic mt-0.5">{item.notas}</div> : null}</td>
                        <td className="py-2 px-2 text-center">{cant}</td>
                        <td className="py-2 px-2 text-center text-gray-500">{item.unidad}</td>
                        <td className="py-2 px-2 text-right">{toCurrency(pUnit)}</td>
                        <td className="py-2 px-2 text-right font-bold text-gray-900">{toCurrency(importe)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={`mt-3 bg-gray-50 border border-gray-200 rounded p-3 avoid-break ${!tieneObservaciones ? 'hidden' : ''}`} id="tesey_seccionObservaciones">
            <span className="text-gray-900 font-bold block mb-1 text-[10px] uppercase">Observaciones Especiales</span>
            <p className="text-[11px] text-gray-800 leading-relaxed italic" id="tesey_lblObservacionesGenerales">{observacionesGenerales}</p>
          </div>

          <div className="flex justify-between items-start mt-5 border-t border-gray-200 pt-4 gap-6 avoid-break">
            <div className="flex-1 text-xs text-gray-800 leading-relaxed">
              <p className="font-bold text-gray-900 uppercase tracking-wide text-[10px] mb-1">Pago Acordado:</p>
              <div id="tesey_lblCondicionesPago" className="mb-1 text-[11px]"><span className="font-bold">CONDICIÓN:</span> {condicionPago} / {metodoPago}</div>
              <div id="tesey_lblParcialidades" className="mb-4">
                {parcialidades.length > 0 ? (
                  <ul className="mt-1 space-y-0.5 text-[11px]">
                    {parcialidades.map((p, i) => (
                      <li key={i} className="flex justify-between border-b border-gray-200 border-dashed last:border-0 pb-0.5 pr-4"><span>• {p.concepto} ({p.porcentaje}%)</span><span className="font-bold">{toCurrency(p.monto)}</span></li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className="font-bold text-gray-900 uppercase tracking-wide text-[10px] mb-1">Cuentas Bancarias del Proveedor:</p>
              <div id="tesey_lblDatosBancarios" className="p-2.5 bg-gray-50 border border-gray-200 rounded-md mb-4 text-[11px]">
                {cuentasBancarias.length > 0 ? (
                  <ul className="list-disc pl-4 space-y-1">
                    {cuentasBancarias.map((cta, i) => (
                      <li key={i} className="leading-tight"><strong>{cta.banco}</strong> — Cta: <strong>{cta.cuenta}</strong>, CLABE: <strong>{cta.clabe}</strong></li>
                    ))}
                  </ul>
                ) : (
                  <span className="italic text-gray-400">Sin datos bancarios.</span>
                )}
              </div>
              <p className="font-bold text-gray-900 uppercase tracking-wide text-[10px] mb-1">Términos de la Orden:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-gray-600">
                <li>Facturar a nombre de: Tecnomaquila y Servicios de Yucatán, RFC TSY221213TIA.</li>
                <li>Incluir el número de Folio en su factura y entregar con remisión.</li>
              </ul>
            </div>
            <div className="w-64 bg-gray-50 rounded-lg border border-gray-200 p-4 shadow-sm shrink-0">
              <div className="flex justify-between items-center text-xs mb-1.5"><span className="text-gray-600 font-semibold">Subtotal:</span> <span className="font-medium text-gray-900" id="tesey_lblSubtotal">{toCurrency(subtotal)}</span></div>
              <div className="flex justify-between items-center text-xs mb-1.5"><span className="text-gray-600 font-semibold" id="tesey_lblTextoIva">IVA ({tasaIva}%):</span> <span className="font-medium text-gray-900" id="tesey_lblIva">{toCurrency(iva)}</span></div>
              {retenciones > 0 ? (
                <div id="tesey_contenedorRetenciones" className="mb-1.5 border-b border-gray-200 pb-1.5">
                  <div className="flex justify-between items-center text-[11px] text-red-700"><span className="font-semibold">Retenciones:</span><span className="font-medium">-{toCurrency(retenciones)}</span></div>
                </div>
              ) : (
                <div id="tesey_contenedorRetenciones" className="empty:hidden empty:border-0 empty:pb-0 empty:mb-0" />
              )}
              <div className="flex justify-between items-center pt-2 mt-2"><span className="font-bold text-sm text-gray-900 uppercase">Total:</span> <span className="font-black text-base text-orange-600" id="tesey_lblTotal">{toCurrency(total)}</span></div>
            </div>
          </div>
          <footer className="mt-auto pt-4 mt-6 text-[9px] text-gray-400 text-center border-t border-gray-100">Documento Generado por Sistema de Control IIHEMSA Peninsular</footer>
        </div>
      )}
    </div>
  );
};

export default PlantillaImpresionOC;
export { toCurrency, formatDateTESEY, formatDateIIHEM };
