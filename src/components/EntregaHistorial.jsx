import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/**
 * Historial de entregas (`entregas` + `entregas_items`) por proyecto.
 * Dependencia estable: proyectoId + reloadNonce.
 */
export default function EntregaHistorial({
  proyectoId,
  reloadNonce = 0,
  /** Si es false, no se muestra el botón de cancelar (solo entregas activas son cancelables). */
  puedeCancelarEntrega = true,
  onEntregaCancelled,
}) {
  const { toast } = useToast();
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancelandoId, setCancelandoId] = useState(null);

  useEffect(() => {
    if (proyectoId == null || proyectoId === '') {
      setHistorial([]);
      return;
    }

    let active = true;

    const fetchHistorial = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('entregas')
          .select(
            `
            id,
            fecha,
            estado,
            recibe_nombre,
            comentarios,
            foto_url,
            firma_url,
            entregas_items (
              cantidad_entregada,
              cotizacion_item_id
            )
          `
          )
          .eq('proyecto_id', proyectoId)
          .order('fecha', { ascending: false });

        if (!active) return;
        if (error) throw error;
        setHistorial(data || []);
      } catch (e) {
        console.error('EntregaHistorial:', e);
        if (active) setHistorial([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchHistorial();

    return () => {
      active = false;
    };
  }, [proyectoId, reloadNonce]);

  const handleCancelarEntrega = async (entregaId) => {
    if (!puedeCancelarEntrega || cancelandoId) return;
    if (
      !window.confirm(
        '¿Cancelar esta entrega?\n\nLas cantidades dejarán de contarse en el pendiente del proyecto. El registro seguirá en el historial como cancelado.'
      )
    ) {
      return;
    }

    setCancelandoId(entregaId);
    try {
      const { data: updated, error } = await supabase
        .from('entregas')
        .update({ estado: 'cancelada' })
        .eq('id', entregaId)
        .eq('estado', 'activa')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!updated) {
        toast({
          variant: 'destructive',
          title: 'No aplicado',
          description: 'La entrega ya estaba cancelada o no existe.',
        });
        return;
      }

      const { error: syncErr } = await supabase.rpc('sync_proyecto_estado_entregas', {
        p_proyecto_id: proyectoId,
      });
      if (syncErr) {
        console.error(syncErr);
        toast({
          variant: 'destructive',
          title: 'Estado del proyecto',
          description:
            'La entrega se marcó cancelada, pero no se pudo recalcular el estatus del proyecto. Recarga la página o revisa el RPC sync_proyecto_estado_entregas.',
        });
      } else {
        toast({
          title: 'Entrega cancelada',
          description: 'Pendientes y estatus del proyecto actualizados. El historial conserva el registro.',
        });
      }

      onEntregaCancelled?.();
    } catch (e) {
      console.error(e);
      window.alert('Error al cancelar');
    } finally {
      setCancelandoId(null);
    }
  };

  if (proyectoId == null || proyectoId === '') return null;

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm">
      <h3 className="font-bold text-lg mb-3">Historial de entregas</h3>
      {loading ? (
        <div className="flex justify-center py-8 text-gray-500">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : historial.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">Aún no hay entregas registradas en este proyecto.</p>
      ) : (
        <ul className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {historial.map((row) => {
            const fechaRaw = row.fecha;
            const fechaFmt =
              fechaRaw &&
              (() => {
                try {
                  return format(parseISO(fechaRaw), 'Pp', { locale: es });
                } catch {
                  return String(fechaRaw);
                }
              })();
            const partidas = row.entregas_items ?? [];
            const totalPiezas = partidas.reduce((s, it) => s + Number(it.cantidad_entregada ?? 0), 0);
            const cancelando = cancelandoId === row.id;
            const estadoRow = row.estado ?? 'activa';
            const esActiva = estadoRow === 'activa';
            return (
              <li
                key={row.id}
                className={cn(
                  'text-sm space-y-2 rounded-lg border p-3',
                  esActiva ? 'border-gray-200 bg-gray-50/80' : 'border-red-100 bg-red-50/40 opacity-90'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="mb-0">
                        <span className="font-semibold text-gray-700">Recibe:</span> {row.recibe_nombre ?? '—'}
                      </p>
                      {!esActiva ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Cancelada</span>
                      ) : null}
                    </div>
                    {fechaFmt ? (
                      <p>
                        <span className="font-semibold text-gray-700">Fecha:</span> {fechaFmt}
                      </p>
                    ) : null}
                    {row.comentarios ? (
                      <p>
                        <span className="font-semibold text-gray-700">Comentarios:</span> {row.comentarios}
                      </p>
                    ) : null}
                    <p className="text-xs text-gray-600">
                      Partidas: {partidas.length} · Unidades registradas (suma): {totalPiezas}
                      {!esActiva ? (
                        <span className="ml-1 font-medium text-red-600"> · No suman al pendiente</span>
                      ) : null}
                    </p>
                    {row.foto_url ? (
                      <div className="mt-2">
                        <p className="mb-1 text-xs font-semibold text-gray-700">Foto de entrega</p>
                        <a href={row.foto_url} target="_blank" rel="noopener noreferrer" className="inline-block max-w-full">
                          <img
                            src={row.foto_url}
                            alt="Evidencia de entrega"
                            className="max-h-40 w-full max-w-xs rounded-lg border object-cover"
                          />
                        </a>
                      </div>
                    ) : null}
                    {row.firma_url ? (
                      <a href={row.firma_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1">
                        <img src={row.firma_url} alt="Firma" className="max-h-24 border rounded bg-white" />
                      </a>
                    ) : null}
                  </div>
                  {puedeCancelarEntrega && esActiva ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1 border-red-200 text-red-700 hover:bg-red-50"
                      disabled={cancelando}
                      onClick={() => handleCancelarEntrega(row.id)}
                    >
                      {cancelando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      Cancelar entrega
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
