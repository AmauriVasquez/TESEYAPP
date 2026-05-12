import React from 'react';

const FormatoOCMSM = ({ data }) => {
  if (!data) return null;

  // Funciones de formato
  const toCurrency = (num) => '$' + Number(num || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const formatDate = (dateString) => {
    if (!dateString) return new Date().toLocaleDateString('es-MX');
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: '2-digit' }).replace('.', '');
  };

  // Cálculos Matemáticos
  const subtotal = data?.items?.reduce((sum, item) => {
    const cant = parseFloat(item.cantidad || 0);
    const pUnit = parseFloat(item.precio_unitario || 0);
    const dscp = parseFloat(item.descuento || 0);
    return sum + (cant * (pUnit * (1 - dscp / 100)));
  }, 0) || 0;

  const ivaPct = parseFloat(data?.tasa_iva !== undefined ? data?.tasa_iva : 16);
  const iva = subtotal * (ivaPct / 100);
  const ieps = parseFloat(data?.monto_ieps || 0);
  const retIva = parseFloat(data?.retencion_iva || 0);
  const retIsr = parseFloat(data?.retencion_isr || 0);
  const totalRetenciones = retIva + retIsr;
  const totalFinal = subtotal + iva + ieps - totalRetenciones;

  return (
    <div className="print-container w-full max-w-[215mm] min-h-[279mm] bg-white px-8 py-6 shadow-xl text-black relative box-border mx-auto flex flex-col font-sans">
      
      {/* Encabezado MSM - Estrictamente sin logo */}
      <header className="flex justify-between items-center mb-4 border-b border-gray-300 pb-2">
        <div className="w-[20%]">
          {/* Espacio vacío reservado para mantener la estructura del grid sin inyectar imagen */}
        </div>
        <div className="w-[55%] text-center">
          <h1 className="text-[13px] font-bold text-black leading-tight">
            Ingeniería e Instalaciones Hidroneumáticas Eléctricas y Montajes SA de CV
          </h1>
        </div>
        <div className="w-[25%] text-[11px] text-right">
          <div><span className="font-bold">FECHA:</span> <span>{formatDate(data?.fecha)}</span></div>
        </div>
      </header>

      {/* Folio y Datos Generales */}
      <div className="text-[13px] mb-4">
        <span className="font-bold">ORDEN DE COMPRA: </span>
        <span className="font-bold">OC-{data?.folio || '00000'}</span>
      </div>

      <div className="text-[12px] leading-relaxed mb-4">
        <div className="flex">
          <div className="w-1/2"><span className="font-bold">PROYECTO: </span> <span>{data?.proyecto_texto || 'N/A'}</span></div>
          <div className="w-1/2"><span className="font-bold">PROVEEDOR: </span> <span>{data?.proveedores?.nombre_comercial || data?.proveedor || 'N/A'}</span></div>
        </div>
        <div className="flex mt-1">
          <div className="w-1/2"><span className="font-bold">COMPRADOR: </span> <span>{data?.comprador || 'SISTEMA'}</span></div>
          <div className="w-1/2"><span className="font-bold">MONEDA: </span> <span>{data?.moneda || 'MXN'}</span></div>
        </div>
      </div>

      {/* Tabla Conceptos */}
      <div className="flex-grow mb-4">
        <table className="w-full text-[10px] border-collapse border-b border-gray-400">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="py-2 px-1 border-r border-gray-300 text-center w-[5%] font-bold">PDA.</th>
              <th className="py-2 px-1 border-r border-gray-300 text-center w-[12%] font-bold">CLAVE</th>
              <th className="py-2 px-1 border-r border-gray-300 text-left w-[53%] font-bold">DESCRIPCIÓN</th>
              <th className="py-2 px-1 border-r border-gray-300 text-center w-[8%] font-bold">UNIDAD</th>
              <th className="py-2 px-1 border-r border-gray-300 text-center w-[7%] font-bold">CANTIDAD</th>
              <th className="py-2 px-1 border-r border-gray-300 text-center w-[7%] font-bold">P. UNIT.</th>
              <th className="py-2 px-1 text-center w-[8%] font-bold">IMPORTE</th>
            </tr>
          </thead>
          <tbody className="text-black">
            {(!data?.items || data.items.length === 0) ? (
              <tr><td colSpan="7" className="py-6 text-center text-gray-400 italic">Sin partidas.</td></tr>
            ) : (
              data.items.map((item, index) => {
                const cant = parseFloat(item.cantidad || 0);
                const pUnit = parseFloat(item.precio_unitario || 0);
                return (
                  <tr key={index}>
                    <td className="py-1 px-1 border-r border-b border-gray-300 text-center border-l">{index + 1}</td>
                    <td className="py-1 px-1 border-r border-b border-gray-300 text-center">{item.clave || '-'}</td>
                    <td className="py-1 px-1 border-r border-b border-gray-300">
                      <span className="font-bold">{item.descripcion || item.material}</span>
                      {item.observaciones && <><br/><span className="text-gray-500 italic font-normal">{item.observaciones}</span></>}
                    </td>
                    <td className="py-1 px-1 border-r border-b border-gray-300 text-center uppercase">{item.unidad || 'PZA'}</td>
                    <td className="py-1 px-1 border-r border-b border-gray-300 text-center">{cant}</td>
                    <td className="py-1 px-1 border-r border-b border-gray-300 text-right">{toCurrency(pUnit)}</td>
                    <td className="py-1 px-1 border-b border-gray-300 text-right font-bold border-r">{toCurrency(cant * pUnit)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pie Financiero */}
      <div className="flex justify-between items-start avoid-break mb-4 gap-6">
        <div className="w-3/5 text-[10px]">
          <p className="font-bold mb-1">CONDICIONES Y PAGOS</p>
          <div className="mb-2">
            <span className="font-bold">MÉTODO:</span> {(data?.condiciones_pago && data.condiciones_pago[0]?.concepto === 'Contado') ? 'CONTADO' : 'PARCIALIDADES'}
          </div>
          <ul className="mt-1 space-y-0.5 mb-3">
            {data?.condiciones_pago?.map((p, idx) => (
              <li key={idx} className="flex justify-between border-b border-gray-200 border-dashed last:border-0 pb-0.5 pr-4">
                <span>&bull; {p.concepto} <span className="text-[9px] text-gray-600">({p.porcentaje}%)</span></span>
                <span className="font-bold">{toCurrency((totalFinal * p.porcentaje) / 100)}</span>
              </li>
            ))}
          </ul>
          <p className="font-bold mb-1">CUENTAS BANCARIAS DEL PROVEEDOR</p>
          <div className="border border-gray-300 p-2 min-h-[40px]">
             {data?.proveedores?.banco ? `${data.proveedores.banco} - Cta/CLABE: ${data.proveedores.clabe}` : 'No registradas'}
          </div>
        </div>

        <div className="w-2/5 flex flex-col">
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr><th className="py-1 px-2 text-right font-bold border-t border-gray-300 w-[50%]">SUBTOTAL:</th><th className="py-1 px-2 text-right font-normal border-t border-gray-300">{toCurrency(subtotal)}</th></tr>
              <tr><th className="py-1 px-2 text-right font-bold w-[50%]">I.V.A.:</th><th className="py-1 px-2 text-right font-normal">{toCurrency(iva)}</th></tr>
              {ieps > 0 && <tr><th className="py-1 px-2 text-right font-bold w-[50%]">IEPS:</th><th className="py-1 px-2 text-right font-normal">{toCurrency(ieps)}</th></tr>}
              {totalRetenciones > 0 && <tr><th className="py-1 px-2 text-right font-bold text-red-700 w-[50%]"><span className="text-[9px]">RETENCIONES</span>:</th><th className="py-1 px-2 text-right font-normal text-red-700">-{toCurrency(totalRetenciones)}</th></tr>}
              <tr><th className="py-1.5 px-2 text-right font-bold border-t border-b-2 border-gray-500 w-[50%]">TOTAL:</th><th className="py-1.5 px-2 text-right font-bold border border-b-2 border-gray-500">{toCurrency(totalFinal)}</th></tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Comentarios y Condiciones */}
      <div className="text-[9px] text-justify leading-snug border border-gray-100 p-2 avoid-break mt-auto text-gray-500">
        <p className="font-bold mb-1">CONDICIONES GENERALES</p>
        <p>Las condiciones generales de contratación que constan en la presente orden de compra (“OC”) regirán y serán de obligatorio cumplimiento para el PROVEEDOR. El PROVEEDOR se compromete a entregar los bienes/servicios señalados de acuerdo con las especificaciones y fechas acordadas.</p>
      </div>
    </div>
  );
};

export default FormatoOCMSM;