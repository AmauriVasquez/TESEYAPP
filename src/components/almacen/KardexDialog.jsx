import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, ClipboardCheck } from 'lucide-react';
import { fetchKardex } from '@/lib/inventarioApi';
import { formatDateTable } from '@/lib/dateUtils';
import { useToast } from '@/components/ui/use-toast';

const TIPO_META = {
  entrada: { label: 'Entrada', icon: ArrowDownToLine, cls: 'text-green-700 bg-green-50' },
  salida: { label: 'Salida', icon: ArrowUpFromLine, cls: 'text-red-700 bg-red-50' },
  ajuste: { label: 'Ajuste', icon: ClipboardCheck, cls: 'text-amber-700 bg-amber-50' },
};

const KardexDialog = ({ open, onOpenChange, material }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [movs, setMovs] = useState([]);

  useEffect(() => {
    if (!open || !material?.id) return;
    let cancelled = false;
    setLoading(true);
    fetchKardex(material.id)
      .then((data) => { if (!cancelled) setMovs(data); })
      .catch((err) => { if (!cancelled) toast({ variant: 'destructive', title: 'Error', description: err.message }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, material?.id, toast]);

  const unidad = material?.unidad_uso || 'u';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            Kardex
            <span className="block text-sm font-normal text-muted-foreground mt-0.5">
              {material?.clave ? `${material.clave} · ` : ''}{material?.descripcion}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : movs.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-500">Sin movimientos registrados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Antes → Después</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {movs.map((m) => {
                  const meta = TIPO_META[m.tipo] ?? { label: m.tipo, icon: ClipboardCheck, cls: 'text-gray-700 bg-gray-50' };
                  const Icon = meta.icon;
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDateTable(m.created_at)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
                          <Icon className="w-3 h-3" />{meta.label}
                        </span>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${Number(m.cantidad) < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {Number(m.cantidad) > 0 ? '+' : ''}{m.cantidad}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                        {m.existencia_antes} → <span className="font-semibold text-gray-900">{m.existencia_despues}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <div className="capitalize">{(m.motivo || '').replace(/_/g, ' ') || '—'}</div>
                        {(m.referencia || m.observaciones) && (
                          <div className="text-xs text-gray-400">{[m.referencia, m.observaciones].filter(Boolean).join(' · ')}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {!loading && movs.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">Cantidades y saldos en {unidad}.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default KardexDialog;
