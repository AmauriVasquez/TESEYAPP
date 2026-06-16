import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { notifyProjectFinishedOrDelivered } from '@/services/TelegramService';
import { Loader2, ChevronLeft, Package, Layers, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadEntregaImage } from '@/lib/entregaUpload';
import SignaturePad from '@/components/proyectos/SignaturePad';

const MOBILE_MAX_PX = 767;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_PX}px)`);
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return isMobile;
}

/** Normaliza fila del RPC a campos de UI (sin mutar el objeto original en el padre). */
export function mapEntregaItemRow(row) {
  const id = row.id ?? row.cotizacion_item_id;
  let pendiente = row.pendiente ?? row.cantidad_pendiente;
  if (pendiente == null) {
    const total = Number(row.total ?? row.cantidad ?? row.cantidad_total ?? 0);
    const ent = Number(row.entregado ?? row.cantidad_entregada ?? 0);
    pendiente = Math.max(0, total - ent);
  } else {
    pendiente = Number(pendiente);
  }
  return {
    id,
    descripcion: row.descripcion ?? row.desc ?? '—',
    observaciones: row.observaciones ?? row.observacion ?? '',
    total: Number(row.total ?? row.cantidad ?? row.cantidad_total ?? 0),
    entregado: Number(row.entregado ?? row.cantidad_entregada ?? 0),
    pendiente,
  };
}

const mobileBarClass =
  'shrink-0 border-t border-gray-200 bg-white px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_24px_rgba(0,0,0,0.06)]';

function TipoEntregaBadge({ tipoEntrega }) {
  if (tipoEntrega === 'parcial') {
    return (
      <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">Parcial</span>
    );
  }
  if (tipoEntrega === 'completa') {
    return (
      <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">Completa</span>
    );
  }
  return null;
}

/** Misma acción en móvil y desktop; solo cambia densidad visual. */
function SelectorTipoEntrega({ layout, onSelectCompleta, onSelectParcial }) {
  const mobile = layout === 'mobile';
  return (
    <div className={cn('space-y-4', !mobile && 'sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0')}>
      <h2 className={cn('font-semibold text-gray-900', mobile ? 'text-xl' : 'text-lg sm:col-span-2')}>
        Tipo de entrega
      </h2>
      <p className={cn('text-gray-500', mobile ? 'text-sm' : 'text-sm sm:col-span-2')}>
        Elige cómo registrar esta salida.
      </p>
      <button
        type="button"
        onClick={onSelectCompleta}
        className={cn(
          'flex w-full items-center gap-4 rounded-2xl border-2 border-gray-100 bg-gray-50 p-5 text-left transition active:scale-[0.99] active:bg-gray-100',
          !mobile && 'p-4'
        )}
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
          <Package className="h-7 w-7" />
        </span>
        <span>
          <span className="block text-lg font-semibold text-gray-900">Entrega completa</span>
          <span className="mt-1 block text-sm text-gray-600">Todo el material pendiente</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onSelectParcial}
        className={cn(
          'flex w-full items-center gap-4 rounded-2xl border-2 border-gray-100 bg-white p-5 text-left transition active:scale-[0.99] active:bg-gray-50',
          !mobile && 'p-4'
        )}
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-white">
          <Layers className="h-7 w-7" />
        </span>
        <span>
          <span className="block text-lg font-semibold text-gray-900">Entrega parcial</span>
          <span className="mt-1 block text-sm text-gray-600">Indica cantidades por partida</span>
        </span>
      </button>
    </div>
  );
}

function ConfirmacionEntregaCompleta({ rows }) {
  const conPendiente = rows.filter((r) => Number(r.pendiente) > 0);
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-emerald-900">
      <p className="font-semibold text-emerald-800">Se entregará todo el material pendiente</p>
      <p className="mt-2 text-sm text-emerald-800/90">
        {conPendiente.length} partida{conPendiente.length !== 1 ? 's' : ''} con saldo pendiente.
      </p>
      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-emerald-900/90">
        {conPendiente.map((r) => (
          <li key={String(r.id)} className="flex justify-between gap-2 border-b border-emerald-100/80 py-1 last:border-0">
            <span className="min-w-0 flex-1 truncate">{r.descripcion}</span>
            <span className="shrink-0 font-mono tabular-nums">{r.pendiente}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TablaItemsEntregaDesktop({ rows, entrega, completos, tipoEntrega, onCantidadChange, onLineaCompletaChange }) {
  const inputsBloqueados = tipoEntrega === 'completa';
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b bg-gray-100">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Descripción</th>
            <th className="w-24 px-2 py-2 text-right font-medium">Total</th>
            <th className="w-24 px-2 py-2 text-right font-medium">Entregado</th>
            <th className="w-24 px-2 py-2 text-right font-medium">Pendiente</th>
            <th className="w-36 px-2 py-2 text-center font-medium">Todo pend.</th>
            <th className="w-32 px-2 py-2 text-center font-medium">Esta entrega</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((item) => {
            const lineaCompleta = !!completos[item.id];
            const pendBloqueado = inputsBloqueados || item.pendiente <= 0;
            return (
              <tr key={String(item.id)} className="hover:bg-gray-50/80">
                <td className="px-3 py-2 align-middle">
                  <div>{item.descripcion}</div>
                  {item.observaciones ? (
                    <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap break-words">{item.observaciones}</div>
                  ) : null}
                </td>
                <td className="px-2 py-2 text-right font-mono">{item.total}</td>
                <td className="px-2 py-2 text-right font-mono">{item.entregado}</td>
                <td className="px-2 py-2 text-right font-mono text-amber-800">{item.pendiente}</td>
                <td className="px-2 py-2 align-middle">
                  {item.pendiente <= 0 ? (
                    <span className="text-xs text-gray-400">—</span>
                  ) : (
                    <label className="flex cursor-pointer flex-col items-center gap-1">
                      <input
                        type="checkbox"
                        checked={lineaCompleta}
                        disabled={pendBloqueado}
                        onChange={(e) => onLineaCompletaChange(item, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-600"
                      />
                      {lineaCompleta ? (
                        <span className="text-center text-xs font-medium text-green-600">Entrega completa</span>
                      ) : (
                        <span className="text-center text-[11px] text-gray-500">Marcar todo</span>
                      )}
                    </label>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={item.pendiente}
                    step="1"
                    inputMode="decimal"
                    className="h-9 text-right font-mono"
                    value={entrega[item.id] ?? ''}
                    onChange={(e) => onCantidadChange(item.id, item.pendiente, e)}
                    disabled={pendBloqueado || lineaCompleta}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EntregaMobileFlow({
  rows,
  entrega,
  setEntrega,
  completo,
  itemsLoading,
  cotizacionId,
  mobileStep,
  setMobileStep,
  tipoEntrega,
  setTipoEntrega,
  recibeNombre,
  setRecibeNombre,
  comentarios,
  setComentarios,
  entregaFotoFile,
  entregaFotoPreview,
  entregaFotoInputRef,
  onEntregaFotoChange,
  onClearEntregaFoto,
  sigApiRef,
  open,
  onSave,
  saving,
  toast,
  onSelectTipoCompleta,
  onSelectTipoParcial,
  bumpCantidad,
  completos,
  onLineaCompletaChange,
  entregasBloqueadas,
}) {
  const pasoLabel =
    mobileStep === 1
      ? 'Tipo'
      : mobileStep === 2
        ? 'Cantidades'
        : mobileStep === 3
          ? 'Datos'
          : mobileStep === 4
            ? 'Foto'
            : 'Firma';

  const pasoFraccion = (() => {
    if (tipoEntrega == null) return null;
    if (tipoEntrega === 'completa') {
      if (mobileStep === 1) return '1 / 4';
      if (mobileStep === 3) return '2 / 4';
      if (mobileStep === 4) return '3 / 4';
      if (mobileStep === 5) return '4 / 4';
      return null;
    }
    if (mobileStep >= 1 && mobileStep <= 5) return `${mobileStep} / 5`;
    return null;
  })();

  const irAtras = () => {
    if (mobileStep <= 1) return;
    if (mobileStep === 3 && tipoEntrega === 'completa') {
      setMobileStep(1);
      setTipoEntrega(null);
      setEntrega({});
      return;
    }
    if (mobileStep === 3 && tipoEntrega === 'parcial') {
      setMobileStep(2);
      return;
    }
    if (mobileStep === 5) {
      setMobileStep(4);
      return;
    }
    if (mobileStep === 4) {
      setMobileStep(3);
      return;
    }
    if (mobileStep === 2) {
      setMobileStep(1);
      setTipoEntrega(null);
      setEntrega({});
    }
  };

  const continuarDesdePaso2 = () => {
    const itemsAEntregar = rows.filter((i) => Number(entrega[i.id]) > 0);
    if (tipoEntrega === 'parcial' && itemsAEntregar.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidades',
        description: 'Selecciona al menos una partida con cantidad mayor a 0.',
      });
      return;
    }
    setMobileStep(3);
  };

  const continuarDesdePaso3 = () => {
    if (!String(recibeNombre).trim()) {
      toast({ variant: 'destructive', title: 'Datos', description: 'Escribe quién recibe la mercancía.' });
      return;
    }
    setMobileStep(4);
  };

  const continuarDesdePasoFoto = () => {
    if (!entregaFotoFile || !entregaFotoPreview) {
      toast({ variant: 'destructive', title: 'Foto requerida', description: 'Agrega una foto de la entrega.' });
      return;
    }
    setMobileStep(5);
  };

  if (!cotizacionId) {
    return (
      <div className="flex flex-1 flex-col px-4 py-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-base text-amber-900">
          Este proyecto no tiene cotización vinculada; no se pueden registrar entregas por partida.
        </p>
      </div>
    );
  }

  if (itemsLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-gray-500">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
        <p className="text-sm">Cargando partidas…</p>
      </div>
    );
  }

  if (completo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-lg text-gray-700">No hay cantidades pendientes por entregar.</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-lg text-gray-600">No hay partidas en la cotización.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
        <p className="mb-4 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
          {pasoFraccion ? `Paso ${pasoFraccion} · ${pasoLabel}` : `Paso 1 · ${pasoLabel}`}
        </p>

        {mobileStep === 1 && (
          <SelectorTipoEntrega layout="mobile" onSelectCompleta={onSelectTipoCompleta} onSelectParcial={onSelectTipoParcial} />
        )}

        {mobileStep === 2 && tipoEntrega === 'parcial' && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Cantidades</h2>
            <p className="text-sm text-gray-500">Usa + / − o marca entregar todo el pendiente de la partida.</p>
            <ul className="space-y-3">
              {rows.map((item) => {
                const pend = Number(item.pendiente);
                const val = Number(entrega[item.id] ?? 0);
                const lineaCompleta = !!completos[item.id];
                if (pend <= 0) return null;
                return (
                  <li
                    key={String(item.id)}
                    className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
                  >
                    <p className="text-base font-semibold leading-snug text-gray-900">{item.descripcion}</p>
                    {item.observaciones ? (
                      <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap break-words">{item.observaciones}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span>Total: <span className="font-mono font-medium text-gray-800">{item.total}</span></span>
                      <span>
                        Pendiente:{' '}
                        <span className="font-mono font-medium text-amber-800">{item.pendiente}</span>
                      </span>
                    </div>
                    <label
                      htmlFor={`entrega-linea-completa-mob-${item.id}`}
                      className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 active:bg-gray-100"
                    >
                      <input
                        id={`entrega-linea-completa-mob-${item.id}`}
                        type="checkbox"
                        checked={lineaCompleta}
                        onChange={(e) => onLineaCompletaChange(item, e.target.checked)}
                        className="h-6 w-6 shrink-0 rounded-md border-gray-300 text-teal-600 focus:ring-teal-600"
                      />
                      <span className="text-base font-medium text-gray-900">Entregar completo</span>
                      {lineaCompleta ? (
                        <span className="ml-auto text-xs font-medium text-green-600">Entrega completa</span>
                      ) : null}
                    </label>
                    <div className="mt-4 flex items-center justify-center gap-4">
                      <button
                        type="button"
                        aria-label="Menos"
                        disabled={lineaCompleta}
                        className={cn(
                          'flex h-14 min-w-14 items-center justify-center rounded-xl text-2xl font-semibold active:bg-gray-200',
                          lineaCompleta
                            ? 'cursor-not-allowed bg-gray-50 text-gray-300'
                            : 'bg-gray-100 text-gray-800'
                        )}
                        onClick={() => bumpCantidad(item.id, pend, -1)}
                      >
                        −
                      </button>
                      <span className="min-w-[3rem] text-center text-2xl font-semibold tabular-nums text-gray-900">
                        {lineaCompleta ? pend : val}
                      </span>
                      <button
                        type="button"
                        aria-label="Más"
                        disabled={lineaCompleta}
                        className={cn(
                          'flex h-14 min-w-14 items-center justify-center rounded-xl text-2xl font-semibold text-white active:bg-teal-700',
                          lineaCompleta ? 'cursor-not-allowed bg-teal-300' : 'bg-teal-600'
                        )}
                        onClick={() => bumpCantidad(item.id, pend, 1)}
                      >
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {mobileStep === 3 && tipoEntrega === 'completa' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Resumen</h2>
              <TipoEntregaBadge tipoEntrega={tipoEntrega} />
            </div>
            <ConfirmacionEntregaCompleta rows={rows} />
          </div>
        )}

        {mobileStep === 3 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900">Datos del recibido</h2>
              {tipoEntrega === 'parcial' ? <TipoEntregaBadge tipoEntrega={tipoEntrega} /> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="recibe-mob" className="text-base">
                Quién recibe *
              </Label>
              <Input
                id="recibe-mob"
                value={recibeNombre}
                onChange={(e) => setRecibeNombre(e.target.value)}
                placeholder="Nombre completo"
                className="h-14 text-base"
                autoComplete="name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="com-mob" className="text-base">
                Comentarios
              </Label>
              <textarea
                id="com-mob"
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                placeholder="Opcional — observaciones de la entrega"
                className="min-h-[120px] w-full resize-none rounded-md border border-input bg-white px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
              />
            </div>
          </div>
        )}

        {mobileStep === 4 && (
          <div className="w-full max-w-full space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">Foto de entrega</h2>
            <p className="text-sm text-gray-500">
              Evidencia de la mercancía en sitio (obligatoria). No sustituye la bitácora del proyecto.
            </p>
            <label
              htmlFor="entrega-foto-mob"
              className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 px-4 py-4 text-base font-semibold text-teal-900 active:bg-teal-50"
            >
              <Camera className="h-6 w-6 shrink-0" />
              Tomar o elegir foto
              <input
                id="entrega-foto-mob"
                ref={entregaFotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={onEntregaFotoChange}
              />
            </label>
            {entregaFotoPreview ? (
              <div className="mt-2 w-full overflow-hidden rounded-lg border bg-white">
                <img
                  src={entregaFotoPreview}
                  alt="Vista previa entrega"
                  className="max-h-52 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={onClearEntregaFoto}
                  className="w-full py-2 text-center text-sm font-medium text-red-600 active:bg-red-50"
                >
                  Quitar foto
                </button>
              </div>
            ) : null}
          </div>
        )}

        {mobileStep === 5 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">Firma de recibido</h2>
            <p className="text-sm text-gray-500">Firma con el dedo; el lienzo no desplaza la pantalla.</p>
            <SignaturePad open={open} apiRef={sigApiRef} tall className="rounded-2xl border-gray-200" />
          </div>
        )}
      </div>

      <div className={mobileBarClass}>
        {mobileStep === 1 && (
          <p className="mb-2 text-center text-xs text-gray-400">Selecciona un tipo para continuar</p>
        )}
        {mobileStep > 1 && mobileStep < 5 && (
          <div className="mb-2 flex gap-2">
            <Button type="button" variant="outline" className="h-12 flex-1 text-base" onClick={irAtras}>
              <ChevronLeft className="mr-1 h-5 w-5" />
              Atrás
            </Button>
            {mobileStep === 2 && (
              <Button type="button" className="h-12 flex-[2] bg-teal-600 text-base hover:bg-teal-700" onClick={continuarDesdePaso2}>
                Continuar
              </Button>
            )}
            {mobileStep === 3 && (
              <Button type="button" className="h-12 flex-[2] bg-teal-600 text-base hover:bg-teal-700" onClick={continuarDesdePaso3}>
                Siguiente: foto
              </Button>
            )}
            {mobileStep === 4 && (
              <Button type="button" className="h-12 flex-[2] bg-teal-600 text-base hover:bg-teal-700" onClick={continuarDesdePasoFoto}>
                Ir a firma
              </Button>
            )}
          </div>
        )}
        {mobileStep === 5 && (
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" className="h-12 w-full text-base" onClick={irAtras}>
              <ChevronLeft className="mr-1 h-5 w-5" />
              Atrás
            </Button>
            <Button
              type="button"
              className="h-14 w-full text-base font-semibold bg-teal-600 hover:bg-teal-700"
              disabled={saving || completo || entregasBloqueadas}
              onClick={onSave}
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
              {saving ? 'Guardando…' : 'Guardar entrega'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Modal de entrega parcial / múltiple por ítems de cotización.
 * No muta `items` recibidos; solo estado local `entrega` por id.
 */
export default function EntregaModal({
  open,
  onOpenChange,
  proyectoId,
  cotizacionId,
  proyectoFolio,
  clienteNombre,
  items: itemsRaw,
  itemsLoading,
  onItemsRefetch,
  onSuccess,
  /** No registrar más entregas (p. ej. proyecto.estado === 'entregado' o estatus Entregado). */
  entregasBloqueadas = false,
}) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [entrega, setEntrega] = useState({});
  const [recibeNombre, setRecibeNombre] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [saving, setSaving] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [tipoEntrega, setTipoEntrega] = useState(null);
  /** Por ítem: en modo parcial, si true se entrega todo el pendiente y el input queda bloqueado. */
  const [completos, setCompletos] = useState({});
  const [entregaFotoFile, setEntregaFotoFile] = useState(null);
  const [entregaFotoPreview, setEntregaFotoPreview] = useState(null);
  const sigApiRef = useRef(null);
  const entregaFotoInputRef = useRef(null);

  const rows = React.useMemo(() => (itemsRaw ?? []).map(mapEntregaItemRow).filter((r) => r.id != null), [itemsRaw]);

  const completo = rows.length === 0 || rows.every((i) => Number(i.pendiente) <= 0);

  const sanitizeFilename = (filename) => filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');

  const handleEntregaFotoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Selecciona una imagen.' });
      return;
    }
    setEntregaFotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    setEntregaFotoFile(f);
  };

  const clearEntregaFoto = () => {
    setEntregaFotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setEntregaFotoFile(null);
    if (entregaFotoInputRef.current) entregaFotoInputRef.current.value = '';
  };

  useEffect(() => {
    if (open && entregasBloqueadas) {
      onOpenChange(false);
      toast({
        variant: 'destructive',
        title: 'Entregas cerradas',
        description: 'Este proyecto ya no admite nuevas entregas.',
      });
    }
  }, [open, entregasBloqueadas, onOpenChange, toast]);

  useEffect(() => {
    if (!open) {
      setEntrega({});
      setCompletos({});
      setRecibeNombre('');
      setComentarios('');
      setMobileStep(1);
      setTipoEntrega(null);
      setEntregaFotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setEntregaFotoFile(null);
      if (entregaFotoInputRef.current) entregaFotoInputRef.current.value = '';
    }
  }, [open]);

  useEffect(() => {
    if (tipoEntrega == null) {
      setCompletos({});
    }
  }, [tipoEntrega]);

  /** Solo al cambiar el modo parcial: vaciar cantidades y marcas por línea. */
  useEffect(() => {
    if (tipoEntrega === 'parcial') {
      setEntrega({});
      setCompletos({});
    }
  }, [tipoEntrega]);

  /** Modo completa: siempre reflejar el pendiente actual de cada partida. */
  useEffect(() => {
    if (tipoEntrega !== 'completa') return;
    setCompletos({});
    setEntrega(() => {
      const nueva = {};
      rows.forEach((item) => {
        if (item.pendiente > 0) nueva[item.id] = item.pendiente;
      });
      return nueva;
    });
  }, [tipoEntrega, rows]);

  /** Parcial: al cambiar filas, quitar marcas y cantidades de partidas sin pendiente. */
  useEffect(() => {
    if (tipoEntrega !== 'parcial') return;
    setCompletos((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((k) => {
        if (!next[k]) return;
        const it = rows.find((r) => String(r.id) === String(k));
        if (!it || Number(it.pendiente) <= 0) {
          delete next[k];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setEntrega((prev) => {
      const copy = { ...prev };
      let ch = false;
      rows.forEach((item) => {
        const id = item.id;
        if (Number(item.pendiente) <= 0 && id in copy) {
          delete copy[id];
          ch = true;
        }
      });
      return ch ? copy : prev;
    });
  }, [rows, tipoEntrega]);

  /** Parcial: líneas marcadas “completo” siguen el pendiente actual del servidor. */
  useEffect(() => {
    if (tipoEntrega !== 'parcial') return;
    setEntrega((prev) => {
      const copy = { ...prev };
      let changed = false;
      rows.forEach((item) => {
        const id = item.id;
        if (!completos[id]) return;
        const p = Number(item.pendiente);
        if (p <= 0) {
          if (id in copy) {
            delete copy[id];
            changed = true;
          }
          return;
        }
        if (Number(copy[id]) !== p) {
          copy[id] = p;
          changed = true;
        }
      });
      return changed ? copy : prev;
    });
  }, [rows, tipoEntrega, completos]);

  const selectTipoCompleta = useCallback(() => {
    setTipoEntrega('completa');
    if (isMobile) setMobileStep(3);
  }, [isMobile]);

  const selectTipoParcial = useCallback(() => {
    setTipoEntrega('parcial');
    if (isMobile) setMobileStep(2);
  }, [isMobile]);

  const bumpCantidad = useCallback(
    (itemId, pendienteMax, delta) => {
      if (tipoEntrega !== 'parcial' || completos[itemId]) return;
      setEntrega((prev) => {
        const cur = Number(prev[itemId] ?? 0);
        const next = Math.max(0, Math.min(pendienteMax, cur + delta));
        return { ...prev, [itemId]: next };
      });
    },
    [tipoEntrega, completos]
  );

  const handleLineaCompletaChange = useCallback((item, checked) => {
    if (tipoEntrega !== 'parcial') return;
    const id = item.id;
    const pend = Number(item.pendiente);
    setCompletos((prev) => ({ ...prev, [id]: checked }));
    if (checked) {
      if (pend > 0) setEntrega((prev) => ({ ...prev, [id]: pend }));
    } else {
      setEntrega((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  }, [tipoEntrega]);

  const handleCantidadChange = (itemId, pendienteMax, e) => {
    if (tipoEntrega === 'completa') return;
    if (completos[itemId]) return;
    const val = e.target.value;
    if (val === '') {
      setEntrega((prev) => ({ ...prev, [itemId]: '' }));
      return;
    }
    const num = Number(val);
    if (Number.isNaN(num) || num < 0) return;
    if (num > pendienteMax) return;
    setEntrega((prev) => ({ ...prev, [itemId]: num }));
  };

  const handleSave = async () => {
    if (saving) return;
    if (entregasBloqueadas) {
      toast({
        variant: 'destructive',
        title: 'Bloqueado',
        description: 'No se pueden registrar entregas en este proyecto.',
      });
      return;
    }
    if (!tipoEntrega) {
      toast({
        variant: 'destructive',
        title: 'Tipo de entrega',
        description: 'Selecciona entrega completa o parcial.',
      });
      return;
    }

    const itemsAEntregar = rows.filter((i) => Number(entrega[i.id]) > 0);

    if (tipoEntrega === 'parcial' && itemsAEntregar.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidades',
        description: 'Selecciona al menos una partida con cantidad mayor a 0.',
      });
      return;
    }

    if (tipoEntrega === 'completa' && itemsAEntregar.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Cantidades',
        description: 'No hay saldo pendiente para entregar.',
      });
      return;
    }
    if (!String(recibeNombre).trim()) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Indica quién recibe la mercancía.' });
      return;
    }
    if (!entregaFotoFile || !entregaFotoPreview) {
      toast({ variant: 'destructive', title: 'Foto requerida', description: 'Agrega una foto de la entrega.' });
      return;
    }
    const sig = sigApiRef.current;
    if (!sig || sig.isEmpty()) {
      toast({ variant: 'destructive', title: 'Firma requerida', description: 'Se necesita la firma de recibido.' });
      return;
    }

    setSaving(true);
    try {
      const { data: latestRaw, error: rpcPreErr } = await supabase.rpc('get_items_con_pendiente', {
        cotizacion_id_input: cotizacionId,
      });
      if (rpcPreErr) throw rpcPreErr;

      const latestRows = Array.isArray(latestRaw) ? latestRaw.map(mapEntregaItemRow) : [];
      const yaCompletoServidor =
        latestRows.length === 0 || latestRows.every((i) => Number(i.pendiente) <= 0);
      if (yaCompletoServidor) {
        toast({ variant: 'destructive', title: 'Sin pendientes', description: 'Este proyecto ya fue entregado completamente.' });
        return;
      }

      for (const i of itemsAEntregar) {
        const live = latestRows.find((r) => String(r.id) === String(i.id));
        const pendLive = live ? Number(live.pendiente) : 0;
        const qty = Number(entrega[i.id]);
        if (!live || pendLive <= 0 || qty > pendLive) {
          toast({
            variant: 'destructive',
            title: 'Datos desactualizados',
            description: 'El pendiente cambió. Cierra y vuelve a cargar las cantidades.',
          });
          onItemsRefetch?.();
          return;
        }
      }

      const fotoUrl = await uploadEntregaImage(entregaFotoFile, proyectoId, sanitizeFilename);

      const dataUrl = sig.toDataURL();
      if (!dataUrl) throw new Error('No se pudo leer la firma.');

      const signatureBlob = await (await fetch(dataUrl)).blob();
      const firmaPath = `entregas/${proyectoId}/firma_${Date.now()}.png`;
      const { error: firmaError } = await supabase.storage.from('proyecto_archivos').upload(firmaPath, signatureBlob, {
        contentType: 'image/png',
      });
      if (firmaError) throw new Error(`Error al subir la firma: ${firmaError.message}`);
      const firmaUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(firmaPath).data.publicUrl;

      const { data: entregaRow, error: entregaErr } = await supabase
        .from('entregas')
        .insert({
          proyecto_id: proyectoId,
          cotizacion_id: cotizacionId,
          recibe_nombre: recibeNombre.trim(),
          firma_url: firmaUrl,
          foto_url: fotoUrl,
          comentarios: comentarios.trim() || null,
          estado: 'activa',
        })
        .select()
        .single();

      if (entregaErr) throw entregaErr;

      const detalles = itemsAEntregar.map((i) => ({
        entrega_id: entregaRow.id,
        cotizacion_item_id: i.id,
        cantidad_entregada: Number(entrega[i.id]),
      }));

      const { error: itemsErr } = await supabase.from('entregas_items').insert(detalles);
      if (itemsErr) throw itemsErr;

      const { data: pendientesPost, error: rpcErr } = await supabase.rpc('get_items_con_pendiente', {
        cotizacion_id_input: cotizacionId,
      });
      let todoEntregado = false;
      if (!rpcErr && Array.isArray(pendientesPost)) {
        const mapped = pendientesPost.map(mapEntregaItemRow);
        todoEntregado = mapped.length === 0 || mapped.every((r) => Number(r.pendiente) <= 0);
      }

      const patchProyecto = todoEntregado
        ? { estatus: 'Entregado', estado: 'entregado' }
        : { estado: 'parcial' };

      const { error: updErr } = await supabase.from('proyectos').update(patchProyecto).eq('id', proyectoId);
      let notificacionOk = false;
      if (!updErr) {
        notificacionOk = todoEntregado;
      } else if (todoEntregado) {
        const { error: updFallback } = await supabase
          .from('proyectos')
          .update({ estatus: 'Entregado' })
          .eq('id', proyectoId);
        if (!updFallback) notificacionOk = true;
        else console.warn('Actualizar proyecto tras entrega:', updFallback.message);
      } else {
        console.warn(
          'Columna opcional `estado` en proyectos: añádela en Supabase (text). Detalle:',
          updErr.message
        );
      }

      if (notificacionOk) {
        notifyProjectFinishedOrDelivered({
          folio: proyectoFolio || 'Sin folio',
          cliente_nombre: clienteNombre || 'Sin cliente',
          estatus: 'Entregado',
        });
      }

      toast({ title: 'Entrega registrada', description: 'Los datos se guardaron correctamente.' });
      onItemsRefetch?.();
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: err?.message ?? 'No se pudo completar el registro.',
      });
    } finally {
      setSaving(false);
    }
  };

  const listoParaTipo = Boolean(cotizacionId && !itemsLoading && rows.length > 0 && !completo);
  const hayCantidadAEntregar = rows.some((i) => Number(entrega[i.id]) > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? 'flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 !overflow-hidden !p-0 !left-0 !top-0 !translate-x-0 !translate-y-0 rounded-none border-0'
            : 'flex max-h-[90vh] max-w-4xl flex-col gap-4'
        )}
        forceMount
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader
          className={cn(
            isMobile && 'shrink-0 border-b border-gray-100 bg-white px-4 pb-3 pl-4 pr-14 pt-14 text-left sm:text-left'
          )}
        >
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <DialogTitle className={cn(isMobile && 'text-xl font-semibold')}>Registrar entrega de mercancía</DialogTitle>
            {!isMobile && tipoEntrega ? <TipoEntregaBadge tipoEntrega={tipoEntrega} /> : null}
          </div>
        </DialogHeader>

        {isMobile ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <EntregaMobileFlow
              rows={rows}
              entrega={entrega}
              setEntrega={setEntrega}
              completo={completo}
              itemsLoading={itemsLoading}
              cotizacionId={cotizacionId}
              mobileStep={mobileStep}
              setMobileStep={setMobileStep}
              tipoEntrega={tipoEntrega}
              setTipoEntrega={setTipoEntrega}
              recibeNombre={recibeNombre}
              setRecibeNombre={setRecibeNombre}
              comentarios={comentarios}
              setComentarios={setComentarios}
              entregaFotoFile={entregaFotoFile}
              entregaFotoPreview={entregaFotoPreview}
              entregaFotoInputRef={entregaFotoInputRef}
              onEntregaFotoChange={handleEntregaFotoChange}
              onClearEntregaFoto={clearEntregaFoto}
              sigApiRef={sigApiRef}
              open={open}
              onSave={handleSave}
              saving={saving}
              toast={toast}
              onSelectTipoCompleta={selectTipoCompleta}
              onSelectTipoParcial={selectTipoParcial}
              bumpCantidad={bumpCantidad}
              completos={completos}
              onLineaCompletaChange={handleLineaCompletaChange}
              entregasBloqueadas={entregasBloqueadas}
            />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto py-2">
              {!cotizacionId ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Este proyecto no tiene cotización vinculada; no se pueden calcular partidas pendientes.
                </p>
              ) : null}

              {itemsLoading ? (
                <div className="flex justify-center py-12 text-gray-500">
                  <Loader2 className="h-10 w-10 animate-spin" />
                </div>
              ) : completo ? (
                <p className="py-8 text-center text-sm text-gray-600">No hay cantidades pendientes por entregar.</p>
              ) : listoParaTipo ? (
                <>
                  {!tipoEntrega ? (
                    <SelectorTipoEntrega
                      layout="desktop"
                      onSelectCompleta={selectTipoCompleta}
                      onSelectParcial={selectTipoParcial}
                    />
                  ) : null}
                  {tipoEntrega === 'parcial' ? (
                    <TablaItemsEntregaDesktop
                      rows={rows}
                      entrega={entrega}
                      completos={completos}
                      tipoEntrega={tipoEntrega}
                      onCantidadChange={handleCantidadChange}
                      onLineaCompletaChange={handleLineaCompletaChange}
                    />
                  ) : null}
                  {tipoEntrega === 'completa' ? <ConfirmacionEntregaCompleta rows={rows} /> : null}
                </>
              ) : (
                <p className="py-6 text-center text-sm text-gray-500">No hay partidas en la cotización para mostrar.</p>
              )}

              {tipoEntrega && listoParaTipo ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="recibe-entrega">Quién recibe *</Label>
                    <Input
                      id="recibe-entrega"
                      value={recibeNombre}
                      onChange={(e) => setRecibeNombre(e.target.value)}
                      placeholder="Nombre completo"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="com-entrega">Comentarios</Label>
                    <textarea
                      id="com-entrega"
                      value={comentarios}
                      onChange={(e) => setComentarios(e.target.value)}
                      className="min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="w-full max-w-full space-y-2 md:col-span-2">
                    <Label htmlFor="entrega-foto-desk" className="text-sm font-medium">
                      Foto de entrega *
                    </Label>
                    <p className="text-xs text-gray-500">
                      Evidencia en sitio (obligatoria). Es independiente de la bitácora del proyecto.
                    </p>
                    <label
                      htmlFor="entrega-foto-desk"
                      className="flex min-h-[48px] w-full max-w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/30 px-4 py-3 text-sm font-medium text-teal-900"
                    >
                      <Camera className="h-5 w-5 shrink-0" />
                      Tomar o elegir foto
                      <input
                        id="entrega-foto-desk"
                        ref={entregaFotoInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={handleEntregaFotoChange}
                      />
                    </label>
                    {entregaFotoPreview ? (
                      <div className="mt-2 w-full overflow-hidden rounded-lg border">
                        <img
                          src={entregaFotoPreview}
                          alt="Vista previa"
                          className="max-h-52 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearEntregaFoto}
                          className="mt-1 text-xs text-red-600 hover:underline"
                        >
                          Quitar foto
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Firma de recibido *</Label>
                    <SignaturePad open={open} apiRef={sigApiRef} />
                    <p className="text-xs text-gray-500">En móvil, el lienzo bloquea scroll para firmar sin abrir el teclado.</p>
                  </div>
                </div>
              ) : null}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={saving}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  entregasBloqueadas ||
                  completo ||
                  !cotizacionId ||
                  itemsLoading ||
                  !tipoEntrega ||
                  !hayCantidadAEntregar
                }
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {saving ? 'Guardando…' : 'Guardar entrega'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
