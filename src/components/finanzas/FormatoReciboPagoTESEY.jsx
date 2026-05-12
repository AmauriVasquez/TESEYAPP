import React, { useRef, useMemo } from 'react';
import { Printer, CheckCircle2 } from 'lucide-react';
import { formatDateForPrint } from '@/lib/dateUtils';
import { getLogoByMarca } from '@/lib/brandLogos';

/**
 * Comprobante de Pago TESEY - Formato oficial para impresión.
 * Recibe pagoData con: folio_recibo, fecha_pago, folio_cotizacion, nombre_proyecto,
 * cliente { nombre, rfc }, concepto_pago, forma_pago, referencia_bancaria?, banco_destino?,
 * monto_total_proyecto, pagos_anteriores, monto_este_pago.
 */
const FormatoReciboPagoTESEY = ({ pagoData, onPrint }) => {
  const printRef = useRef();

  const { saldoPendiente, porcentajePagado } = useMemo(() => {
    const data = pagoData || {};
    const total = parseFloat(data.monto_total_proyecto || 0);
    const anteriores = parseFloat(data.pagos_anteriores || 0);
    const actual = parseFloat(data.monto_este_pago || 0);
    const pagadoHastaHoy = anteriores + actual;
    const pendiente = total - pagadoHastaHoy;
    const porcentaje = total > 0 ? (pagadoHastaHoy / total) * 100 : 0;
    return {
      saldoPendiente: Math.max(0, pendiente),
      porcentajePagado: porcentaje,
    };
  }, [pagoData]);

  const handleBrowserPrint = () => {
    const printContent = printRef.current;
    const w = window.open('', '_blank');
    if (!w) {
      console.error('Popup bloqueado.');
      return;
    }
    const folio = pagoData?.folio_recibo || 'Recibo';
    w.document.write(`
        <html>
          <head>
            <title>Recibo ${folio}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              body { padding: 40px; font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; }
              @page { size: letter; margin: 0mm; }
            </style>
          </head>
          <body>${printContent.innerHTML}
            <script>setTimeout(() => { window.print(); }, 800);</script>
          </body>
        </html>
      `);
    w.document.close();
    if (onPrint) onPrint();
  };

  const fechaDisplay = formatDateForPrint(pagoData?.fecha_pago);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

  return (
    <div className="flex flex-col items-center w-full bg-gray-100 p-6 rounded-xl">
      <div className="w-full max-w-[215mm] flex justify-end mb-4">
        <button
          onClick={handleBrowserPrint}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shadow-md transition-all duration-200 flex items-center gap-2 px-4 py-2 rounded-md"
        >
          <Printer className="w-4 h-4" />
          <span className="text-sm font-bold">Imprimir Recibo</span>
        </button>
      </div>

      <div ref={printRef} className="w-full max-w-[215mm] min-h-[279mm] bg-white p-10 shadow-xl text-black relative box-border mx-auto flex flex-col">
        <header className="flex justify-between items-start pb-4 border-b-4 border-orange-600 mb-4">
          <div className="w-48">
            <img
              alt="IIHEMSA Peninsular"
              className="h-20 w-auto object-contain"
              src={getLogoByMarca('iihemsa_peninsular')}
              onError={(e) => { e.target.onerror = null; e.target.src = 'https://via.placeholder.com/200x80?text=IIHEMSA+Peninsular'; }}
            />
          </div>
          <div className="text-right flex-1 pl-8">
            <h1 className="text-xl font-bold text-gray-900 leading-tight uppercase">Comprobante de Pago</h1>
            <div className="text-[10px] text-gray-500 mt-2 leading-snug">
              <p>CALLE 24 # 73-4 , RESIDENCIAL XCANATUN, MERIDA,</p>
              <p>YUCATAN, MEXICO, C.P. 97302</p>
              <p>R.F.C. TSY221213TIA</p>
            </div>
            <div className="mt-3 text-xs text-gray-500 space-y-0.5">
              <p className="font-medium text-gray-800">Fecha de Emisión: {fechaDisplay}</p>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-lg p-2 mb-4 border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-2 border-b border-orange-100 pb-1">
            <span className="text-xs font-bold text-gray-600 uppercase tracking-wide">Folio Recibo</span>
            <span className="text-sm font-bold text-red-600">{pagoData?.folio_recibo || 'BORRADOR'}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex flex-col">
              <span className="text-gray-500 font-semibold text-[10px] uppercase">Recibimos de:</span>
              <span className="font-bold text-gray-800 text-sm">{pagoData?.cliente?.nombre || 'Cliente General'}</span>
              {pagoData?.cliente?.rfc && <span className="text-gray-500 text-[10px]">RFC: {pagoData.cliente.rfc}</span>}
            </div>
            <div className="flex flex-col text-right space-y-1">
              <div>
                <span className="text-gray-500 font-semibold text-[10px] uppercase mr-2">Ref. Cotización:</span>
                <span className="font-bold text-gray-700 bg-gray-100 px-1 rounded">{pagoData?.folio_cotizacion || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500 font-semibold text-[10px] uppercase mr-2">Proyecto:</span>
                <span className="font-medium text-gray-800">{pagoData?.nombre_proyecto || 'General'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-grow mb-4">
          <div className="mb-1 text-xs font-bold text-gray-700 uppercase">Concepto del Pago</div>
          <table className="w-full text-xs border-collapse border border-gray-200">
            <thead className="bg-gray-900 text-white">
              <tr>
                <th className="py-2 px-3 text-left w-2/3">Descripción / Concepto</th>
                <th className="py-2 px-3 text-left">Método de Pago</th>
                <th className="py-2 px-3 text-right">Importe</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-b border-gray-200">
                <td className="py-3 px-3 align-top">
                  <div className="font-bold text-sm text-gray-900">{pagoData?.concepto_pago || 'Pago a cuenta'}</div>
                  <div className="text-[10px] text-gray-500 mt-1">Correspondiente al proyecto: {pagoData?.nombre_proyecto || '—'}</div>
                </td>
                <td className="py-3 px-3 align-top">
                  <div className="font-medium">{pagoData?.forma_pago || 'No especificado'}</div>
                  {pagoData?.referencia_bancaria && <div className="text-[10px] text-gray-500">Ref: {pagoData.referencia_bancaria}</div>}
                  {pagoData?.banco_destino && <div className="text-[10px] text-gray-500">{pagoData.banco_destino}</div>}
                </td>
                <td className="py-3 px-3 text-right font-bold text-sm align-top">
                  {formatCurrency(pagoData?.monto_este_pago || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-start mt-2 gap-6">
          <div className="flex-1">
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold text-orange-800">Estado del Pago</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
                <div
                  className={`h-2.5 rounded-full ${saldoPendiente <= 0 ? 'bg-green-600' : 'bg-orange-500'}`}
                  style={{ width: `${Math.min(porcentajePagado, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-600">
                <span>0%</span>
                <span className="font-medium">{porcentajePagado.toFixed(1)}% Pagado</span>
                <span>100%</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-2 italic text-justify">
                Este documento ampara la recepción de la cantidad señalada. El saldo pendiente deberá ser cubierto según los términos acordados en la cotización original.
              </p>
            </div>
          </div>
          <div className="w-72 bg-gray-50 rounded-lg border border-gray-200 p-4 shadow-sm shrink-0">
            <h3 className="text-xs font-bold text-gray-800 border-b border-gray-200 pb-2 mb-2 uppercase">Resumen de Saldos</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-gray-500">
                <span>Monto Total Proyecto:</span>
                <span className="font-medium">{formatCurrency(pagoData?.monto_total_proyecto || 0)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>(-) Pagos Anteriores:</span>
                <span className="font-medium">{formatCurrency(pagoData?.pagos_anteriores || 0)}</span>
              </div>
              <div className="flex justify-between items-center bg-orange-100 p-1.5 rounded text-orange-900 border border-orange-200">
                <span className="font-bold">(-) Este Pago:</span>
                <span className="font-bold text-sm">{formatCurrency(pagoData?.monto_este_pago || 0)}</span>
              </div>
              <div className="border-t border-gray-300 my-1" />
              <div className="flex justify-between items-center">
                <span className={`font-bold uppercase ${saldoPendiente > 0 ? 'text-gray-700' : 'text-green-600'}`}>
                  {saldoPendiente > 0 ? 'Saldo Pendiente:' : '¡Proyecto Liquidado!'}
                </span>
                <span className={`font-bold text-base ${saldoPendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(saldoPendiente)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto pt-8 flex flex-col items-center">
          <div className="w-64 border-t border-gray-400 mb-2" />
          <p className="text-xs font-bold text-gray-700">RECIBIDO POR</p>
          <p className="text-[10px] text-gray-500 mt-1">Tecnomaquila y Servicios de Yucatán</p>
          <div className="text-[9px] text-gray-400 text-center mt-4">Generado por Sistema de Control IIHEMSA Peninsular | {pagoData?.folio_recibo || 'Recibo'}</div>
        </footer>
      </div>
    </div>
  );
};

export default FormatoReciboPagoTESEY;
