import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import PedidoMaterialPrint, { resolvePedidoMaterialFolio } from '@/components/print/PedidoMaterialPrint';
import { PRINT_LETTER_WINDOW_STYLES } from '@/lib/printLetterWindowCss';

/**
 * Vista previa e impresión de pedidos de materiales.
 * La impresión abre ventana con solo el documento (mismo criterio que cotizaciones), no window.print() sobre el modal.
 */
function pedidoDefaultMarca(pedido, defaultFormat) {
  if (defaultFormat === 'IIHEMSA') return 'iihemsa';
  if (defaultFormat === 'TESEY') return 'tesey';
  const emp = String(pedido?.empresa || '').toUpperCase();
  // PENINSULAR antes que IIHEMSA: "IIHEMSA PENINSULAR" contiene ambas subcadenas.
  if (emp.includes('PENINSULAR')) return 'iihemsa_peninsular';
  if (emp.includes('TESEY')) return 'tesey';
  if (emp.includes('IIHEMSA')) return 'iihemsa';
  return 'iihemsa';
}

const FormatoPedidoImpresion = ({ open, onOpenChange, pedido, defaultFormat = null }) => {
  const [marca, setMarca] = useState(() => pedidoDefaultMarca(pedido, defaultFormat));
  const printRef = useRef(null);
  const wasOpenRef = useRef(false);

  const normalizedPedido = useMemo(() => {
    const p = pedido ?? {};
    return {
      ...p,
      items: p.items ?? p.pedidos_materiales_items ?? [],
      observaciones: p.observaciones ?? p.observaciones_generales,
    };
  }, [pedido]);

  /**
   * Solo al abrir el modal: si dependemos de pedido/empresa mientras está abierto,
   * cualquier re-render del padre puede sobrescribir la marca elegida en el <select>.
   */
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = pedidoDefaultMarca(pedido, defaultFormat);
      setMarca(next);
      console.log('FormatoPedidoImpresion: marca inicial al abrir (value option):', next);
    }
    wasOpenRef.current = open;
  }, [open, pedido, defaultFormat]);

  const handlePrint = useCallback(() => {
    const root = printRef.current;
    if (!root) return;

    const w = window.open('', '_blank');
    if (!w) {
      console.error('Popup bloqueado. No se puede imprimir.');
      return;
    }

    const folio = resolvePedidoMaterialFolio(normalizedPedido);
    const inner = root.innerHTML;

    w.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Pedido ${folio}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${PRINT_LETTER_WINDOW_STYLES}
          </style>
        </head>
        <body>
          <div id="print-area">${inner}</div>
          <script>
            setTimeout(function () {
              window.print();
            }, 500);
          </script>
        </body>
      </html>
    `);
    w.document.close();
  }, [normalizedPedido]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 print:p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0 print:hidden space-y-0">
          <DialogTitle className="text-left">Vista previa de impresión</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center px-4 pb-3 border-b bg-gray-50 print:hidden shrink-0 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <label htmlFor="formato-pedido-select" className="font-semibold text-gray-700 text-sm">
              Formato:
            </label>
            <select
              id="formato-pedido-select"
              value={marca}
              onChange={(e) => setMarca(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="iihemsa">IIHEMSA</option>
              <option value="iihemsa_peninsular">IIHEMSA Peninsular</option>
              <option value="tesey">TESEY</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="bg-primary text-white px-4 py-2 rounded-md shadow hover:bg-primary/90 transition flex items-center gap-2"
            >
              <Printer className="w-4 h-4 shrink-0" />
              Imprimir pedido
            </button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 p-4 min-h-0 flex justify-center print:bg-white print:p-0">
          <div
            id="print-area"
            ref={printRef}
            className="w-full flex justify-center shadow-none print:shadow-none"
          >
            <PedidoMaterialPrint
              data={normalizedPedido}
              marca={marca}
              variant={marca === 'iihemsa' ? 'IIHEMSA' : 'TESEY'}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormatoPedidoImpresion;
