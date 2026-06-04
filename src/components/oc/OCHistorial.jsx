import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { fetchHistorialOC } from '@/lib/comprasExtras';
import { formatDateTable } from '@/lib/dateUtils';
import { History, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * Visor del historial de versiones/cambios de una OC.
 * Defensivo: si la tabla `ordenes_compra_historial` no existe aún, no muestra nada.
 */
export default function OCHistorial({ oc, refreshKey }) {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({});

  const ocId = oc?.id;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = ocId ? await fetchHistorialOC(ocId) : [];
      if (!cancelled) setRows(data);
    })();
    return () => { cancelled = true; };
  }, [ocId, refreshKey]);

  if (!oc?.id || rows.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-800 w-full"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <History className="w-4 h-4 text-gray-500" />
          Historial de cambios ({rows.length})
        </button>
        {open && (
          <ul className="mt-3 space-y-2">
            {rows.map((h) => {
              const isOpen = !!expanded[h.id];
              const cambios = h.cambios && typeof h.cambios === 'object' ? h.cambios : null;
              return (
                <li key={h.id} className="border rounded-md p-3 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono font-semibold">v{h.version}</span>
                    <span className="text-gray-500">{h.created_at ? formatDateTable(h.created_at) : ''}</span>
                  </div>
                  <p className="mt-1"><span className="text-gray-500">Razón:</span> {h.razon}</p>
                  {h.usuario_nombre && <p className="text-gray-500 text-xs mt-0.5">Por: {h.usuario_nombre}</p>}
                  {cambios && Object.keys(cambios).length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [h.id]: !e[h.id] }))}
                        className="text-xs text-blue-600 mt-1"
                      >
                        {isOpen ? 'Ocultar detalle' : 'Ver detalle de cambios'}
                      </button>
                      {isOpen && (
                        <pre className="mt-2 bg-gray-50 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap break-words">
                          {JSON.stringify(cambios, null, 2)}
                        </pre>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
