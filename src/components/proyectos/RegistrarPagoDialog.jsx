import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { notifyPagoRecibido } from '@/services/TelegramService';
import { registrarFactura } from '@/services/facturasService';
import { Loader2, Calendar as CalendarIcon, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { CUENTAS_PAGO, validarCobro, getCuenta, brandingToEntidad } from '@/config/cuentasPago';
import { empresaLabel } from '@/lib/facturacionDisplay';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const TIPOS_INGRESO = [
  { value: 'Anticipo', label: 'Anticipo' },
  { value: 'Estimación', label: 'Estimación' },
  { value: 'Liquidación', label: 'Liquidación' },
  { value: 'Anticipo por Partida', label: 'Anticipo por Partida' },
];

const ENTIDADES = [
  { value: 'tesey', label: 'TESEY' },
  { value: 'ipe', label: 'IIHEMSA Peninsular (IPE)' },
];

const round2 = (n) => Math.round(Number(n) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clamp = (n) => Math.max(0, Math.min(100, n));

const RegistrarPagoDialog = ({ open, onOpenChange, proyectoId, proyecto, pago: pagoEditar, onSave }) => {
  const { toast } = useToast();
  const { can } = usePermissions();
  const { user } = useAuth();
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(null);
  const [metodoPago, setMetodoPago] = useState('');
  const [tipoIngreso, setTipoIngreso] = useState('Anticipo');
  const [pctAnticipo, setPctAnticipo] = useState('');
  const [partidaId, setPartidaId] = useState('');
  const [partidas, setPartidas] = useState([]);
  const [comentarios, setComentarios] = useState('');
  const [cfdiFile, setCfdiFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [cotizacionIva, setCotizacionIva] = useState(null);
  const [pagadoActual, setPagadoActual] = useState(0);
  // Toggle "requiere factura"
  const [requiereCfdiLocal, setRequiereCfdiLocal] = useState(false);
  // IVA button state
  const [tieneFacturado, setTieneFacturado] = useState(false);
  const [ivaConfirmOpen, setIvaConfirmOpen] = useState(false);
  const [aplicandoIva, setAplicandoIva] = useState(false);
  // Sección "Ya facturado"
  const [yaFacturado, setYaFacturado] = useState(false);
  const [facturaNumero, setFacturaNumero] = useState('');
  const [facturaFecha, setFacturaFecha] = useState('');
  const [facturaEmisora, setFacturaEmisora] = useState('tesey');
  const fileInputRef = useRef(null);

  const isEditMode = Boolean(pagoEditar?.id);
  const tieneCotizacion = Boolean(proyecto?.cotizacion_id);
  const requiereCfdiOriginal = !!proyecto?.requiere_cfdi;
  const branding = cotizacionIva?.branding ?? proyecto?.branding ?? null;
  const aplicaIva = cotizacionIva?.aplica_iva ?? false; // solo lectura: del proyecto/cotización

  const costoTotal = Number(proyecto?.costo_total ?? cotizacionIva?.total ?? 0);
  const saldoPendiente = round2(costoTotal - pagadoActual);
  const pagadoProyectado = round2(pagadoActual + Number(monto || 0));
  const pctProgreso = costoTotal > 0 ? clamp(round2(pagadoProyectado / costoTotal * 100)) : 0;
  const pctMonto = costoTotal > 0 ? round2(Number(monto || 0) / costoTotal * 100) : 0;

  // Resumen del proyecto (solo lectura, derivado de la cotización)
  const { subtotal, ivaProyecto, totalProyecto } = useMemo(() => {
    const total = Number(cotizacionIva?.total ?? 0);
    const sub = aplicaIva ? round2(total / 1.16) : round2(total);
    return { subtotal: sub, ivaProyecto: round2(total - sub), totalProyecto: round2(total) };
  }, [cotizacionIva?.total, aplicaIva]);

  const avisoCobro = useMemo(
    () => validarCobro({
      requiereCfdi: tieneCotizacion ? aplicaIva : !!proyecto?.requiere_cfdi,
      cuentaValue: metodoPago,
      branding,
    }),
    [aplicaIva, metodoPago, tieneCotizacion, proyecto, branding]
  );

  const cuentaEntidad = getCuenta(metodoPago)?.entidad ?? null;

  // Derived values for +IVA button
  const puedeAgregarIva = can('cotizaciones', 'editar') && tieneCotizacion && cotizacionIva && cotizacionIva.aplica_iva === false;
  const ivaSubtotal = round2(cotizacionIva?.total ?? 0);
  const ivaMonto = round2(ivaSubtotal * 0.16);
  const ivaNuevoTotal = round2(ivaSubtotal * 1.16);

  useEffect(() => {
    if (!open) return;
    if (pagoEditar) {
      setMonto(String(pagoEditar.monto ?? ''));
      setFechaPago(pagoEditar.fecha_pago ? parseISO(pagoEditar.fecha_pago) : null);
      setMetodoPago(pagoEditar.cuenta_value ?? pagoEditar.metodo_pago ?? '');
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
      setPctAnticipo('');
    }
    setYaFacturado(false);
    setFacturaNumero('');
    setFacturaFecha(format(new Date(), 'yyyy-MM-dd'));
    setRequiereCfdiLocal(!!proyecto?.requiere_cfdi);
  }, [open, pagoEditar]);

  useEffect(() => {
    if (!open || !proyecto?.cotizacion_id) {
      setCotizacionIva(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('cotizaciones')
        .select('id, total, aplica_iva, branding, folio')
        .eq('id', proyecto.cotizacion_id)
        .single();
      if (cancelled) return;
      if (error || !data) { setCotizacionIva(null); return; }
      setCotizacionIva({ total: Number(data.total || 0), aplica_iva: data.aplica_iva !== false, branding: data.branding ?? null, folio: data.folio ?? null });
    })();
    return () => { cancelled = true; };
  }, [open, proyecto?.cotizacion_id]);

  // Default de emisora cuando se conoce el branding
  useEffect(() => {
    setFacturaEmisora(brandingToEntidad(branding) ?? 'tesey');
  }, [branding]);

  // Pagado actual del proyecto (excluye el pago en edición)
  useEffect(() => {
    if (!open || !proyectoId) { setPagadoActual(0); return; }
    let cancelled = false;
    supabase.from('proyecto_pagos').select('id, monto').eq('proyecto_id', proyectoId).then(({ data }) => {
      if (cancelled) return;
      const sum = (data || []).reduce((s, p) => s + (pagoEditar && p.id === pagoEditar.id ? 0 : Number(p.monto || 0)), 0);
      setPagadoActual(round2(sum));
    });
    return () => { cancelled = true; };
  }, [open, proyectoId, pagoEditar]);

  // Check if project has any invoiced payment (for IVA button guard)
  useEffect(() => {
    if (!open || !proyectoId) { setTieneFacturado(false); return; }
    let cancelled = false;
    supabase.from('proyecto_pagos').select('id, factura_id').eq('proyecto_id', proyectoId).not('factura_id', 'is', null).limit(1)
      .then(({ data }) => { if (!cancelled) setTieneFacturado((data || []).length > 0); });
    return () => { cancelled = true; };
  }, [open, proyectoId]);

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

  const handleTipoChange = (v) => {
    setTipoIngreso(v);
    setPartidaId('');
    if (!isEditMode && v === 'Liquidación') setMonto(String(saldoPendiente > 0 ? saldoPendiente : 0));
  };

  const handlePctChange = (v) => {
    setPctAnticipo(v);
    if (v !== '' && costoTotal > 0) setMonto(String(round2(Number(v) / 100 * costoTotal)));
  };

  const buildComentarios = () => {
    if (isAnticipoPartida && partidaId) {
      const partidaDesc = partidas.find((p) => String(p.id) === partidaId)?.descripcion || partidaId;
      return (comentarios ? `${comentarios}\n` : '') + `Anticipo por Partida: ${partidaDesc}`;
    }
    return comentarios || null;
  };

  const doSave = async () => {
    if (!monto || !fechaPago || !metodoPago) {
      toast({ variant: 'destructive', title: 'Error', description: 'Monto, fecha y método de pago son requeridos.' });
      return;
    }
    if (isAnticipoPartida && !partidaId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona la partida de la cotización.' });
      return;
    }
    if (yaFacturado && (!facturaNumero.trim() || !facturaFecha)) {
      toast({ variant: 'destructive', title: 'Falta la factura', description: 'Folio y fecha de factura son obligatorios si marcas "Ya facturado".' });
      return;
    }
    if (isEditMode && !window.confirm('¿Estás seguro de actualizar este pago?')) return;
    // Aviso (no bloqueante) si la liquidación no cierra el saldo
    if (!isEditMode && tipoIngreso === 'Liquidación' && round2(Number(monto)) !== saldoPendiente) {
      toast({ title: 'Aviso', description: `La liquidación ($${money(monto)}) no cierra el saldo ($${money(saldoPendiente)}).` });
    }
    setIsSaving(true);

    const sanitizeFilename = (filename) => filename.replace(/[^a-zA-Z0-9-_.]/g, '_');

    try {
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
          cuenta_value: metodoPago,
          comentarios: buildComentarios(),
        };
        if (cfdiUrl != null) payload.url_cfdi = cfdiUrl;
        const { error: dbError } = await supabase.from('proyecto_pagos').update(payload).eq('id', pagoEditar.id);
        if (dbError) throw new Error(dbError.message);
        toast({ title: '✅ Pago actualizado' });
      } else {
        const { data: nuevoCobro, error: dbError } = await supabase.from('proyecto_pagos').insert({
          proyecto_id: proyectoId,
          monto: parseFloat(monto),
          fecha_pago: format(fechaPago, 'yyyy-MM-dd'),
          metodo_pago: metodoPago,
          cuenta_value: metodoPago,
          comentarios: buildComentarios(),
          url_cfdi: cfdiUrl ?? null,
        }).select('id').single();
        if (dbError) throw new Error(dbError.message);
        notifyPagoRecibido({
          proyectoNombre: proyecto?.descripcion,
          referencia: comentarios || undefined,
          folio: proyecto?.folio,
        });
        if (yaFacturado && nuevoCobro?.id) {
          const { error: facErr } = await registrarFactura({
            proyectoId,
            empresaEmisora: facturaEmisora,
            numero: facturaNumero.trim(),
            fechaEmision: facturaFecha,
            monto: parseFloat(monto),
            cobroIds: [nuevoCobro.id],
          });
          if (facErr) {
            const dup = /facturas_numero_unico|duplicate key/i.test(facErr.message);
            toast({ variant: 'destructive', title: 'Pago guardado, factura pendiente', description: dup ? `El folio "${facturaNumero}" ya existe; regístralo desde la tabla.` : facErr.message });
          } else {
            toast({ title: '✅ Pago y factura registrados' });
          }
        } else {
          toast({ title: '✅ Pago Registrado' });
        }
      }
      // Persist requiere_cfdi toggle if changed
      if (proyecto?.id && requiereCfdiLocal !== requiereCfdiOriginal) {
        await supabase.from('proyectos').update({ requiere_cfdi: requiereCfdiLocal }).eq('id', proyecto.id);
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
          {/* Columna 1: Detalles del Ingreso */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Detalles del Ingreso</h3>
            <div className="space-y-2">
              <Label>Tipo de ingreso</Label>
              <Select value={tipoIngreso} onValueChange={handleTipoChange}>
                <SelectTrigger className="p-3 h-auto"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_INGRESO.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {tipoIngreso === 'Anticipo' && !isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="pct-anticipo">% del anticipo (sobre el total)</Label>
                <div className="flex items-center gap-2">
                  <Input id="pct-anticipo" type="number" step="1" value={pctAnticipo} onChange={(e) => handlePctChange(e.target.value)} placeholder="Ej. 50" className="p-3 h-auto w-28" />
                  <div className="flex gap-1">
                    {[25, 50, 100].map((q) => (
                      <Button key={q} type="button" variant="outline" size="sm" onClick={() => handlePctChange(String(q))}>{q}%</Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
              <Input id="monto" type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej. 5000.00" className="p-3 h-auto" />
              {costoTotal > 0 && monto && (
                <p className="text-xs text-gray-500">≈ {Math.round(pctMonto)}% del total del proyecto</p>
              )}
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
                  {CUENTAS_PAGO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {avisoCobro.mensaje && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  ⚠️ {avisoCobro.mensaje}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ref-comentarios">Referencia / Comentarios</Label>
              <textarea id="ref-comentarios" value={comentarios} onChange={(e) => setComentarios(e.target.value)} className="w-full p-3 border rounded-lg min-h-[80px]" rows={2} placeholder="Ej. Anticipo 50%..." />
            </div>

            <div className="space-y-2">
              <Label>Adjuntar CFDI (opcional)</Label>
              <div className="flex justify-center items-center px-4 py-5 border-2 border-dashed rounded-lg cursor-pointer min-h-[100px]" onClick={() => fileInputRef.current?.click()}>
                {cfdiFile ? (
                  <p className="font-semibold text-blue-600 truncate max-w-full">{cfdiFile.name}</p>
                ) : (
                  <span className="text-sm text-muted-foreground">Toca para subir (XML, PDF)</span>
                )}
              </div>
              <input ref={fileInputRef} type="file" className="sr-only" onChange={handleFileChange} accept=".xml,.pdf" />
            </div>
          </div>

          {/* Columna 2: Receptora, progreso, resumen y factura */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Estatus del Proyecto</h3>

            {/* Receptora (solo lectura) */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Empresa (factura)</p>
                <p className="font-medium">{empresaLabel(branding)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Cuenta receptora</p>
                <p className="font-medium capitalize">{cuentaEntidad ? (cuentaEntidad === 'ipe' ? 'IIHEMSA Peninsular' : cuentaEntidad === 'tesey' ? 'Tesey' : cuentaEntidad) : (metodoPago ? 'Indistinta' : '—')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Cliente</p>
                <p className="font-medium">{proyecto?.cliente?.nombre ?? proyecto?.cliente_nombre_externo ?? '—'}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-gray-500">Cotización</p>
                <p className="font-medium font-mono text-sm">{cotizacionIva?.folio ?? (proyecto?.cotizacion_folio ?? '—')}</p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="req-cfdi" className="text-base">El cliente requiere factura</Label>
                <p className="text-xs text-muted-foreground">No cambia el precio; solo marca que lleva CFDI</p>
              </div>
              <Switch id="req-cfdi" checked={requiereCfdiLocal} onCheckedChange={setRequiereCfdiLocal} />
            </div>

            {/* Barra de progreso de pago */}
            {costoTotal > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 border">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Progreso de pago</span>
                  <span className="font-semibold">{Math.round(pctProgreso)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-600" style={{ width: `${pctProgreso}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Pagado: ${money(pagadoProyectado)}</span>
                  <span>Saldo: ${money(round2(costoTotal - pagadoProyectado))}</span>
                </div>
              </div>
            )}

            {/* Resumen del proyecto (solo lectura) */}
            {cotizacionIva && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 border">
                <p className="text-sm font-semibold text-gray-700">Resumen del proyecto</p>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-medium">${money(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">IVA</span><span className="font-medium">${money(ivaProyecto)}</span></div>
                <div className="flex justify-between text-base font-bold pt-2 border-t"><span>Total</span><span className="text-green-700">${money(totalProyecto)}</span></div>
                <p className="text-[11px] text-gray-400">{aplicaIva ? 'IVA incluido' : 'Sin IVA'}</p>
              </div>
            )}

            {/* Sección "Ya facturado" */}
            {!isEditMode && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="ya-facturado" className="text-base">Este pago ya está facturado</Label>
                    <p className="text-xs text-muted-foreground">Captura el folio si facturas antes/al cobrar</p>
                  </div>
                  <Switch id="ya-facturado" checked={yaFacturado} onCheckedChange={setYaFacturado} />
                </div>
                {yaFacturado && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1"><Label>Folio *</Label><Input value={facturaNumero} onChange={(e) => setFacturaNumero(e.target.value)} placeholder="A-1009" /></div>
                      <div className="space-y-1"><Label>Fecha *</Label><Input type="date" value={facturaFecha} onChange={(e) => setFacturaFecha(e.target.value)} /></div>
                    </div>
                    <div className="space-y-1">
                      <Label>Emisora</Label>
                      <Select value={facturaEmisora} onValueChange={setFacturaEmisora}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ENTIDADES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botón "Agregar IVA al precio" — solo si sin IVA + permiso */}
            {puedeAgregarIva && (
              <div className="rounded-lg border border-amber-200 p-3 space-y-2">
                <p className="text-sm font-medium text-amber-800">Este proyecto está sin IVA</p>
                <Button type="button" variant="outline" className="w-full" disabled={tieneFacturado || aplicandoIva}
                  onClick={() => setIvaConfirmOpen(true)}>
                  Agregar IVA al precio (+16%)
                </Button>
                {tieneFacturado && <p className="text-xs text-red-600">No se puede: ya hay un cobro facturado.</p>}
              </div>
            )}
          </div>
        </div>

        <AlertDialog open={ivaConfirmOpen} onOpenChange={setIvaConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Agregar IVA al precio</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-1">
                  <p>El total del proyecto cambiará:</p>
                  <p className="font-semibold">${money(ivaSubtotal)} → ${money(ivaNuevoTotal)} (+${money(ivaMonto)} de IVA)</p>
                  <p className="text-amber-700">Esto cambia el precio acordado y marca el proyecto como facturable.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={aplicandoIva}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-amber-600 hover:bg-amber-700"
                onClick={async (e) => {
                  e.preventDefault();
                  setAplicandoIva(true);
                  try {
                    const { error: e1 } = await supabase.from('cotizaciones').update({ aplica_iva: true, total: ivaNuevoTotal, iva_aplicado_por: user?.id ?? null, iva_aplicado_at: new Date().toISOString() }).eq('id', proyecto.cotizacion_id);
                    if (e1) throw e1;
                    const { error: e2 } = await supabase.from('proyectos').update({ requiere_cfdi: true, costo_total: ivaNuevoTotal }).eq('id', proyecto.id);
                    if (e2) throw e2;
                    setCotizacionIva((c) => c ? { ...c, aplica_iva: true, total: ivaNuevoTotal } : c);
                    toast({ title: '✅ IVA agregado al precio' });
                    setIvaConfirmOpen(false);
                    onSave?.();
                  } catch (err) {
                    toast({ variant: 'destructive', title: 'Error', description: err.message });
                  } finally {
                    setAplicandoIva(false);
                  }
                }}>
                Confirmar y agregar IVA
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
            <Button onClick={doSave} disabled={isSaving || isDeleting} className="min-h-[44px] gap-2">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEditMode ? 'Guardar Cambios' : 'Guardar Pago'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrarPagoDialog;
