import React, { useState, useEffect, useCallback } from 'react';
import { Building, Mail, Phone, MapPin, FileText, User, Pencil, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import ClienteResumenCards from '@/components/clientes/ClienteResumenCards';

const ESTATUS_COT_BADGE = {
  Borrador: 'bg-gray-100 text-gray-800',
  Enviada: 'bg-blue-100 text-blue-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Historial: 'bg-slate-200 text-slate-700',
  Obsoleta: 'bg-slate-200 text-slate-600',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(
    value + (String(value).includes('T') ? '' : 'T00:00:00')
  ).toLocaleDateString('es-MX');
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(value) || 0);

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
    <Icon className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5 break-words">{value || '—'}</p>
    </div>
  </div>
);

const ClienteDetalle = ({ open, onOpenChange, cliente, onEdit }) => {
  const { toast } = useToast();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false);
  const [cotizacionesLoaded, setCotizacionesLoaded] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenError, setResumenError] = useState(false);

  const fetchCotizaciones = useCallback(async () => {
    if (!cliente?.id) return;
    setLoadingCotizaciones(true);
    const { data, error } = await supabase
      .from('cotizaciones')
      .select('id, folio, descripcion, fecha, total, estatus')
      .eq('cliente_id', cliente.id)
      .eq('es_ultima_version', true)
      .order('fecha', { ascending: false });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las cotizaciones.',
      });
      setCotizaciones([]);
      // Do NOT set cotizacionesLoaded — allows retry by clicking tab again
    } else {
      setCotizaciones(data || []);
      setCotizacionesLoaded(true);
    }
    setLoadingCotizaciones(false);
  }, [cliente?.id, toast]);

  useEffect(() => {
    if (!open) {
      setCotizaciones([]);
      setCotizacionesLoaded(false);
      setLoadingCotizaciones(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !cliente?.id) {
      setResumen(null);
      setResumenError(false);
      return;
    }
    let cancelled = false;
    setResumenLoading(true);
    setResumenError(false);
    supabase
      .rpc('get_cliente_resumen', { p_cliente_id: cliente.id })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setResumenError(true);
          setResumen(null);
        } else {
          setResumen(Array.isArray(data) ? data[0] ?? null : data);
        }
      })
      .finally(() => {
        if (!cancelled) setResumenLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, cliente?.id]);

  const handleTabChange = (value) => {
    if (value === 'cotizaciones' && !cotizacionesLoaded) {
      fetchCotizaciones();
    }
  };

  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            {cliente.nombre}
          </DialogTitle>
          {onEdit && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 gap-2 w-fit"
              onClick={() => onEdit(cliente)}
            >
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
          )}
        </DialogHeader>

        <div className="mt-3">
          <ClienteResumenCards resumen={resumen} loading={resumenLoading} error={resumenError} />
        </div>

        <Tabs defaultValue="informacion" onValueChange={handleTabChange} className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="informacion" className="flex-1">
              Información
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

          <TabsContent value="informacion" className="mt-4">
            <div className="space-y-1 py-2">
              <InfoRow
                icon={Building}
                label="Nombre comercial / Razón social"
                value={cliente.nombre}
              />
              <InfoRow
                icon={User}
                label="Nombre del contacto"
                value={cliente.nombre_contacto || cliente.nombre}
              />
              <InfoRow icon={FileText} label="RFC" value={cliente.rfc} />
              <InfoRow icon={Mail} label="Correo electrónico" value={cliente.email} />
              <InfoRow icon={Phone} label="Teléfono" value={cliente.telefono} />
              <InfoRow
                icon={MapPin}
                label="Dirección fiscal / Entrega"
                value={cliente.direccion}
              />
              {cliente.observaciones != null && cliente.observaciones !== '' && (
                <InfoRow icon={FileText} label="Observaciones" value={cliente.observaciones} />
              )}
            </div>
          </TabsContent>

          <TabsContent value="cotizaciones" className="mt-4">
            {loadingCotizaciones ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : cotizaciones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <p className="text-sm">Sin cotizaciones registradas para este cliente.</p>
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
                        <td className="py-2 px-2 font-mono text-xs text-gray-700">
                          {cot.folio}
                        </td>
                        <td className="py-2 px-2 text-gray-700 max-w-[160px]">
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
  );
};

export default ClienteDetalle;
