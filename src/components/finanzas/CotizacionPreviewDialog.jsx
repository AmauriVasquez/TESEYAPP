// src/components/finanzas/CotizacionPreviewDialog.jsx
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';
import { empresaLabel } from '@/lib/facturacionDisplay';

export default function CotizacionPreviewDialog({ cotizacionId, open, onOpenChange }) {
  const [cot, setCot] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !cotizacionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: c }, { data: it }] = await Promise.all([
        supabase.from('cotizaciones').select('folio, descripcion, fecha, total, aplica_iva, estatus, branding, cliente:cliente_id(nombre), cliente_nombre_externo').eq('id', cotizacionId).single(),
        supabase.from('cotizaciones_items').select('descripcion, cantidad, unidad, precio_unitario').eq('cotizacion_id', cotizacionId).order('id'),
      ]);
      if (cancelled) return;
      setCot(c || null); setItems(it || []); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, cotizacionId]);

  const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto sm:w-full">
        <DialogHeader><DialogTitle>Cotización {cot?.folio ?? ''}</DialogTitle></DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : !cot ? (
          <p className="text-center py-6 text-gray-500">No se pudo cargar la cotización.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-500">Cliente:</span> {cot.cliente?.nombre ?? cot.cliente_nombre_externo ?? '—'}</div>
              <div><span className="text-gray-500">Empresa:</span> {empresaLabel(cot.branding)}</div>
              <div><span className="text-gray-500">Fecha:</span> {cot.fecha ?? '—'}</div>
              <div><span className="text-gray-500">Estatus:</span> {cot.estatus ?? '—'}</div>
            </div>
            <p className="text-gray-700">{cot.descripcion || ''}</p>
            <div className="border rounded overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600"><tr>
                  <th className="text-left p-2">Descripción</th><th className="p-2">Cant.</th><th className="p-2">Unidad</th><th className="text-right p-2">P. unitario</th>
                </tr></thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{it.descripcion}</td>
                      <td className="p-2 text-center">{it.cantidad}</td>
                      <td className="p-2 text-center">{it.unidad}</td>
                      <td className="p-2 text-right">{money(it.precio_unitario)}</td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-gray-400">Sin partidas.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end font-semibold">Total: {money(cot.total)} {cot.aplica_iva === false ? '(sin IVA)' : '(IVA incluido)'}</div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
