import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { registrarHistorialOC } from '@/lib/comprasExtras';
import { Loader2 } from 'lucide-react';

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

/**
 * Edición de una OC con versión + razón. Permite ajustar descripción/observaciones
 * de la OC y la cantidad/precio/descripción de cada partida. Al guardar:
 *  - incrementa ordenes_compra.version,
 *  - registra una entrada en ordenes_compra_historial (razón + snapshot + diff).
 * La razón es obligatoria. Defensivo: si falta la tabla de historial, igual guarda
 * los cambios de la OC (el versionado de historial degrada silenciosamente).
 */
const EditarOCModal = ({ open, onOpenChange, oc, onSaved }) => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [razon, setRazon] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [items, setItems] = useState([]);
  const [original, setOriginal] = useState(null);

  const load = useCallback(async () => {
    if (!open || !oc?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra_items')
        .select('id, descripcion, unidad, cantidad, precio_unitario, importe, material_id, pedido_item_id, clave, notas')
        .eq('orden_compra_id', oc.id);
      if (error) throw error;
      const rows = (data ?? []).map((it) => ({
        id: it.id,
        descripcion: it.descripcion ?? '',
        unidad: it.unidad ?? '',
        cantidad: it.cantidad ?? 0,
        precio_unitario: it.precio_unitario ?? 0,
        material_id: it.material_id ?? null,
        pedido_item_id: it.pedido_item_id ?? null,
        clave: it.clave ?? null,
        notas: it.notas ?? null,
      }));
      setItems(rows);
      setDescripcion(oc.descripcion_pedido ?? oc.descripcion ?? '');
      setObservaciones(oc.observaciones ?? '');
      setRazon('');
      setOriginal({
        descripcion: oc.descripcion_pedido ?? oc.descripcion ?? '',
        observaciones: oc.observaciones ?? '',
        items: rows.map((r) => ({ id: r.id, descripcion: r.descripcion, cantidad: Number(r.cantidad) || 0, precio_unitario: Number(r.precio_unitario) || 0 })),
      });
    } catch (err) {
      console.error('Error cargando OC para editar:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las partidas de la OC.' });
    } finally {
      setLoading(false);
    }
  }, [open, oc?.id, oc?.descripcion, oc?.descripcion_pedido, oc?.observaciones, toast]);

  useEffect(() => { load(); }, [load]);

  const updateItem = (id, field, value) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));

  const subtotal = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0);

  const buildCambios = () => {
    const cambios = {};
    if (!original) return cambios;
    if ((original.descripcion ?? '') !== (descripcion ?? '')) {
      cambios.descripcion = { antes: original.descripcion ?? '', despues: descripcion ?? '' };
    }
    if ((original.observaciones ?? '') !== (observaciones ?? '')) {
      cambios.observaciones = { antes: original.observaciones ?? '', despues: observaciones ?? '' };
    }
    const itemDiffs = [];
    for (const it of items) {
      const before = original.items.find((o) => o.id === it.id);
      if (!before) continue;
      const after = { descripcion: it.descripcion ?? '', cantidad: Number(it.cantidad) || 0, precio_unitario: Number(it.precio_unitario) || 0 };
      if (before.descripcion !== after.descripcion || before.cantidad !== after.cantidad || before.precio_unitario !== after.precio_unitario) {
        itemDiffs.push({ id: it.id, antes: before, despues: after });
      }
    }
    if (itemDiffs.length > 0) cambios.partidas = itemDiffs;
    return cambios;
  };

  const handleSave = async () => {
    if (!(razon ?? '').trim()) {
      toast({ variant: 'destructive', title: 'Razón requerida', description: 'Indica la razón del cambio para versionar la OC.' });
      return;
    }
    const cambios = buildCambios();
    if (Object.keys(cambios).length === 0) {
      toast({ variant: 'destructive', title: 'Sin cambios', description: 'No hay modificaciones que guardar.' });
      return;
    }
    setSaving(true);
    try {
      // 1) Actualizar partidas modificadas.
      for (const it of items) {
        const before = original?.items.find((o) => o.id === it.id);
        const qty = Number(it.cantidad) || 0;
        const pu = Number(it.precio_unitario) || 0;
        if (!before || (before.descripcion === (it.descripcion ?? '') && before.cantidad === qty && before.precio_unitario === pu)) continue;
        const { error } = await supabase
          .from('ordenes_compra_items')
          .update({ descripcion: (it.descripcion ?? '').trim() || '—', cantidad: qty, precio_unitario: pu, importe: qty * pu })
          .eq('id', it.id);
        if (error) throw error;
      }

      // 2) Incrementar versión y actualizar campos de cabecera.
      const nuevaVersion = (Number(oc.version) || 1) + 1;
      const headerUpdate = { version: nuevaVersion, observaciones: (observaciones ?? '').trim() || null };
      // descripcion_pedido es la columna real; descripcion puede no existir en algunos esquemas.
      headerUpdate.descripcion_pedido = (descripcion ?? '').trim() || null;
      let upd = await supabase.from('ordenes_compra').update(headerUpdate).eq('id', oc.id);
      if (upd.error) {
        const msg = String(upd.error?.message ?? '').toLowerCase();
        // Reintentos defensivos si una columna no existe en el esquema.
        if (msg.includes('descripcion_pedido')) {
          delete headerUpdate.descripcion_pedido;
          headerUpdate.descripcion = (descripcion ?? '').trim() || null;
          upd = await supabase.from('ordenes_compra').update(headerUpdate).eq('id', oc.id);
        }
        if (upd.error && String(upd.error?.message ?? '').toLowerCase().includes('version')) {
          delete headerUpdate.version;
          upd = await supabase.from('ordenes_compra').update(headerUpdate).eq('id', oc.id);
        }
        if (upd.error) throw upd.error;
      }

      // 3) Registrar historial (no bloqueante).
      await registrarHistorialOC({
        ocId: oc.id,
        version: nuevaVersion,
        razon,
        cambios,
        snapshot: { descripcion, observaciones, items },
        usuarioId: authUser?.id ?? null,
        usuarioNombre: authUser?.user_metadata?.full_name ?? authUser?.email ?? null,
      });

      toast({ title: 'OC actualizada', description: `Nueva versión v${nuevaVersion} registrada con su razón.` });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error al editar OC:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo guardar la edición.' });
    } finally {
      setSaving(false);
    }
  };

  if (!oc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar OC {oc.folio_oc ?? oc.folio ?? ''} (nueva versión)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          <div>
            <Label>Razón del cambio *</Label>
            <Textarea
              value={razon}
              onChange={(e) => setRazon(e.target.value)}
              placeholder="Ej. Corrección de precio acordado con el proveedor"
              rows={2}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Descripción del pedido</Label>
              <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Partidas</Label>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>
            ) : (
              <div className="border rounded-lg overflow-x-auto mt-1">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium">Descripción</th>
                      <th className="text-center px-2 py-2 font-medium w-20">Unidad</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Cantidad</th>
                      <th className="text-right px-2 py-2 font-medium w-28">Precio unit.</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-gray-500 py-6">Sin partidas.</td></tr>
                    ) : (
                      items.map((it) => {
                        const importe = (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0);
                        return (
                          <tr key={it.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2">
                              <Input value={it.descripcion} onChange={(e) => updateItem(it.id, 'descripcion', e.target.value)} className="h-8" />
                            </td>
                            <td className="px-2 py-2 text-center">{it.unidad || '—'}</td>
                            <td className="px-2 py-2">
                              <Input type="number" min={0} step="any" value={it.cantidad} onChange={(e) => updateItem(it.id, 'cantidad', e.target.value)} className="h-8 w-20 text-right" />
                            </td>
                            <td className="px-2 py-2">
                              <Input type="number" min={0} step="0.01" value={it.precio_unitario} onChange={(e) => updateItem(it.id, 'precio_unitario', e.target.value)} className="h-8 w-24 text-right" />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">{formatCurrency(importe)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-2 text-sm">
              <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || loading || !(razon ?? '').trim()} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Guardar nueva versión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditarOCModal;
