// src/components/proyectos/EntregaMasivaModal.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { uploadEntregaImage } from '@/lib/entregaUpload';
import { notifyProjectFinishedOrDelivered } from '@/services/TelegramService';
import { mapEntregaItemRow } from '@/components/EntregaModal';
import SignaturePad from '@/components/proyectos/SignaturePad';
import { Loader2, Camera } from 'lucide-react';

const sanitizeFilename = (f) => f.replace(/[^a-zA-Z0-9-_.]/g, '_');

// Editor de cantidades de UN proyecto (completa/parcial), reutilizando mapEntregaItemRow.
function ProyectoEditor({ proyecto, rows, loading, tipo, setTipo, cantidades, setCantidades }) {
  const setQty = (itemId, max, value) => {
    if (value === '') return setCantidades((p) => ({ ...p, [itemId]: '' }));
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > max) return;
    setCantidades((p) => ({ ...p, [itemId]: n }));
  };
  const marcarCompleto = () => {
    const next = {};
    rows.forEach((r) => { if (r.pendiente > 0) next[r.id] = r.pendiente; });
    setCantidades(next);
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-800">{proyecto.folio} · {proyecto.descripcion}</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={tipo === 'completa' ? 'default' : 'outline'}
            onClick={() => { setTipo('completa'); marcarCompleto(); }}>Completa</Button>
          <Button type="button" size="sm" variant={tipo === 'parcial' ? 'default' : 'outline'}
            onClick={() => { setTipo('parcial'); setCantidades({}); }}>Parcial</Button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-gray-500">Sin partidas pendientes.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500">
            <th className="text-left">Descripción</th><th className="w-20 text-right">Pend.</th><th className="w-24 text-right">Entregar</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-t">
                <td className="py-1">{r.descripcion}</td>
                <td className="py-1 text-right font-mono text-amber-800">{r.pendiente}</td>
                <td className="py-1">
                  <Input type="number" min={0} max={r.pendiente} className="h-8 text-right font-mono"
                    value={cantidades[r.id] ?? ''} disabled={tipo === 'completa' || r.pendiente <= 0}
                    onChange={(e) => setQty(r.id, r.pendiente, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EntregaMasivaModal({ open, onOpenChange, proyectos = [], onSuccess }) {
  const { toast } = useToast();
  const [porProyecto, setPorProyecto] = useState({}); // { [proyectoId]: { rows, loading, tipo, cantidades } }
  const [recibe, setRecibe] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const sigApiRef = useRef(null);
  const fotoInputRef = useRef(null);

  // Cargar pendiente de cada proyecto al abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const init = {};
    proyectos.forEach((p) => { init[p.id] = { rows: [], loading: true, tipo: 'completa', cantidades: {} }; });
    setPorProyecto(init);
    setRecibe(''); setComentarios(''); setFotoFile(null);
    setFotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });

    (async () => {
      for (const p of proyectos) {
        const { data, error } = await supabase.rpc('get_items_con_pendiente', { cotizacion_id_input: p.cotizacion_id });
        if (cancelled) return;
        const rows = (error || !Array.isArray(data) ? [] : data.map(mapEntregaItemRow)).filter((r) => r.pendiente > 0);
        const cantidades = {};
        rows.forEach((r) => { cantidades[r.id] = r.pendiente; }); // default completa
        setPorProyecto((prev) => ({ ...prev, [p.id]: { rows, loading: false, tipo: 'completa', cantidades } }));
      }
    })();
    return () => { cancelled = true; };
  }, [open, proyectos]);

  const setTipo = useCallback((pid, tipo) =>
    setPorProyecto((prev) => ({ ...prev, [pid]: { ...prev[pid], tipo } })), []);
  const setCantidades = useCallback((pid, updater) =>
    setPorProyecto((prev) => ({ ...prev, [pid]: { ...prev[pid], cantidades: typeof updater === 'function' ? updater(prev[pid].cantidades) : updater } })), []);

  const onFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setFotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
    setFotoFile(f);
  };

  // (handleSave se implementa en Task 6)
  const handleSave = async () => {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4">
        <DialogHeader><DialogTitle>Entrega masiva ({proyectos.length} proyectos)</DialogTitle></DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-1">
          {proyectos.map((p) => {
            const st = porProyecto[p.id] || { rows: [], loading: true, tipo: 'completa', cantidades: {} };
            return (
              <ProyectoEditor
                key={p.id}
                proyecto={p}
                rows={st.rows}
                loading={st.loading}
                tipo={st.tipo}
                setTipo={(t) => setTipo(p.id, t)}
                cantidades={st.cantidades}
                setCantidades={(u) => setCantidades(p.id, u)}
              />
            );
          })}

          <div className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50/60 p-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="recibe-masiva">Quién recibe *</Label>
              <Input id="recibe-masiva" value={recibe} onChange={(e) => setRecibe(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="com-masiva">Comentarios</Label>
              <textarea id="com-masiva" value={comentarios} onChange={(e) => setComentarios(e.target.value)}
                className="min-h-[60px] w-full rounded-md border px-3 py-2 text-sm" placeholder="Opcional" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="foto-masiva">Foto de entrega *</Label>
              <label htmlFor="foto-masiva" className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/30 px-4 py-3 text-sm font-medium text-teal-900">
                <Camera className="h-5 w-5" /> Tomar o elegir foto
                <input id="foto-masiva" ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFoto} />
              </label>
              {fotoPreview && <img src={fotoPreview} alt="Vista previa" className="mt-2 max-h-40 w-full max-w-xs rounded-lg border object-cover" />}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Firma de recibido *</Label>
              <SignaturePad open={open} apiRef={sigApiRef} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
