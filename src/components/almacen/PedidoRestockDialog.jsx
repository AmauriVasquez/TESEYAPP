import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cantidadRestockSugerida, crearPedidoRestock } from '@/lib/inventarioApi';

/**
 * Dialog para generar un pedido de re-stock con las partidas en mínimos.
 * `materialesEnMinimos` ya viene filtrado por la página.
 */
const PedidoRestockDialog = ({ open, onOpenChange, materialesEnMinimos, onCreated }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [observaciones, setObservaciones] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setObservaciones('');
    setRows(
      (materialesEnMinimos ?? []).map((m) => {
        const sinMax = !(Number(m.stock_max) > 0);
        return {
          material: m,
          seleccionado: !sinMax,            // sin stock_max no se puede sugerir → desmarcado
          cantidad: cantidadRestockSugerida(m),
          sinMax,
        };
      })
    );
  }, [open, materialesEnMinimos]);

  const toggle = (id, val) =>
    setRows((prev) => prev.map((r) => (r.material.id === id ? { ...r, seleccionado: val } : r)));
  const setCantidad = (id, val) =>
    setRows((prev) => prev.map((r) => (r.material.id === id ? { ...r, cantidad: val } : r)));

  const seleccionados = useMemo(
    () => rows.filter((r) => r.seleccionado && Number(r.cantidad) > 0),
    [rows]
  );

  const handleSubmit = async () => {
    if (seleccionados.length === 0) {
      toast({ variant: 'destructive', title: 'Sin partidas', description: 'Selecciona al menos una partida con cantidad mayor a 0.' });
      return;
    }
    setSaving(true);
    try {
      const items = seleccionados.map((r) => ({
        material_id: r.material.id,
        cantidad: Number(r.cantidad),
        observaciones: 'Re-stock automático (mínimos)',
      }));
      const pedido = await crearPedidoRestock(items, observaciones.trim() || null);
      toast({ title: '✅ Pedido creado', description: `Folio ${pedido?.folio ?? ''} con ${items.length} partida(s).` });
      onCreated?.(pedido);
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'No se pudo crear el pedido', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="text-base">Pedido de re-stock (partidas en mínimos)</DialogTitle>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-center py-10 text-sm text-gray-500">No hay partidas en mínimos. 🎉</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b sticky top-0">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="px-2 py-2 w-8"></th>
                  <th className="px-2 py-2">Material</th>
                  <th className="px-2 py-2 text-right">Existencia</th>
                  <th className="px-2 py-2 text-right">Mín / Máx</th>
                  <th className="px-2 py-2 text-right">Pedir (compra)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => {
                  const m = r.material;
                  return (
                    <tr key={m.id} className={r.seleccionado ? 'bg-blue-50/40' : ''}>
                      <td className="px-2 py-2 align-top">
                        <Checkbox checked={r.seleccionado} disabled={r.sinMax}
                          onCheckedChange={(v) => toggle(m.id, !!v)} />
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-medium text-gray-900">{m.descripcion}</div>
                        <div className="text-xs text-gray-500">
                          {m.clave || 'Sin clave'} · compra: {m.unidad_compra || '—'}
                          {r.sinMax && (
                            <span className="ml-1 inline-flex items-center gap-1 text-amber-600">
                              <AlertTriangle className="w-3 h-3" /> sin stock máx.
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-red-600 font-semibold">
                        {m.existencias} {m.unidad_uso}
                      </td>
                      <td className="px-2 py-2 text-right text-gray-500 whitespace-nowrap">
                        {m.stock_min ?? '—'} / {m.stock_max ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Input
                          type="number" min="0" step="any" value={r.cantidad}
                          onChange={(e) => setCantidad(m.id, e.target.value)}
                          disabled={!r.seleccionado}
                          className="h-8 w-24 text-right ml-auto"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <Textarea
            rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Observaciones del pedido (opcional)"
          />
        </div>

        <DialogFooter className="pt-2">
          <span className="mr-auto self-center text-sm text-muted-foreground">
            {seleccionados.length} partida(s) seleccionada(s)
          </span>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={saving}>Cancelar</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={saving || seleccionados.length === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generar pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PedidoRestockDialog;
