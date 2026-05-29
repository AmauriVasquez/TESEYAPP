import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import InteraccionForm from '@/components/crm/InteraccionForm';
import CitaForm from '@/components/crm/CitaForm';
import MarcarRealizadaForm from '@/components/crm/MarcarRealizadaForm';
import CotizacionDialog from '@/components/cotizaciones/CotizacionDialog';

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

const ProspectoDetalle = ({ open, onOpenChange, prospecto, onRefetch }) => {
  const { toast } = useToast();
  const [interacciones, setInteracciones] = useState([]);
  const [loadingInteracciones, setLoadingInteracciones] = useState(false);
  const [interaccionFormOpen, setInteraccionFormOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [citaFormOpen, setCitaFormOpen] = useState(false);
  const [marcarRealizadaOpen, setMarcarRealizadaOpen] = useState(false);
  const [selectedCita, setSelectedCita] = useState(null);
  const [cotizacionOpen, setCotizacionOpen] = useState(false);

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

  useEffect(() => {
    if (open && prospecto?.id) {
      fetchInteracciones();
    } else {
      setInteracciones([]);
    }
  }, [open, prospecto?.id, fetchInteracciones]);

  if (!prospecto) return null;

  const marcaClass = MARCA_BADGE[prospecto.marca_origen] || 'bg-gray-100 text-gray-800';
  const etapaClass = ETAPA_BADGE[prospecto.etapa] || 'bg-gray-100 text-gray-800';
  const puedeConvertir = prospecto.etapa !== 'convertido' && prospecto.etapa !== 'descartado';

  const handleConvertir = async () => {
    setIsConverting(true);
    try {
      const { data, error } = await supabase.rpc('crm_convertir_prospecto', {
        p_prospecto_id: prospecto.id,
        p_cliente_id: null,
      });

      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.mensaje || 'No se pudo convertir el prospecto.');
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
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${etapaClass}`}>
                {ETAPA_LABEL[prospecto.etapa] || prospecto.etapa}
              </span>
            </div>
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
          </DialogHeader>

          <Tabs defaultValue="resumen" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="resumen" className="flex-1">
                Resumen
              </TabsTrigger>
              <TabsTrigger value="interacciones" className="flex-1">
                Interacciones
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
                  onClick={() => setInteraccionFormOpen(true)}
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
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <InteraccionForm
        open={interaccionFormOpen}
        onOpenChange={setInteraccionFormOpen}
        prospectoId={prospecto.id}
        marcaOrigen={prospecto.marca_origen || 'tesey'}
        onSave={fetchInteracciones}
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
    </>
  );
};

export default ProspectoDetalle;
