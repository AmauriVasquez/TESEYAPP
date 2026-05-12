import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { notifyPagoRecibido } from '@/services/TelegramService';
import { Loader2, Upload, FileText, Calendar as CalendarIcon, Trash2, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';

const TIPOS_INGRESO = [
  { value: 'Anticipo', label: 'Anticipo' },
  { value: 'Estimación', label: 'Estimación' },
  { value: 'Liquidación', label: 'Liquidación' },
  { value: 'Anticipo por Partida', label: 'Anticipo por Partida' },
];

const round2 = (n) => Math.round(Number(n) * 100) / 100;

const RegistrarPagoDialog = ({ open, onOpenChange, proyectoId, proyecto, pago: pagoEditar, onSave }) => {
  const { toast } = useToast();
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(null);
  const [metodoPago, setMetodoPago] = useState('');
  const [tipoIngreso, setTipoIngreso] = useState('Anticipo');
  const [partidaId, setPartidaId] = useState('');
  const [partidas, setPartidas] = useState([]);
  const [comentarios, setComentarios] = useState('');
  const [cfdiFile, setCfdiFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aplicaIva, setAplicaIva] = useState(true);
  const [cotizacionIva, setCotizacionIva] = useState(null);
  const [clienteId, setClienteId] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  const isEditMode = Boolean(pagoEditar?.id);
  const tieneCotizacion = Boolean(proyecto?.cotizacion_id);

  // Valores originales al abrir (para isDirty)
  const clienteIdOriginal = proyecto?.cliente_id ?? null;
  const aplicaIvaOriginal = cotizacionIva?.aplica_iva ?? true;
  const isDirty = useMemo(() => {
    const clienteCambiado = String(clienteId ?? '') !== String(clienteIdOriginal ?? '');
    const ivaCambiado = tieneCotizacion && cotizacionIva && aplicaIva !== aplicaIvaOriginal;
    return clienteCambiado || ivaCambiado;
  }, [clienteId, clienteIdOriginal, aplicaIva, aplicaIvaOriginal, tieneCotizacion, cotizacionIva]);

  // FASE 2: Subtotal y total en tiempo real (cálculo inverso seguro)
  const { subtotal, ivaCalculado, nuevoTotal } = useMemo(() => {
    const totalActual = cotizacionIva?.total ?? 0;
    const conIvaActual = cotizacionIva?.aplica_iva ?? true;
    const sub = conIvaActual ? round2(totalActual / 1.16) : round2(totalActual);
    const iva = aplicaIva ? round2(sub * 0.16) : 0;
    const total = aplicaIva ? round2(sub * 1.16) : round2(sub);
    return { subtotal: sub, ivaCalculado: iva, nuevoTotal: total };
  }, [cotizacionIva?.total, cotizacionIva?.aplica_iva, aplicaIva]);

  useEffect(() => {
    if (!open) return;
    if (pagoEditar) {
      setMonto(String(pagoEditar.monto ?? ''));
      setFechaPago(pagoEditar.fecha_pago ? parseISO(pagoEditar.fecha_pago) : null);
      setMetodoPago(pagoEditar.metodo_pago ?? '');
      const coment = pagoEditar.comentarios ?? '';
      setComentarios(coment);
      if (coment.includes('Anticipo por Partida:')) setTipoIngreso('Anticipo por Partida');
      setCfdiFile(null);
    } else {
      setMonto('');
      setFechaPago(null);
      setMetodoPago('');
      setTipoIngreso('Anticipo');
      setPartidaId('');
      setComentarios('');
      setCfdiFile(null);
    }
  }, [open, pagoEditar]);

  useEffect(() => {
    if (!open || !proyecto?.cotizacion_id) {
      setCotizacionIva(null);
      setAplicaIva(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('id, total, aplica_iva')
        .eq('id', proyecto.cotizacion_id)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setCotizacionIva(null);
        setAplicaIva(true);
        return;
      }
      const aplica = data.aplica_iva !== false;
      setCotizacionIva({ total: Number(data.total || 0), aplica_iva: aplica });
      setAplicaIva(aplica);
    })();
    return () => { cancelled = true; };
  }, [open, proyecto?.cotizacion_id]);

  useEffect(() => {
    if (!open) return;
    setClienteId(proyecto?.cliente_id ?? null);
  }, [open, proyecto?.cliente_id]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => {
      if (!cancelled) setClientes(data || []);
    });
    return () => { cancelled = true; };
  }, [open]);

  const isAnticipoPartida = tipoIngreso === 'Anticipo por Partida';
  useEffect(() => {
    if (!open || !isAnticipoPartida || !proyecto?.cotizacion_id) {
      setPartidas([]);
      if (!pagoEditar) setPartidaId('');
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('cotizaciones_items')
        .select('id, descripcion, cantidad, unidad, precio_unitario')
        .eq('cotizacion_id', proyecto.cotizacion_id)
        .order('id');
      if (cancelled) return;
      if (error) return;
      const list = data || [];
      setPartidas(list);
      if (pagoEditar?.comentarios && list.length > 0) {
        const match = list.find((p) => pagoEditar.comentarios.includes(p.descripcion));
        setPartidaId(match ? String(match.id) : '');
      } else if (!pagoEditar) setPartidaId('');
    })();
    return () => { cancelled = true; };
  }, [open, isAnticipoPartida, proyecto?.cotizacion_id, pagoEditar?.comentarios]);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) setCfdiFile(e.target.files[0]);
  };

  const buildComentarios = () => {
    if (isAnticipoPartida && partidaId) {
      const partidaDesc = partidas.find((p) => String(p.id) === partidaId)?.descripcion || partidaId;
      return (comentarios ? `${comentarios}\n` : '') + `Anticipo por Partida: ${partidaDesc}`;
    }
    return comentarios || null;
  };

  const nombreClienteSeleccionado = useMemo(() => {
    if (clienteId == null) return 'Público en general';
    const c = clientes.find((x) => x.id === clienteId);
    return c?.nombre ?? 'Cliente';
  }, [clienteId, clientes]);

  const clientesOptions = useMemo(
    () => [
      { value: 'externo', label: 'Público en general' },
      ...(clientes || []).map((c) => ({ value: String(c.id), label: c.nombre })),
    ],
    [clientes]
  );

  const doSave = async () => {
    if (!monto || !fechaPago || !metodoPago) {
      toast({ variant: 'destructive', title: 'Error', description: 'Monto, fecha y método de pago son requeridos.' });
      return;
    }
    if (isAnticipoPartida && !partidaId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona la partida de la cotización.' });
      return;
    }
    if (isEditMode && !window.confirm('¿Estás seguro de actualizar este pago?')) return;
    setIsSaving(true);
    setConfirmDialogOpen(false);

    const sanitizeFilename = (filename) => filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');

    try {
      // FASE 4: Update en cascada (proyecto + cotización) si hay cambios
      if (isDirty && proyecto?.id) {
        if (clienteId !== clienteIdOriginal) {
          const { error: errProy } = await supabase
            .from('proyectos')
            .update({
              cliente_id: clienteId ? Number(clienteId) : null,
              cliente_nombre_externo: clienteId ? null : (proyecto.cliente_nombre_externo ?? 'Público en general'),
            })
            .eq('id', proyecto.id);
          if (errProy) throw new Error(`Error al actualizar proyecto: ${errProy.message}`);
        }
        if (tieneCotizacion && proyecto.cotizacion_id && (aplicaIva !== aplicaIvaOriginal || cotizacionIva)) {
          const nuevoTotalCotizacion = aplicaIva !== aplicaIvaOriginal
            ? (aplicaIva ? round2(subtotal * 1.16) : round2(subtotal))
            : cotizacionIva?.total;
          const payloadCot = { aplica_iva: aplicaIva, total: round2(nuevoTotalCotizacion) };
          if (clienteId !== clienteIdOriginal) payloadCot.cliente_id = clienteId ? Number(clienteId) : null;
          const { error: errCot } = await supabase
            .from('cotizaciones')
            .update(payloadCot)
            .eq('id', proyecto.cotizacion_id);
          if (errCot) throw new Error(`Error al actualizar cotización: ${errCot.message}`);
        }
      }

      let cfdiUrl = undefined;
      if (cfdiFile) {
        const path = `pagos/${proyectoId}/${Date.now()}_${sanitizeFilename(cfdiFile.name)}`;
        const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(path, cfdiFile);
        if (uploadError) throw new Error(`Error al subir el CFDI: ${uploadError.message}`);
        cfdiUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(path).data.publicUrl;
      }

      if (isEditMode) {
        const payload = {
          monto: parseFloat(monto),
          fecha_pago: format(fechaPago, 'yyyy-MM-dd'),
          metodo_pago: metodoPago,
          comentarios: buildComentarios(),
        };
        if (cfdiUrl != null) payload.url_cfdi = cfdiUrl;
        const { error: dbError } = await supabase.from('proyecto_pagos').update(payload).eq('id', pagoEditar.id);
        if (dbError) throw new Error(dbError.message);
        toast({ title: '✅ Pago actualizado' });
      } else {
        const { error: dbError } = await supabase.from('proyecto_pagos').insert({
          proyecto_id: proyectoId,
          monto: parseFloat(monto),
          fecha_pago: format(fechaPago, 'yyyy-MM-dd'),
          metodo_pago: metodoPago,
          comentarios: buildComentarios(),
          url_cfdi: cfdiUrl ?? null,
        });
        if (dbError) throw new Error(dbError.message);
        notifyPagoRecibido({
          proyectoNombre: proyecto?.descripcion,
          referencia: comentarios || undefined,
          folio: proyecto?.folio,
        });
        toast({ title: '✅ Pago Registrado' });
      }
      onSave();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: isEditMode ? 'Error al actualizar' : 'Error al Guardar Pago',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (!monto || !fechaPago || !metodoPago) {
      toast({ variant: 'destructive', title: 'Error', description: 'Monto, fecha y método de pago son requeridos.' });
      return;
    }
    if (isAnticipoPartida && !partidaId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona la partida de la cotización.' });
      return;
    }
    if (isDirty) {
      setConfirmDialogOpen(true);
      return;
    }
    doSave();
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de eliminar este ingreso permanentemente? Esta acción afectará el saldo del proyecto y no se puede deshacer.')) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('proyecto_pagos').delete().eq('id', pagoEditar.id);
      if (error) throw new Error(error.message);
      toast({ title: '✅ Pago eliminado' });
      onSave();
      onOpenChange(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: error.message });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            'w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto',
            'sm:w-full p-4 sm:p-6'
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl">{isEditMode ? 'Editar Pago' : 'Registrar Pago del Proyecto'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col md:grid md:grid-cols-2 gap-6 py-2">
            {/* FASE 1 - Columna 1: Detalles del Ingreso */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Detalles del Ingreso</h3>
              <div className="space-y-2">
                <Label>Tipo de ingreso</Label>
                <Select value={tipoIngreso} onValueChange={(v) => { setTipoIngreso(v); setPartidaId(''); }}>
                  <SelectTrigger className="p-3 h-auto"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_INGRESO.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isAnticipoPartida && (
                <div className="space-y-2">
                  <Label>Partida de la cotización *</Label>
                  {proyecto?.cotizacion_id ? (
                    <Select value={partidaId} onValueChange={setPartidaId}>
                      <SelectTrigger className="p-3 h-auto"><SelectValue placeholder="Selecciona partida..." /></SelectTrigger>
                      <SelectContent>
                        {partidas.map((p, idx) => (
                          <SelectItem key={p.id} value={String(p.id)}>Partida {idx + 1}: {p.descripcion}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-amber-600">Este proyecto no tiene cotización vinculada.</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="monto">Monto a pagar *</Label>
                <Input
                  id="monto"
                  type="number"
                  step="0.01"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="Ej. 5000.00"
                  className="p-3 h-auto"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha de Pago *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal p-3 h-auto', !fechaPago && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fechaPago ? format(fechaPago, 'PPP', { locale: es }) : 'Elige una fecha'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fechaPago} onSelect={setFechaPago} initialFocus /></PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Método de Pago *</Label>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                  <SelectTrigger className="p-3 h-auto"><SelectValue placeholder="Selecciona un método..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Tarjeta de Crédito/Débito">Tarjeta de Crédito/Débito</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ref-comentarios">Referencia / Comentarios</Label>
                <textarea
                  id="ref-comentarios"
                  value={comentarios}
                  onChange={(e) => setComentarios(e.target.value)}
                  className="w-full p-3 border rounded-lg min-h-[80px]"
                  rows={2}
                  placeholder="Ej. Anticipo 50%..."
                />
              </div>
              <div className="space-y-2">
                <Label>Adjuntar CFDI (opcional)</Label>
                <div
                  className="flex justify-center items-center px-4 py-5 border-2 border-dashed rounded-lg cursor-pointer min-h-[100px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {cfdiFile ? (
                    <p className="font-semibold text-blue-600 truncate max-w-full">{cfdiFile.name}</p>
                  ) : (
                    <span className="text-sm text-muted-foreground">Toca para subir (XML, PDF)</span>
                  )}
                </div>
                <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileChange} accept=".xml,.pdf" />
              </div>
            </div>

            {/* FASE 1 - Columna 2: Configuración del Proyecto y Totales */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Configuración del Proyecto</h3>

              <div className="space-y-2">
                <Label>Cliente</Label>
                <Combobox
                  options={clientesOptions}
                  value={clienteId != null ? String(clienteId) : 'externo'}
                  onChange={(v) => setClienteId(v === 'externo' || !v ? null : parseInt(v, 10))}
                  placeholder="Selecciona un cliente"
                  searchPlaceholder="Buscar cliente..."
                  notFoundMessage="Ningún cliente encontrado."
                />
              </div>

              {tieneCotizacion && (
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="aplica-iva-pago" className="text-base">Aplicar IVA (16%)</Label>
                    <p className="text-xs text-muted-foreground">Estatus fiscal para el cobro</p>
                  </div>
                  <Switch id="aplica-iva-pago" checked={aplicaIva} onCheckedChange={setAplicaIva} />
                </div>
              )}

              {/* Tarjeta Resumen Financiero en tiempo real */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 border">
                <p className="text-sm font-semibold text-gray-700">Resumen del proyecto</p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {aplicaIva && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">IVA (16%)</span>
                    <span className="font-medium">${ivaCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-2 border-t">
                  <span>Nuevo total</span>
                  <span className="text-green-700">${nuevoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {isDirty && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Hay cambios en cliente o IVA. Al guardar se actualizarán el proyecto y la cotización antes de registrar el pago.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-row flex-wrap gap-2 sm:justify-between pt-4 border-t mt-4">
            <div className="flex items-center gap-2 order-2 sm:order-1">
              {isEditMode && (
                <Button type="button" variant="destructive" size="sm" className="gap-1.5 min-h-[44px]" onClick={handleDelete} disabled={isSaving || isDeleting}>
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 order-1 sm:order-2 ml-auto flex-wrap">
              <DialogClose asChild>
                <Button variant="outline" disabled={isSaving || isDeleting} className="min-h-[44px]">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={isSaving || isDeleting} className="min-h-[44px] gap-2">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEditMode ? 'Guardar Cambios' : 'Guardar Pago'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FASE 3: Modal de confirmación cuando hay cambios en cliente/IVA */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Atención: Cambio en las condiciones del proyecto
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>Estás a punto de modificar este proyecto antes de registrar el pago.</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Nuevo Cliente:</strong> {nombreClienteSeleccionado}</li>
                  <li><strong>Nuevo Total del Proyecto:</strong> ${nuevoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
                </ul>
                <p>¿Estás seguro de aplicar estos cambios y registrar el pago?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doSave} className="min-h-[44px] bg-green-600 hover:bg-green-700">
              Confirmar y Guardar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default RegistrarPagoDialog;
