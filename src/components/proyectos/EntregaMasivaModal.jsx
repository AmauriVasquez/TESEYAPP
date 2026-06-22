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
import { Loader2, Camera, X, Images } from 'lucide-react';

const sanitizeFilename = (f) => f.replace(/[^a-zA-Z0-9-_.]/g, '_');

function useIsMobile() {
  const [m, setM] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setM(mq.matches);
    apply(); mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return m;
}

// Editor de cantidades de UN proyecto (completa/parcial), reutilizando mapEntregaItemRow.
function ProyectoEditor({ proyecto, rows, loading, tipo, setTipo, cantidades, setCantidades, isMobile = false }) {
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
              <tr key={String(r.id)} className="border-t align-top">
                <td className="py-1">
                  <span className="block">{r.descripcion}</span>
                  {r.observaciones ? (
                    <span className="mt-0.5 block whitespace-pre-wrap break-words text-xs text-gray-500">
                      {r.observaciones}
                    </span>
                  ) : null}
                </td>
                <td className="py-1 text-right font-mono text-amber-800">{r.pendiente}</td>
                <td className="py-1">
                  <Input type="number" min={0} max={r.pendiente}
                    className={`text-right font-mono ${isMobile ? 'h-11 text-base' : 'h-8'}`}
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
  const isMobile = useIsMobile();
  const [porProyecto, setPorProyecto] = useState({}); // { [proyectoId]: { rows, loading, tipo, cantidades } }
  const [recibe, setRecibe] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [fotoFiles, setFotoFiles] = useState([]);       // File[]
  const [fotoPreviews, setFotoPreviews] = useState([]); // { id, url }[]
  const [saving, setSaving] = useState(false);
  const sigApiRef = useRef(null);

  // Clave estable de la selección (ids de proyecto). Evita que un re-render del
  // padre que recrea el array `proyectos` reinicie el formulario: al tomar la foto,
  // cerrar la cámara dispara 'focus' en window y algunos padres re-fetchean, lo que
  // cambiaba la identidad de `proyectos` y borraba nombre/comentarios/foto.
  const proyectosKey = proyectos.map((p) => p.id).join('|');

  // Cargar pendiente de cada proyecto al abrir (o si cambia el conjunto de proyectos)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const init = {};
    proyectos.forEach((p) => { init[p.id] = { rows: [], loading: true, tipo: 'completa', cantidades: {} }; });
    setPorProyecto(init);
    setRecibe(''); setComentarios(''); setFotoFiles([]);
    setFotoPreviews((prev) => { prev.forEach((p) => URL.revokeObjectURL(p.url)); return []; });

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
    // Dep en `proyectosKey` (string estable), no en el array `proyectos`, para no
    // reiniciar el formulario en re-renders incidentales del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proyectosKey]);

  const setTipo = useCallback((pid, tipo) =>
    setPorProyecto((prev) => ({ ...prev, [pid]: { ...prev[pid], tipo } })), []);
  const setCantidades = useCallback((pid, updater) =>
    setPorProyecto((prev) => ({ ...prev, [pid]: { ...prev[pid], cantidades: typeof updater === 'function' ? updater(prev[pid].cantidades) : updater } })), []);

  // Permite tomar foto (cámara) o elegir de la galería, una o varias a la vez.
  // Se acumulan: cada selección se agrega a las ya cargadas.
  const onFoto = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    setFotoFiles((prev) => [...prev, ...files]);
    setFotoPreviews((prev) => [
      ...prev,
      ...files.map((f, i) => ({ id: `${f.name}-${f.size}-${Date.now()}-${i}`, url: URL.createObjectURL(f) })),
    ]);
    // limpiar el input para poder volver a seleccionar el mismo archivo
    e.target.value = '';
  };

  const removeFoto = (idx) => {
    setFotoPreviews((prev) => {
      const p = prev[idx];
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((_, i) => i !== idx);
    });
    setFotoFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (saving) return;
    if (!recibe.trim()) {
      toast({ variant: 'destructive', title: 'Datos', description: 'Indica quién recibe la mercancía.' });
      return;
    }
    // Construir proyectos con al menos una cantidad > 0
    const proyectosPayload = proyectos
      .map((p) => {
        const st = porProyecto[p.id];
        const items = (st?.rows || [])
          .map((r) => ({ cotizacion_item_id: r.id, cantidad_entregada: Number(st.cantidades[r.id] || 0) }))
          .filter((it) => it.cantidad_entregada > 0);
        return { proyecto_id: p.id, cotizacion_id: p.cotizacion_id, items, folio: p.folio };
      })
      .filter((p) => p.items.length > 0);

    if (proyectosPayload.length === 0) {
      toast({ variant: 'destructive', title: 'Cantidades', description: 'Ningún proyecto tiene cantidades a entregar.' });
      return;
    }
    if (fotoFiles.length === 0) {
      toast({ variant: 'destructive', title: 'Foto requerida', description: 'Agrega al menos una foto de la entrega.' });
      return;
    }
    const sig = sigApiRef.current;
    if (!sig || sig.isEmpty()) {
      toast({ variant: 'destructive', title: 'Firma requerida', description: 'Se necesita la firma de recibido.' });
      return;
    }

    setSaving(true);
    try {
      // Subir foto(s) y firma UNA sola vez (carpeta del primer proyecto)
      const refId = proyectosPayload[0].proyecto_id;
      const fotoUrls = [];
      for (const f of fotoFiles) {
        const url = await uploadEntregaImage(f, refId, sanitizeFilename);
        if (url) fotoUrls.push(url);
      }
      if (fotoUrls.length === 0) throw new Error('No se pudieron subir las fotos.');
      // 1 foto → URL simple (retrocompatible); varias → JSON de URLs en el mismo campo.
      const fotoUrl = fotoUrls.length === 1 ? fotoUrls[0] : JSON.stringify(fotoUrls);

      const dataUrl = sig.toDataURL();
      if (!dataUrl) throw new Error('No se pudo leer la firma.');
      const blob = await (await fetch(dataUrl)).blob();
      const firmaPath = `entregas/masiva/${Date.now()}_firma.png`;
      const { error: firmaErr } = await supabase.storage.from('proyecto_archivos').upload(firmaPath, blob, { contentType: 'image/png' });
      if (firmaErr) throw new Error(`Error al subir la firma: ${firmaErr.message}`);
      const firmaUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(firmaPath).data.publicUrl;

      const payload = {
        recibe_nombre: recibe.trim(),
        comentarios: comentarios.trim() || null,
        firma_url: firmaUrl,
        foto_url: fotoUrl,
        proyectos: proyectosPayload.map(({ proyecto_id, cotizacion_id, items }) => ({ proyecto_id, cotizacion_id, items })),
      };

      const { data, error } = await supabase.rpc('registrar_entrega_masiva', { payload });
      if (error) throw new Error(error.message);

      // Notificar Telegram por cada proyecto que quedó completo
      const completos = (data?.entregas || []).filter((e) => e.completo);
      completos.forEach((e) => {
        const p = proyectos.find((x) => x.id === e.proyecto_id);
        notifyProjectFinishedOrDelivered({
          folio: p?.folio || 'Sin folio',
          cliente_nombre: p?.cliente_nombre || 'Sin cliente',
          estatus: 'Entregado',
        });
      });

      toast({ title: 'Entrega masiva registrada', description: `${proyectosPayload.length} proyecto(s) actualizados.` });
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al guardar', description: err?.message ?? 'No se pudo completar.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={isMobile
          ? 'flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-3 !overflow-hidden !p-3 !left-0 !top-0 !translate-x-0 !translate-y-0 rounded-none border-0'
          : 'flex max-h-[90vh] max-w-3xl flex-col gap-4'}
      >
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
                isMobile={isMobile}
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
              <Label>Fotos de entrega * {fotoFiles.length > 0 ? `(${fotoFiles.length})` : ''}</Label>
              <div className="flex gap-2">
                <label htmlFor="foto-camara" className="flex flex-1 min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/30 px-3 py-3 text-sm font-medium text-teal-900">
                  <Camera className="h-5 w-5" /> Tomar foto
                  <input id="foto-camara" type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFoto} />
                </label>
                <label htmlFor="foto-galeria" className="flex flex-1 min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/30 px-3 py-3 text-sm font-medium text-blue-900">
                  <Images className="h-5 w-5" /> Galería
                  <input id="foto-galeria" type="file" accept="image/*" multiple className="sr-only" onChange={onFoto} />
                </label>
              </div>
              <p className="text-[11px] text-gray-500">Toma una foto con la cámara o elige una o varias de la galería.</p>
              {fotoPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {fotoPreviews.map((p, idx) => (
                    <div key={p.id} className="relative">
                      <img src={p.url} alt={`Evidencia ${idx + 1}`} className="h-20 w-20 rounded-lg border object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFoto(idx)}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow"
                        aria-label={`Quitar foto ${idx + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Firma de recibido *</Label>
              <SignaturePad open={open} apiRef={sigApiRef} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}
            className={`gap-2 bg-teal-600 hover:bg-teal-700 ${isMobile ? 'h-12 text-base' : ''}`}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
