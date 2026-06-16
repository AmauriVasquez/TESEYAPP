import React, { useState, useEffect, useCallback } from 'react';
import { Building, Mail, Phone, MapPin, FileText, User, Pencil, PackageCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import ClienteCotizacionesTabla from '@/components/clientes/ClienteCotizacionesTabla';

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
  const navigate = useNavigate();
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loadingCotizaciones, setLoadingCotizaciones] = useState(false);
  const [cotizacionesLoaded, setCotizacionesLoaded] = useState(false);
  const [cotizacionesError, setCotizacionesError] = useState(false);
  const [resumen, setResumen] = useState(null);
  const [resumenLoading, setResumenLoading] = useState(false);
  const [resumenError, setResumenError] = useState(false);

  const fetchCotizaciones = useCallback(async () => {
    if (!cliente?.id) return;
    setLoadingCotizaciones(true);
    setCotizacionesError(false);
    const { data, error } = await supabase
      .rpc('get_cliente_cotizaciones_detalle', { p_cliente_id: cliente.id });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las cotizaciones.',
      });
      setCotizaciones([]);
      setCotizacionesError(true);
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
      setCotizacionesError(false);
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
              {cotizaciones.some((c) => c.proyecto_id != null && c.proyecto_estatus !== 'Entregado') && (
                <PackageCheck className="ml-1 h-3.5 w-3.5 text-teal-600" />
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
            <ClienteCotizacionesTabla
              cotizaciones={cotizaciones}
              loading={loadingCotizaciones}
              error={cotizacionesError}
              onNavigateCotizacion={(id) => {
                onOpenChange(false);
                navigate('/cotizaciones', { state: { openCotizacionId: id } });
              }}
              onNavigateProyecto={(id) => {
                onOpenChange(false);
                navigate('/proyectos/' + id);
              }}
              onEntregaSuccess={() => {
                fetchCotizaciones();
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteDetalle;
