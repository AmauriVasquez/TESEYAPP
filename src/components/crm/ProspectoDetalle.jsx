import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone,
  Mail,
  MessageCircle,
  MapPin,
  Users,
  FileText,
  Loader2,
  UserCheck,
  Globe,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  ExternalLink,
  Pencil,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import InteraccionForm from '@/components/crm/InteraccionForm';
import CitaForm from '@/components/crm/CitaForm';
import MarcarRealizadaForm from '@/components/crm/MarcarRealizadaForm';
import CotizacionDialog from '@/components/cotizaciones/CotizacionDialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';

const MARCA_BADGE = {
  tesey: 'bg-emerald-100 text-emerald-800',
  kutra: 'bg-amber-100 text-amber-800',
  arkeo: 'bg-purple-100 text-purple-800',
};

const ETAPA_BADGE = {
  nuevo: 'bg-gray-100 text-gray-800',
  contactado: 'bg-blue-100 text-blue-800',
  propuesta_enviada: 'bg-yellow-100 text-yellow-800',
  en_negociacion: 'bg-orange-100 text-orange-800',
  convertido: 'bg-green-100 text-green-800',
  descartado: 'bg-red-100 text-red-800',
};

const ETAPA_LABEL = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  propuesta_enviada: 'Propuesta enviada',
  en_negociacion: 'En negociación',
  convertido: 'Convertido',
  descartado: 'Descartado',
};

const FUENTE_LABEL = {
  referido: 'Referido',
  redes_sociales: 'Redes sociales',
  web: 'Web',
  visita_directa: 'Visita directa',
  feria: 'Feria',
  llamada_fria: 'Llamada en frío',
  otro: 'Otro',
};

const ETAPAS_MANUALES = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'propuesta_enviada', label: 'Propuesta enviada' },
  { value: 'en_negociacion', label: 'En negociación' },
];

const ESTATUS_COT_BADGE = {
  Borrador: 'bg-gray-100 text-gray-800',
  Enviada: 'bg-blue-100 text-blue-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Historial: 'bg-slate-200 text-slate-700',
  Obsoleta: 'bg-slate-200 text-slate-600',
};

const TIPO_ICON = {
  llamada: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  visita: MapPin,
  reunion: Users,
  nota_interna: FileText,
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value + (String(value).includes('T') ? '' : 'T00:00:00')).toLocaleDateString('es-MX');
};

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-MX', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TIPO_CITA_COLOR = {
  llamada: 'bg-blue-100 text-blue-800',
  whatsapp: 'bg-green-100 text-green-800',
  visita: 'bg-orange-100 text-orange-800',
};

const ResumenField = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-900">{value ?? '—'}</p>
  </div>
);

const ProspectoDetalle = ({ open, onOpenChange, prospecto, onRefetch, onEdit }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [interacciones, setInteracciones] = useState([]);
  const [loadingInteracciones, setLoadingInteracciones] = useState(false);
  const [interaccionFormOpen, setInteraccionFormOpen] = useState(false);
  const [interaccionEditar, setInteraccionEditar] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [citaFormOpen, setCitaFormOpen] = useState(false);
  const [marcarRealizadaOpen, setMarcarRealizadaOpen] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [cotizacionOpen, setCotizacionOpen] = useState(false);
  const [etapaPendiente, setEtapaPendiente] = useState(null);
  const [confirmEtapaOpen, setConfirmEtapaOpen] = useState(false);
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [motivoModalOpen, setMotivoModalOpen] = useState(false);
  const [isUpdatingEtapa, setIsUpdatingEtapa] = useState(false);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false);
  const [cotizacionesLoaded, setCotizacionesLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');

  const fetchInteracciones = useCallback(async () => {
    if (!prospecto?.id) return;
    setLoadingInteracciones(true);
    const { data, error } = await supabase
      .from('crm_interacciones')
      .select('*')
      .eq('prospecto_id', prospecto.id)
      .eq('eliminado', false)
      .order('fecha', { ascending: false });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las interacciones.',
      });
      setInteracciones([]);
    } else {
      setInteracciones(data || []);
    }
    setLoadingInteracciones(false);
  }, [prospecto?.id, toast]);

  const fetchCotizaciones = useCallback(async () => {
    if (!prospecto?.id) return;
    setLoadingCotizaciones(true);
    const { data, error } = await supabase
      .from('cotizaciones')
      .select('id, folio, descripcion, fecha, total, estatus')
      .eq('prospecto_id', prospecto.id)
      .eq('es_ultima_version', true)
      .order('fecha', { ascending: false });
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las cotizaciones.' });
      setCotizaciones([]);
    } else {
      setCotizaciones(data || []);
      setCotizacionesLoaded(true);
    }
    setLoadingCotizaciones(false);
  }, [prospecto?.id, toast]);

  useEffect(() => {
    if (open && prospecto?.id) {
      fetchInteracciones();
      setActiveTab('resumen');
      setCotizaciones([]);
      setCotizacionesLoaded(false);
    } else {
      setInteracciones([]);
      setCotizaciones([]);
      setCotizacionesLoaded(false);
      setLoadingCotizaciones(false);
    }
  }, [open, prospecto?.id, fetchInteracciones]);

  if (!prospecto) return null;

  const marcaClass = MARCA_BADGE[prospecto.marca_origen] || 'bg-gray-100 text-gray-800';
  const etapaClass = ETAPA_BADGE[prospecto.etapa] || 'bg-gray-100 text-gray-800';
  const puedeConvertir = prospecto.etapa !== 'convertido' && prospecto.etapa !== 'descartado';
  const tieneClienteVinculado = prospecto.etapa === 'convertido' && prospecto.cliente_id != null;

  // Mantiene el árbol de Ventas si el prospecto se abrió desde ahí; si no, ruta clásica.
  const clientesBase = pathname.startsWith('/ventas') ? '/ventas/clientes' : '/clientes';

  const handleVerCliente = () => {
    onOpenChange(false);
    navigate(`${clientesBase}?cliente=${prospecto.cliente_id}`);
  };

  const handleEtapaSelect = (etapa) => {
    setEtapaPendiente(etapa);
    if (etapa === 'descartado') {
      setMotivoDescarte('');
      setMotivoModalOpen(true);
    } else {
      setConfirmEtapaOpen(true);
    }
  };

  const handleConfirmEtapa = async () => {
    if (isUpdatingEtapa) return;
    setIsUpdatingEtapa(true);
    try {
      const { error } = await supabase
        .from('prospectos')
        .update({ etapa: etapaPendiente, motivo_descarte: null })
        .eq('id', prospecto.id);
      if (error) throw error;
      setConfirmEtapaOpen(false);
      toast({
        title: 'Etapa actualizada',
        description: `El prospecto pasó a: ${ETAPA_LABEL[etapaPendiente]}`,
      });
      onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsUpdatingEtapa(false);
      setEtapaPendiente(null);
    }
  };

  const handleDescartarConfirm = async () => {
    if (isUpdatingEtapa) return;
    setIsUpdatingEtapa(true);
    try {
      const { error } = await supabase
        .from('prospectos')
        .update({ etapa: 'descartado', motivo_descarte: motivoDescarte.trim() || null })
        .eq('id', prospecto.id);
      if (error) throw error;
      setMotivoModalOpen(false);
      toast({ title: 'Prospecto descartado' });
      onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsUpdatingEtapa(false);
      setMotivoDescarte('');
      setEtapaPendiente(null);
    }
  };

  const handleConvertir = async () => {
    setIsConverting(true);
    try {
      const { data, error } = await supabase.rpc('crm_convertir_prospecto', {
        p_prospecto_id: prospecto.id,
        p_cliente_id: null,
      });

      if (error) throw error;
      if (!data?.ok) {
        // La RPC retorna { ok:false, error:'...' } (no 'mensaje').
        throw new Error(data?.error || 'No se pudo convertir el prospecto.');
      }

      toast({
        title: 'Prospecto convertido a cliente',
        description: 'El prospecto se registró como cliente correctamente.',
      });
      onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo convertir el prospecto.',
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    if (value === 'cotizaciones' && !cotizacionesLoaded) {
      fetchCotizaciones();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            {prospecto.folio && (
              <p className="text-xs text-gray-500 font-mono">{prospecto.folio}</p>
            )}
            <DialogTitle className="text-left">{prospecto.nombre}</DialogTitle>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {prospecto.marca_origen && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${marcaClass}`}>
                  {prospecto.marca_origen.toUpperCase()}
                </span>
              )}
              {prospecto.etapa === 'convertido' ? (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${etapaClass}`}>
                  {ETAPA_LABEL[prospecto.etapa]}
                </span>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      disabled={isUpdatingEtapa}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${etapaClass} hover:opacity-80 transition-opacity disabled:opacity-50`}
                    >
                      {isUpdatingEtapa ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <>
                          {ETAPA_LABEL[prospecto.etapa] || prospecto.etapa}
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {ETAPAS_MANUALES.map((e) => (
                      <DropdownMenuItem
                        key={e.value}
                        disabled={e.value === prospecto.etapa}
                        onClick={() => handleEtapaSelect(e.value)}
                        className={e.value === prospecto.etapa ? 'font-semibold text-blue-700' : ''}
                      >
                        {e.value === prospecto.etapa ? `✓ ${e.label}` : e.label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={prospecto.etapa === 'descartado'}
                      onClick={() => handleEtapaSelect('descartado')}
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      Descartar…
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {onEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 gap-2"
                onClick={() => onEdit(prospecto)}
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
            {puedeConvertir && (
              <Button
                type="button"
                size="sm"
                className="mt-2 bg-green-600 hover:bg-green-700 text-white gap-2"
                onClick={handleConvertir}
                disabled={isConverting}
              >
                {isConverting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserCheck className="w-4 h-4" />
                )}
                Convertir a cliente
              </Button>
            )}
            {puedeConvertir && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 ml-2 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setCotizacionOpen(true)}
              >
                <FilePlus2 className="w-4 h-4" />
                Generar cotización
              </Button>
            )}
            {tieneClienteVinculado && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 gap-2 border-green-300 text-green-700 hover:bg-green-50"
                onClick={handleVerCliente}
              >
                <ExternalLink className="w-4 h-4" />
                Ver cliente
              </Button>
            )}
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="resumen" className="flex-1">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="interacciones" className="flex-1">
                Interacciones
              </TabsTrigger>
              <TabsTrigger value="cotizaciones" className="flex-1">
                Cotizaciones
                {cotizaciones.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {cotizaciones.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 mt-4">
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contacto</p>

                {prospecto.nombre_contacto && (
                  <ResumenField label="Persona de contacto" value={prospecto.nombre_contacto} />
                )}

                {/* Teléfono + Email lado a lado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Teléfono</p>
                    {prospecto.telefono ? (
                      <a
                        href={`tel:${prospecto.telefono}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {prospecto.telefono}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-400">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    {prospecto.email ? (
                      <a
                        href={`mailto:${prospecto.email}`}
                        className="text-sm font-medium text-blue-600 hover:underline break-all"
                      >
                        {prospecto.email}
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-gray-400">—</p>
                    )}
                  </div>
                </div>

                {/* Sitio web — fila completa */}
                <div>
                  <p className="text-xs text-gray-500">Sitio web</p>
                  {prospecto.sitio_web ? (
                    <a
                      href={prospecto.sitio_web.startsWith('http') ? prospecto.sitio_web : `https://${prospecto.sitio_web}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1 break-all"
                    >
                      <Globe className="w-3 h-3 shrink-0" />
                      {prospecto.sitio_web}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-gray-400">—</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <ResumenField label="Valor estimado" value={formatMXN(prospecto.valor_estimado)} />
                <ResumenField
                  label="Probabilidad"
                  value={`${prospecto.probabilidad ?? 0}%`}
                />
                <ResumenField
                  label="Etapa"
                  value={ETAPA_LABEL[prospecto.etapa] || prospecto.etapa}
                />
                <ResumenField
                  label="Fuente"
                  value={FUENTE_LABEL[prospecto.fuente] || prospecto.fuente}
                />
                <ResumenField
                  label="Fecha cierre estimada"
                  value={formatDate(prospecto.fecha_cierre_estimada)}
                />
                <ResumenField label="Ciudad" value={prospecto.ciudad} />
                <ResumenField label="Estado" value={prospecto.estado} />
                <ResumenField label="Industria" value={prospecto.industria} />
              </div>
              {prospecto.motivo_descarte && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-semibold mb-1">Motivo de descarte</p>
                  <p>{prospecto.motivo_descarte}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="interacciones" className="mt-4 space-y-4">
              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                  onClick={() => setCitaFormOpen(true)}
                >
                  <CalendarDays className="w-4 h-4" />
                  Programar cita
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => { setInteraccionEditar(null); setInteraccionFormOpen(true); }}
                >
                  + Registrar interacción
                </Button>
              </div>

              {loadingInteracciones ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                <>
                  {/* Pending appointments */}
                  {interacciones.filter((i) => i.programada).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">
                        Citas pendientes
                      </p>
                      <ul className="space-y-2">
                        {interacciones
                          .filter((i) => i.programada)
                          .sort(
                            (a, b) =>
                              new Date(a.fecha_hora_programada) -
                              new Date(b.fecha_hora_programada)
                          )
                          .map((item) => {
                            const Icon = TIPO_ICON[item.tipo] || FileText;
                            const colorClass =
                              TIPO_CITA_COLOR[item.tipo] || 'bg-gray-100 text-gray-800';
                            return (
                              <li
                                key={item.id}
                                className="flex gap-3 border border-indigo-100 rounded-lg p-3 bg-indigo-50"
                              >
                                <Icon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
                                    >
                                      {item.tipo.charAt(0).toUpperCase() + item.tipo.slice(1)}
                                    </span>
                                    <p className="text-sm font-semibold text-indigo-900">
                                      {formatDateTime(item.fecha_hora_programada)}
                                    </p>
                                  </div>
                                  {item.descripcion && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      {item.descripcion}
                                    </p>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="mt-2 h-7 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                                    onClick={() => {
                                      setSelectedCita(item);
                                      setMarcarRealizadaOpen(true);
                                    }}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Marcar como realizada
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  )}

                  {/* Interaction history */}
                  <div>
                    {interacciones.filter((i) => !i.programada).length > 0 && (
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Historial
                      </p>
                    )}
                    {interacciones.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        Sin interacciones registradas. Registra la primera.
                      </p>
                    ) : interacciones.filter((i) => !i.programada).length === 0 ? null : (
                      <ul className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                        {interacciones
                          .filter((i) => !i.programada)
                          .map((item) => {
                            const Icon = TIPO_ICON[item.tipo] || FileText;
                            return (
                              <li
                                key={item.id}
                                className="flex gap-3 border rounded-lg p-3 bg-gray-50"
                              >
                                <Icon className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm text-gray-900">{item.descripcion}</p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {formatDate(item.fecha)}
                                  </p>
                                  {item.proxima_accion && (
                                    <p className="text-xs text-blue-700 mt-1">
                                      Próxima: {item.proxima_accion}
                                      {item.fecha_proxima_accion
                                        ? ` · ${formatDate(item.fecha_proxima_accion)}`
                                        : ''}
                                    </p>
                                  )}
                                  {item.fecha_hora_programada && item.programada && (
                                    <p className="text-xs text-indigo-600 mt-1">
                                      📅 Seguimiento: {formatDate(item.fecha_hora_programada)}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  className="text-xs text-gray-400 hover:text-blue-600 shrink-0 px-1 py-0.5 rounded hover:bg-blue-50 transition-colors"
                                  onClick={() => {
                                    setInteraccionEditar(item);
                                    setInteraccionFormOpen(true);
                                  }}
                                  title="Editar interacción"
                                >
                                  ✏️
                                </button>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="cotizaciones" className="mt-4">
              {loadingCotizaciones ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : cotizaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <p className="text-sm">Sin cotizaciones registradas.</p>
                  {puedeConvertir && (
                    <p className="text-xs mt-1 text-gray-400">
                      Usa "Generar cotización" para crear una.
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                        <th className="text-left py-2 px-2 font-semibold">Folio</th>
                        <th className="text-left py-2 px-2 font-semibold">Descripción</th>
                        <th className="text-left py-2 px-2 font-semibold">Fecha</th>
                        <th className="text-right py-2 px-2 font-semibold">Total</th>
                        <th className="text-center py-2 px-2 font-semibold">Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotizaciones.map((cot) => (
                        <tr key={cot.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 px-2 font-mono text-xs text-gray-700">{cot.folio}</td>
                          <td className="py-2 px-2 text-gray-700 max-w-[130px]">
                            <span className="block truncate" title={cot.descripcion}>
                              {cot.descripcion}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                            {formatDate(cot.fecha)}
                          </td>
                          <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                            {formatMXN(cot.total)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                ESTATUS_COT_BADGE[cot.estatus] ?? 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {cot.estatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <InteraccionForm
        open={interaccionFormOpen}
        onOpenChange={(val) => {
          setInteraccionFormOpen(val);
          if (!val) setInteraccionEditar(null);
        }}
        prospectoId={prospecto.id}
        marcaOrigen={prospecto.marca_origen || 'tesey'}
        onSave={fetchInteracciones}
        interaccion={interaccionEditar}
      />

      <CitaForm
        open={citaFormOpen}
        onOpenChange={setCitaFormOpen}
        prospectoId={prospecto.id}
        marcaOrigen={prospecto.marca_origen || 'tesey'}
        onSave={fetchInteracciones}
      />

      <MarcarRealizadaForm
        open={marcarRealizadaOpen}
        onOpenChange={setMarcarRealizadaOpen}
        interaccion={selectedCita}
        prospectoId={prospecto.id}
        onSave={fetchInteracciones}
        onRefetch={onRefetch}
      />

      <CotizacionDialog
        open={cotizacionOpen}
        onOpenChange={setCotizacionOpen}
        prospecto={prospecto}
        onSave={() => {
          setCotizacionOpen(false);
          onRefetch?.();
        }}
      />

      {/* Confirmación cambio de etapa */}
      <AlertDialog open={confirmEtapaOpen} onOpenChange={(open) => { setConfirmEtapaOpen(open); if (!open) setEtapaPendiente(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar etapa?</AlertDialogTitle>
            <AlertDialogDescription>
              El prospecto <span className="font-semibold">{prospecto.nombre}</span> pasará
              a: <span className="font-semibold">{ETAPA_LABEL[etapaPendiente]}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEtapaPendiente(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEtapa}
              disabled={isUpdatingEtapa}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUpdatingEtapa ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</>
              ) : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal motivo de descarte */}
      <AlertDialog open={motivoModalOpen} onOpenChange={(open) => { setMotivoModalOpen(open); if (!open) setEtapaPendiente(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar prospecto</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Deseas indicar el motivo del descarte? (opcional)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Textarea
              placeholder="Ej. Presupuesto insuficiente, sin respuesta..."
              value={motivoDescarte}
              onChange={(e) => setMotivoDescarte(e.target.value)}
              className="h-20 resize-none"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEtapaPendiente(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDescartarConfirm}
              disabled={isUpdatingEtapa}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUpdatingEtapa ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</>
              ) : 'Descartar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProspectoDetalle;
