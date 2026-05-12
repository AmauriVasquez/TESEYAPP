import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, History } from 'lucide-react';
import { formatDateTable } from '@/lib/dateUtils';

/**
 * Modal de solo lectura que lista todas las versiones de una cotización (mismo folio).
 */
const HistorialVersionesModal = ({ open, onOpenChange, cotizacion }) => {
  const [versiones, setVersiones] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !cotizacion?.folio) {
      setVersiones([]);
      return;
    }
    setLoading(true);
    const baseFolio = cotizacion.folio.replace(/-V\d+$/, '');
    supabase
      .from('cotizaciones')
      .select('id, folio, version, total, fecha, estatus, es_ultima_version')
      .or(`folio.eq.${baseFolio},folio.like.${baseFolio}-V%`)
      .order('version', { ascending: true })
      .then(({ data, error }) => {
        setLoading(false);
        if (error) {
          setVersiones([]);
          return;
        }
        setVersiones(data || []);
      });
  }, [open, cotizacion?.folio]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Historial de versiones — {cotizacion?.folio}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : versiones.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No hay más versiones registradas.</p>
          ) : (
            <ul className="space-y-3">
              {versiones.map((v) => (
                <li
                  key={v.id}
                  className={`rounded-lg border p-3 text-sm ${v.es_ultima_version ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200 bg-gray-50/50'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-mono font-semibold">
                      {v.folio}
                      {v.es_ultima_version && <span className="ml-1.5 text-xs text-blue-600">(actual)</span>}
                    </span>
                    <span className="font-semibold text-gray-900">
                      {Number(v.total).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                    </span>
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>{formatDateTable(v.fecha)}</span>
                    <span className="capitalize">{v.estatus}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HistorialVersionesModal;
