import React from 'react';
import { Printer } from 'lucide-react';

import { getLogoByMarca } from '@/lib/brandLogos';

const defaultEmpresaDatos = {
  nombre: 'Tecnomaquila y Servicios de Yucatán',
  rfc: 'TSY221213TIA',
  calle: 'CALLE 24 # 73-4',
  colonia: 'RESID. XCANATUN',
  ciudad: 'MÉRIDA',
  estado: 'YUC.',
  cp: 'C.P. 97302',
  regimen: '626 Régimen Simplificado de Confianza',
};

function formatFecha(value) {
  if (value == null) return '--/--/----';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '--/--/----' : value.toLocaleDateString('es-MX');
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '--/--/----' : d.toLocaleDateString('es-MX');
}

/** Normaliza data para soportar tanto OC de ejemplo (conceptos, empresa_datos) como OC de API (items, proveedores, folio_oc). */
function normalizeData(data) {
  if (!data) return null;
  const empresa = data.empresa_datos || defaultEmpresaDatos;
  let conceptos = data.conceptos;
  if (!conceptos?.length && Array.isArray(data.items)) {
    conceptos = data.items.map((item, idx) => {
      const cant = Number(item.cantidad ?? item.cant) || 0;
      const pUnit = Number(item.precio_unitario ?? item.precioUnitario ?? item.pUnitario) || 0;
      const importe = cant * pUnit;
      return {
        id: item.id ?? idx + 1,
        clave: item.clave ?? item.material_clave ?? `PDA-${idx + 1}`,
        concepto: item.descripcion ?? item.material_descripcion ?? item.concepto ?? '—',
        descripcion: item.descripcion_adicional ?? item.descripcion ?? '',
        cant,
        unid: (item.unidad ?? item.unid ?? 'PZA').toUpperCase(),
        pUnitario: pUnit,
        importe,
      };
    });
  }
  let total = data.total;
  if (total == null || Number.isNaN(Number(total))) {
    total = data.monto_total;
    if (total == null && conceptos?.length) {
      total = conceptos.reduce((sum, c) => sum + (Number(c.importe) || 0), 0);
    }
  }
  total = Number(total) || 0;
  return {
    ...data,
    empresa_datos: empresa,
    conceptos: conceptos || [],
    total,
    folio: data.folio ?? data.folio_oc ?? '—',
    fecha: formatFecha(data.fecha),
    proveedor: data.proveedor ?? data.proveedores?.nombre_comercial ?? data.proveedor ?? 'N/A',
    proyecto: data.proyecto ?? data.proyecto_texto ?? 'N/A',
    comprador: data.comprador ?? 'N/A',
    solicitante: data.solicitante ?? 'N/A',
    descripcion: data.descripcion ?? data.descripcion_pedido ?? 'Sin descripción general',
    moneda: data.moneda || 'MXN',
  };
}

const FormatoOCTESEY = ({ data, onPrint, marca = 'iihemsa_peninsular' }) => {
  const d = normalizeData(data);
  if (!d) return <p className="p-8 text-center text-gray-500">Cargando datos de la orden...</p>;

  const empresa = d.empresa_datos || defaultEmpresaDatos;
  const logoSrc = getLogoByMarca(marca);
  const logoAlt =
    marca === 'tesey' ? 'TESEY' : marca === 'iihemsa_peninsular' ? 'IIHEMSA Peninsular' : 'IIHEMSA';

  return (
    <div className="relative bg-white w-[210mm] min-h-[297mm] p-[15mm] border rounded shadow-md print:border-none print:shadow-none print:w-auto print:min-h-auto print:p-0 print:m-0 print:block">
      {onPrint && (
        <div className="absolute top-4 right-4 print:hidden">
          <button
            type="button"
            onClick={onPrint}
            className="bg-[#E75D22] text-white px-5 py-2.5 rounded-md shadow flex items-center gap-2 text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            <Printer size={18} />
            Imprimir: Formato {d.empresa || 'IIHEMSA Peninsular'}
          </button>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <img
            src={logoSrc}
            alt={logoAlt}
            className="h-16 object-contain"
            onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200x80?text=IIHEMSA+Peninsular'; }}
          />
          <div className="text-sm">
            <h1 className="font-bold text-gray-800 text-lg">{empresa.nombre}</h1>
            <p className="text-gray-600">R.F.C. {empresa.rfc}</p>
            <p className="text-gray-600">{empresa.calle}, {empresa.colonia}</p>
            <p className="text-gray-600">{empresa.ciudad}, {empresa.estado}, {empresa.cp}</p>
            <p className="text-gray-500 text-xs">{empresa.regimen}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-[#E75D22]">ORDEN DE COMPRA</h2>
          <p className="font-semibold text-sm">FOLIO: <span className="text-red-600 font-bold">{d.folio}</span></p>
          <p className="text-gray-600 text-xs">FECHA: {d.fecha}</p>
        </div>
      </div>

      <div className="border-t-2 border-[#E75D22] py-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6">
        <div><p><span className="font-semibold text-gray-700">PROVEEDOR:</span> {d.proveedor}</p></div>
        <div><p><span className="font-semibold text-gray-700">COMPRADOR:</span> {d.comprador}</p></div>
        <div><p><span className="font-semibold text-gray-700">PROYECTO / CUENTA:</span> {d.proyecto}</p></div>
        <div><p><span className="font-semibold text-gray-700">SOLICITANTE:</span> {d.solicitante}</p></div>
        <div className="col-span-2 mt-2"><p><span className="font-semibold text-gray-700">DESCRIPCIÓN:</span> {d.descripcion}</p></div>
        <div className="col-span-2 text-right"><p><span className="font-semibold text-gray-700">MONEDA:</span> {d.moneda}</p></div>
      </div>

      <div className="border rounded-md overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-[#0D1528] text-white text-xs">
            <tr>
              <th className="px-3 py-2 text-left font-normal w-12">#</th>
              <th className="px-3 py-2 text-left font-normal">Clave</th>
              <th className="px-3 py-2 text-left font-normal w-2/5">Concepto</th>
              <th className="px-3 py-2 text-center font-normal">Cant.</th>
              <th className="px-3 py-2 text-center font-normal">Unid.</th>
              <th className="px-3 py-2 text-right font-normal">P. Unitario</th>
              <th className="px-3 py-2 text-right font-normal">Importe</th>
            </tr>
          </thead>
          <tbody>
            {d.conceptos?.length > 0 ? (
              d.conceptos.map((concepto, index) => (
                <tr key={concepto.id ?? index} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-600">{index + 1}</td>
                  <td className="px-3 py-2.5 text-gray-700 font-mono text-xs">{concepto.clave ?? 'N/A'}</td>
                  <td className="px-3 py-2.5 text-gray-900">
                    <p className="font-semibold">{concepto.concepto ?? concepto.descripcion ?? '—'}</p>
                    {concepto.descripcion && (
                      <p className="text-gray-500 text-xs mt-1 leading-relaxed">{concepto.descripcion}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-gray-700">{concepto.cant ?? concepto.cantidad ?? 0}</td>
                  <td className="px-3 py-2.5 text-center text-gray-700 text-xs uppercase">{concepto.unid ?? 'PZA'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 font-mono">
                    {(concepto.pUnitario != null ? Number(concepto.pUnitario) : 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-900 font-bold font-mono">
                    {(concepto.importe != null ? Number(concepto.importe) : 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500 italic">No hay conceptos definidos en esta orden.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-start mt-10">
        <div className="w-1/2 border rounded-md p-4 text-sm bg-gray-50">
          <p className="font-semibold text-gray-700 mb-1">Observaciones:</p>
          <p className="text-gray-600 text-xs leading-relaxed">
            {d.observaciones || 'El proveedor se compromete a entregar los materiales en el tiempo y forma acordados. El pago se realizará según las condiciones comerciales establecidas.'}
          </p>
        </div>
        <div className="w-1/3 text-right">
          <p className="text-2xl font-bold text-[#E75D22]">TOTAL:</p>
          <p className="text-4xl font-extrabold text-[#0D1528] font-mono">
            {d.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 })}
          </p>
          <p className="text-gray-500 text-xs mt-1">{d.moneda}</p>
        </div>
      </div>
    </div>
  );
};

export default FormatoOCTESEY;
