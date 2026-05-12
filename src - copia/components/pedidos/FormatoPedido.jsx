import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const FormatoPedido = ({ pedidoData, onPrint, onDownloadJson }) => {
  const printRef = useRef();

  return (
    <div className="space-y-4">
      <div ref={printRef} className="p-8 border rounded-lg bg-white text-black">
        <header className="flex justify-between items-center pb-4 border-b-2 border-gray-300">
          <img alt="Company Logo" class="h-16" src="https://images.unsplash.com/photo-1633233032179-a35eea44e08a" />
          <div className="text-right">
            <h2 className="text-2xl font-bold">PEDIDO DE MATERIALES</h2>
            <p className="text-sm">INGENIERÍA E INSTALACIONES HIDRONEUMATICAS ELECTRICAS Y MONTAJES</p>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-4 mt-4 text-sm">
          <div><span className="font-bold">Planta:</span> PLANTA 1</div>
          <div><span className="font-bold">Fecha:</span> {pedidoData.fecha ? format(new Date(pedidoData.fecha), 'dd/MMM/yyyy', { locale: es }) : 'N/A'}</div>
          <div><span className="font-bold">PO:</span> <span className="text-red-600 font-bold">{pedidoData.folio || 'PENDIENTE'}</span></div>
          <div><span className="font-bold">Obra:</span> {pedidoData.proyecto?.descripcion || pedidoData.cuenta || 'N/A'}</div>
          <div><span className="font-bold">Cotización:</span> {pedidoData.proyecto?.cotizacion_folio || 'N/A'}</div>
          <div><span className="font-bold">Supervisor:</span> {pedidoData.solicitante?.nombre_completo || 'N/A'}</div>
        </section>

        {pedidoData.observaciones_generales && (
          <section className="mt-4 text-sm">
            <span className="font-bold">Observaciones Generales:</span>
            <p className="p-2 border rounded-md bg-gray-50 mt-1">{pedidoData.observaciones_generales}</p>
          </section>
        )}

        <section className="mt-6">
          <table className="w-full text-sm border-collapse border border-gray-400">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 p-2 text-left font-bold">Descripción</th>
                <th className="border border-gray-300 p-2 text-center font-bold w-24">Cantidad</th>
                <th className="border border-gray-300 p-2 text-center font-bold w-24">Unidad</th>
                <th className="border border-gray-300 p-2 text-left font-bold">Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {pedidoData.items.map((item, index) => (
                <tr key={index}>
                  <td className="border border-gray-300 p-2">{item.descripcion}</td>
                  <td className="border border-gray-300 p-2 text-center">{item.cantidad}</td>
                  <td className="border border-gray-300 p-2 text-center">{item.unidad}</td>
                  <td className="border border-gray-300 p-2">{item.observaciones || ''}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, 10 - pedidoData.items.length) }).map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td className="border border-gray-300 p-2 h-8"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                  <td className="border border-gray-300 p-2"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t-2 border-gray-300 text-center text-xs">
          <div><div className="border-t border-gray-400 mt-8 pt-1">Solicitó</div></div>
          <div><div className="border-t border-gray-400 mt-8 pt-1">Autorizó</div></div>
          <div><div className="border-t border-gray-400 mt-8 pt-1">Recibió</div></div>
        </footer>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" onClick={onDownloadJson} className="gap-2"><Download className="w-4 h-4" /> Descargar JSON</Button>
        <Button onClick={() => onPrint(printRef.current)} className="gap-2"><Printer className="w-4 h-4" /> Imprimir / PDF</Button>
      </div>
    </div>
  );
};

export default FormatoPedido;