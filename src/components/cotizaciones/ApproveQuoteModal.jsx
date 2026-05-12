import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Modal de Revisión y Aprobación antes de aprobar una cotización.
 * Permite cambiar Cliente e IVA; calcula total en vivo; intercepta con confirmación si hay cambios.
 */
const ApproveQuoteModal = ({ open, onOpenChange, quote, onConfirmApproval }) => {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState(null); // null = externo
  const [aplicaIva, setAplicaIva] = useState(true);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const aplicaIvaOriginal = quote?.aplica_iva !== false;
  const clienteIdOriginal = quote?.cliente_id ?? null;

  // Opciones para Combobox (mismo patrón que CotizacionDialog)
  const clientesOptions = useMemo(
    () => [
      { value: 'externo', label: '-- Cliente Externo --' },
      ...(clientes || []).map((c) => ({ value: `id:${c.id}`, label: c.nombre })),
    ],
    [clientes]
  );

  const comboboxValue = clienteId != null ? `id:${clienteId}` : 'externo';

  // Subtotal base desde la cotización (solo lectura)
  const subtotalBase = useMemo(() => {
    if (quote?.total == null) return 0;
    const total = Number(quote.total) || 0;
    const conIva = quote.aplica_iva !== false;
    return conIva ? round2(total / 1.16) : round2(total);
  }, [quote?.total, quote?.aplica_iva]);

  // FASE 2: Cálculo dinámico en vivo
  const { ivaMonto, totalFinal } = useMemo(() => {
    const iva = aplicaIva ? round2(subtotalBase * 0.16) : 0;
    const total = aplicaIva ? round2(subtotalBase * 1.16) : round2(subtotalBase);
    return { ivaMonto: iva, totalFinal: total };
  }, [subtotalBase, aplicaIva]);

  // FASE 3: isDirty
  const isDirty = useMemo(() => {
    const clienteCambiado = String(clienteId ?? '') !== String(clienteIdOriginal ?? '');
    const ivaCambiado = aplicaIva !== aplicaIvaOriginal;
    return clienteCambiado || ivaCambiado;
  }, [clienteId, clienteIdOriginal, aplicaIva, aplicaIvaOriginal]);

  useEffect(() => {
    if (!open) return;
    setAplicaIva(quote?.aplica_iva !== false);
    setClienteId(quote?.cliente_id ?? null);
  }, [open, quote?.aplica_iva, quote?.cliente_id]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from('clientes')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setClientes(data || []));
  }, [open]);

  const nombreClienteSeleccionado = useMemo(() => {
    if (clienteId == null) return 'Cliente externo';
    const c = clientes.find((x) => x.id === clienteId);
    return c?.nombre ?? `Cliente #${clienteId}`;
  }, [clienteId, clientes]);

  const handleConfirmarAprobacion = () => {
    if (isDirty) {
      setConfirmDialogOpen(true);
    } else {
      ejecutarAprobacion();
    }
  };

  const ejecutarAprobacion = async () => {
    setConfirmDialogOpen(false);
    if (!quote || !onConfirmApproval) return;
    setIsSubmitting(true);
    try {
      const clienteNombreExterno = clienteId == null ? (quote.cliente_nombre_externo || '') : null;
      const cotizacionResuelta = {
        ...quote,
        cliente_id: clienteId ?? null,
        cliente_nombre_externo: clienteNombreExterno,
        aplica_iva: aplicaIva,
        total: totalFinal,
      };
      await onConfirmApproval({ cotizacionResuelta, isDirty });
      onOpenChange(false);
    } catch (_) {
      // Error ya mostrado por el padre; no cerrar modal
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!quote) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto',
            'sm:w-full p-4 sm:p-6'
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">Revisión Final: Aprobar Cotización</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Sección superior: resumen solo lectura */}
            <div className="rounded-lg border bg-gray-50 p-4 space-y-1">
              <p className="text-sm font-semibold text-gray-700">Resumen de la cotización</p>
              <p className="font-mono text-sm text-blue-600">{quote.folio}</p>
              <p className="text-sm text-gray-600">{quote.descripcion || '—'}</p>
            </div>

            {/* Sección central: filtros editables */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Condiciones de aprobación</h3>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Combobox
                  options={clientesOptions}
                  value={comboboxValue}
                  onChange={(v) => {
                    if (v === 'externo' || !v) setClienteId(null);
                    else setClienteId(parseInt(v.split(':')[1], 10));
                  }}
                  placeholder="Selecciona un cliente"
                  searchPlaceholder="Buscar cliente..."
                  notFoundMessage="Ningún cliente encontrado."
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="approve-iva" className="text-base">Aplicar IVA (16%)</Label>
                  <p className="text-xs text-muted-foreground">Estatus fiscal para el proyecto</p>
                </div>
                <Switch id="approve-iva" checked={aplicaIva} onCheckedChange={setAplicaIva} />
              </div>
            </div>

            {/* Sección inferior: resumen financiero dinámico */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 border">
              <p className="text-sm font-semibold text-gray-700">Resumen financiero</p>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="font-medium">
                  ${subtotalBase.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              {aplicaIva && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA (16%)</span>
                  <span className="font-medium">
                    ${ivaMonto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t">
                <span>Total final</span>
                <span className="text-green-700">
                  ${totalFinal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {isDirty && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Has modificado las condiciones originales (Cliente o IVA). Al confirmar, estos datos se guardarán en la
                cotización y se usarán para crear el proyecto.
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row flex-wrap gap-2 sm:justify-end pt-4 border-t mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={isSubmitting} className="min-h-[44px]">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={handleConfirmarAprobacion}
              disabled={isSubmitting}
              className="min-h-[44px] gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar Aprobación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FASE 3: Alerta de impacto si hubo cambios */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Confirmar cambios en las condiciones
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Has modificado las condiciones originales (Cliente/IVA). Estos nuevos datos se guardarán en la
                  cotización y se usarán para crear el proyecto.
                </p>
                <ul className="list-disc pl-4 space-y-1 text-sm">
                  <li>
                    <strong>Cliente:</strong> {nombreClienteSeleccionado}
                  </li>
                  <li>
                    <strong>Total del proyecto:</strong> $
                    {totalFinal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </li>
                </ul>
                <p>¿Deseas continuar?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={ejecutarAprobacion} className="min-h-[44px] bg-green-600 hover:bg-green-700">
              Sí, aprobar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ApproveQuoteModal;
