import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { recibirItemOc, recibirOcCompleta } from '@/lib/ordenesCompraRecepcion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEM_ESTADO_BADGE = {
  completo: 'bg-green-100 text-green-800 border-green-300',
  parcial: 'bg-amber-100 text-amber-800 border-amber-300',
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
};

function itemRecepcionEstado(cantidad, recibida) {
  const c = Number(cantidad) || 0;
  const r = Number(recibida) || 0;
  if (c > 0 && r >= c) return { key: 'completo', label: 'Completo' };
  if (r > 0) return { key: 'parcial', label: 'Parcial' };
  return { key: 'pendiente', label: 'Pendiente' };
}

/**
 * Recepción de materiales por partidas (ordenes_compra_items).
 * Actualiza cantidad_recibida, estado_entrega de la OC y sincroniza pedido si aplica.
 */
export default function OCRecepcionMaterial({ oc, onUpdate }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [recibirTodoLoading, setRecibirTodoLoading] = useState(false);
  const [recibirHoy, setRecibirHoy] = useState({});

  const fetchItems = useCallback(async () => {
    if (!oc?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_items')
        .select('id, descripcion, cantidad, cantidad_recibida, precio_unitario')
        .eq('orden_compra_id', oc.id)
        .order('id');
      if (error) throw error;
      setItems(data ?? []);
    } catch (err) {
      console.error('Error en OCRecepcionMaterial fetch:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las partidas.' });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [oc?.id, toast]);

  useEffect(() => {
    if (oc?.id) fetchItems();
  }, [oc?.id, fetchItems]);

  const todosCompletos = useMemo(
    () =>
      items.length > 0 &&
      items.every((i) => {
        const c = Number(i.cantidad) || 0;
        const r = Number(i.cantidad_recibida) || 0;
        return c <= 0 || r >= c;
      }),
    [items]
  );

  const handleRecibirFila = async (row) => {
    const cant = Number(row.cantidad) || 0;
    const rec = Number(row.cantidad_recibida) || 0;
    const pendiente = Math.max(0, cant - rec);
    const raw = recibirHoy[row.id];
    const v = parseFloat(typeof raw === 'string' ? raw.replace(',', '.') : raw);
    if (!Number.isFinite(v) || v <= 0) {
      toast({ variant: 'destructive', title: 'Cantidad inválida', description: 'Indica cuánto recibes hoy (mayor a cero).' });
      return;
    }
    if (v > pendiente + 1e-9) {
      toast({
        variant: 'destructive',
        title: 'No se puede recibir de más',
        description: `Máximo pendiente en esta partida: ${pendiente}`,
      });
      return;
    }
    setUpdatingId(row.id);
    try {
      const res = await recibirItemOc(supabase, row.id, v);
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Error', description: res.error?.message ?? 'No se pudo registrar la recepción.' });
        return;
      }
      setRecibirHoy((prev) => ({ ...prev, [row.id]: '' }));
      await fetchItems();
      onUpdate?.();
      toast({
        title: 'Recepción registrada',
        description: res.aplicada != null ? `Se recibieron ${res.aplicada} unidad(es).` : 'Partida actualizada.',
      });
    } catch (err) {
      console.error('Error en recibirItemOc:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo registrar la recepción.' });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRecibirTodo = async () => {
    if (!oc?.id || items.length === 0) return;
    setRecibirTodoLoading(true);
    try {
      await recibirOcCompleta(supabase, oc.id);
      setRecibirHoy({});
      await fetchItems();
      onUpdate?.();
      toast({ title: 'Recepción completa', description: 'Todas las partidas quedaron al 100 % recibidas.' });
    } catch (err) {
      console.error('Error en recibirOcCompleta:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo completar la recepción.' });
    } finally {
      setRecibirTodoLoading(false);
    }
  };

  if (!oc) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Recepción de materiales</CardTitle>
        {items.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleRecibirTodo}
            disabled={todosCompletos || recibirTodoLoading || loading}
          >
            {recibirTodoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Recibir todo
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right w-28">Cant. pedida</TableHead>
                  <TableHead className="text-right w-28">Cant. recibida</TableHead>
                  <TableHead className="w-36">Recibir hoy</TableHead>
                  <TableHead className="w-28 text-center">Estado</TableHead>
                  <TableHead className="w-28 text-right"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      Esta orden no tiene partidas registradas. La recepción se gestiona por línea de la OC.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((row) => {
                    const cant = Number(row.cantidad) || 0;
                    const rec = Number(row.cantidad_recibida) || 0;
                    const pendiente = Math.max(0, cant - rec);
                    const est = itemRecepcionEstado(cant, rec);
                    const completo = est.key === 'completo';
                    const busy = updatingId === row.id;
                    return (
                      <TableRow key={row.id} className={cn(completo && 'bg-green-50/80')}>
                        <TableCell className="font-medium">{row.descripcion ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{cant}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">{rec}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={pendiente || undefined}
                            step="any"
                            className="h-8 w-full max-w-[7rem]"
                            placeholder="0"
                            value={recibirHoy[row.id] ?? ''}
                            onChange={(e) => setRecibirHoy((p) => ({ ...p, [row.id]: e.target.value }))}
                            disabled={completo || busy || loading}
                            title={completo ? 'Partida completa' : `Pendiente máx.: ${pendiente}`}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn('font-normal whitespace-nowrap border', ITEM_ESTADO_BADGE[est.key])}>
                            {est.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => handleRecibirFila(row)}
                            disabled={completo || busy || loading}
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Recibir'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
