import React, { useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const FormatoCotizacionTESEY = ({ cotizacionData = {}, onPrint }) => {
  const printRef = useRef();

  // --- LÓGICA DE ADAPTACIÓN DE DATOS ---
  const items = useMemo(() => {
    // Si cotizacionData es null o undefined, usa un objeto vacío para evitar errores
    const data = cotizacionData || {};

    if (data.items && data.items.length > 0) {
      return data.items;
    }

    // Fallback: Crear partida única ficticia si no hay desglose
    const precio = data.monto_subtotal || (data.total ? data.total / 1.16 : 0);

    return [{
      descripcion: data.descripcion || 'Servicios Profesionales (Descripción General)',
      cantidad: 1,
      unidad: 'SER', // Servicio
      precio_unitario: precio,
      observaciones: 'Partida única basada en el total del proyecto.'
    }];
  }, [cotizacionData]);

  // --- CÁLCULOS FINANCIEROS ---
  const { subtotal, iva, totalCalculated } = useMemo(() => {
    const sub = items.reduce((acc, item) => {
      return acc + (parseFloat(item.cantidad || 0) * parseFloat(item.precio_unitario || 0));
    }, 0);

    let shouldApplyIva = false;

    // Aseguramos acceso seguro a las propiedades
    if (cotizacionData && cotizacionData.aplica_iva !== undefined) {
      shouldApplyIva = cotizacionData.aplica_iva;
    } else {
      const storedTotal = parseFloat((cotizacionData && cotizacionData.total) || 0);
      shouldApplyIva = storedTotal > (sub * 1.05);
    }

    const ivaAmount = shouldApplyIva ? sub * 0.16 : 0;

    return {
      subtotal: sub,
      iva: ivaAmount,
      totalCalculated: sub + ivaAmount
    };
  }, [items, cotizacionData]);

  // --- MANEJADOR DE IMPRESIÓN ---
  const handleBrowserPrint = () => {
    const printContent = printRef.current;

    const w = window.open('', '_blank');
    if (!w) {
      // En caso de que el navegador bloquee popups, podrías manejar una alerta aquí o usar un modal
      console.error("Popup bloqueado. No se puede imprimir.");
      return;
    }

    // Usamos cotizacionData de forma segura
    const folio = cotizacionData?.folio || 'Borrador';

    w.document.write(`
        <html>
          <head>
            <title>Cotización ${folio}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              body {
                padding: 40px;
                font-family: 'Inter', sans-serif;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                background-color: white;
              }
              /* Configuración exacta para tamaño Carta */
              @page { size: letter; margin: 0mm; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
            <script>
              setTimeout(() => {
                window.print();
                // Opcional: window.close();
              }, 800); 
            </script>
          </body>
        </html>
      `);
    w.document.close();

    if (onPrint) onPrint();
  };

  // Nombre del cliente seguro
  const nombreCliente = cotizacionData?.cliente?.nombre || cotizacionData?.cliente_nombre_externo || 'Cliente General';

  // Fecha segura con manejo de errores
  const fechaStr = cotizacionData?.fecha;
  const fechaDisplay = fechaStr
    ? format(new Date(fechaStr), "dd 'de' MMMM, yyyy", { locale: es })
    : format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });

  return (
    <div className="flex flex-col items-center w-full bg-gray-100 p-6 rounded-xl">

      {/* 1. BARRA DE ACCIONES (No se imprime) */}
      <div className="w-full max-w-[215mm] flex justify-end mb-4">
        {/* Aquí puedes restaurar tu componente Button original si lo deseas */}
        <button
          onClick={handleBrowserPrint}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-md transition-all duration-200 flex items-center gap-2 px-4 py-2 rounded-md"
        >
          <Printer className="w-4 h-4" />
          <span className="text-sm font-bold">Imprimir Cotización</span>
        </button>
      </div>

      {/* 2. EL FORMATO DE PAPEL (Área Imprimible) */}
      {/* Tamaño Carta: 215.9mm x 279.4mm */}
      <div ref={printRef} className="w-full max-w-[215mm] min-h-[279mm] bg-white p-10 shadow-xl text-black relative box-border mx-auto flex flex-col">

        {/* --- ENCABEZADO --- */}
        <header className="flex justify-between items-start pb-4 border-b-4 border-orange-600 mb-4">
          <div className="w-48">
            <img
              alt="Logo TESEY"
              className="h-20 w-auto object-contain"
              src="https://horizons-cdn.hostinger.com/7674e461-e42f-4074-83c5-c45e4d06ed8b/tesey-svg_imgid1-CczHO.png"
              onError={(e) => { e.target.onerror = null; e.target.src = "https://via.placeholder.com/200x80?text=LOGO+TESEY"; }}
            />
          </div>
          <div className="text-right flex-1 pl-8">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Tecnomaquila y Servicios de Yucatán</h1>

            {/* DATOS DE LA EMPRESA */}
            <div className="text-[10px] text-gray-500 mt-2 leading-snug">
              <p>CALLE 24 # 73-4 , RESIDENCIAL XCANATUN, MERIDA,</p>
              <p>YUCATAN, MEXICO, C.P. 97302</p>
              <p>R.F.C. TSY221213TIA</p>
              <p>REGIMEN FISCAL: 626 Régimen Simplificado de Confianza</p>
            </div>

            <div className="mt-3 text-xs text-gray-500 space-y-0.5">
              <p className="font-medium text-gray-800">Fecha: {fechaDisplay}</p>
            </div>
          </div>
        </header>

        {/* --- DATOS GENERALES (Compactado) --- */}
        <div className="bg-white rounded-lg p-2 mb-2 border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-1 border-b border-orange-100 pb-1">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Folio Cotización</span>
            <span className="text-sm font-bold text-red-600">{cotizacionData?.folio || 'PRELIMINAR'}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
            <div className="flex flex-col">
              <span className="text-gray-500 font-semibold text-[10px] uppercase">Cliente:</span>
              <span className="font-bold text-gray-700 text-xs">{nombreCliente}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-gray-500 font-semibold text-[10px] uppercase">Vendedor:</span>
              <span className="font-bold text-gray-700 text-xs">
                {(cotizacionData?.usuario_cotizacion || 'N/A').toUpperCase()}
              </span>
              {cotizacionData?.vendedor && (
                <div className="flex flex-col text-[10px] text-gray-600 mt-0.5 leading-tight">
                  {cotizacionData.vendedor.telefono && (
                    <span>Tel: {cotizacionData.vendedor.telefono}</span>
                  )}
                  {(cotizacionData.vendedor.correo || cotizacionData.vendedor.email) && (
                    <span>Email: {cotizacionData.vendedor.correo || cotizacionData.vendedor.email}</span>
                  )}
                </div>
              )}
            </div>
            <div className="col-span-2 mt-1 pt-1 border-t border-gray-100">
              <span className="text-gray-500 font-semibold block mb-0.5 text-[10px] uppercase">Concepto General:</span>
              <p className="text-gray-800 font-medium bg-gray-50 p-1.5 border border-gray-100 rounded leading-tight">
                {cotizacionData?.descripcion || "Servicios Metalmecánicos Generales"}
              </p>
            </div>
          </div>
        </div>

        {/* --- TABLA DE PARTIDAS --- */}
        <div className="flex-grow">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="py-2 px-3 text-center w-12 rounded-tl-md font-bold">#</th>
                <th className="py-2 px-3 text-left font-bold">Descripción</th>
                <th className="py-2 px-3 text-center w-20 font-bold">Cant.</th>
                <th className="py-2 px-3 text-center w-20 font-bold">Unidad</th>
                <th className="py-2 px-3 text-right w-28 font-bold">P. Unitario</th>
                <th className="py-2 px-3 text-right w-28 rounded-tr-md font-bold">Importe</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 text-[11px]">
              {items.map((item, index) => (
                <tr key={index} className="border-b border-gray-200 hover:bg-orange-50 transition-colors">
                  <td className="py-2 px-3 text-center font-bold text-gray-400">{index + 1}</td>
                  <td className="py-2 px-3">
                    <p className="font-bold text-gray-900">{item.descripcion}</p>
                    {item.observaciones && <p className="text-[10px] text-gray-500 italic mt-0.5">{item.observaciones}</p>}
                  </td>
                  <td className="py-2 px-3 text-center font-medium">{item.cantidad}</td>
                  <td className="py-2 px-3 text-center text-gray-500 uppercase">{item.unidad || 'PZA'}</td>
                  <td className="py-2 px-3 text-right">
                    ${parseFloat(item.precio_unitario || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2 px-3 text-right font-bold text-gray-900">
                    ${(parseFloat(item.cantidad || 0) * parseFloat(item.precio_unitario || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {/* Mensaje de seguridad si llega vacío */}
              {items.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-400 italic bg-gray-50 border-b">
                    No hay partidas definidas en esta cotización.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- SECCIÓN INFERIOR COMBINADA (CONDICIONES + TOTALES) --- */}
        <div className="flex justify-between items-start mt-6 border-t border-gray-100 pt-4 gap-6">

          {/* --- CONDICIONES COMERCIALES (Izquierda) --- */}
          <div className="flex-1 text-[10px] text-gray-500 text-justify leading-tight">
            <p className="font-bold mb-1">Condiciones Comerciales:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Precios en Moneda Nacional (MXN).</li>
              <li>Tiempo de entrega: A confirmar según carga de trabajo al momento de la orden de compra.</li>
              <li>Vigencia de la cotización: 15 días naturales.</li>
              <li>Forma de pago: 50% anticipo, 50% contra entrega (salvo acuerdo previo).</li>
            </ul>
          </div>

          {/* --- TOTALES (Derecha) --- */}
          <div className="w-64 bg-gray-50 rounded-lg border border-gray-200 p-4 shadow-sm shrink-0">
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-semibold text-gray-600">Subtotal:</span>
              <span className="font-medium text-gray-900">${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center mb-2 text-xs">
              <span className="font-semibold text-gray-600">IVA (16%):</span>
              <span className="font-medium text-gray-900">${iva.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-300 mt-2">
              <span className="font-bold text-sm text-gray-900">TOTAL:</span>
              <span className="font-bold text-lg text-orange-600">${totalCalculated.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* --- PIE DE PÁGINA --- */}
        <footer className="mt-auto pt-4 border-t-2 border-gray-100 flex flex-col items-center">
          <div className="text-[9px] text-gray-400 text-center">
            <p>Tecnomaquila y Servicios de Yucatán</p>
            <p>Generado por Sistema de Control TESEY</p>
          </div>
        </footer>

      </div>
    </div>
  );
};

export default FormatoCotizacionTESEY;