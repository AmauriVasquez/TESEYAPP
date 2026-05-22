import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import CalendarView from '@/components/proyectos/CalendarView';
import ProspectoDetalle from '@/components/crm/ProspectoDetalle';

const Calendario = () => {
  const { toast } = useToast();
  const [proyectos, setProyectos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [citas, setCitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProspecto, setSelectedProspecto] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [proyRes, empRes, citasRes] = await Promise.all([
        supabase
          .from('proyectos')
          .select(`
            *,
            cliente:cliente_id(nombre),
            responsable:responsable_id(nombre_completo)
          `)
          .order('id', { ascending: false }),
        supabase
          .from('empleados')
          .select('id, nombre_completo, fecha_nacimiento, google_calendar_cumple_id')
          .eq('activo', true)
          .order('nombre_completo'),
        supabase
          .from('crm_interacciones')
          .select('id, tipo, fecha_hora_programada, descripcion, prospecto:prospecto_id(id, nombre)')
          .eq('programada', true)
          .eq('eliminado', false),
      ]);

      if (proyRes.error) throw proyRes.error;

      const withClientName = (proyRes.data || []).map((p) => ({
        ...p,
        cliente_nombre: p.cliente?.nombre || p.cliente_nombre_externo || 'Sin Cliente',
      }));
      setProyectos(withClientName);

      if (!empRes.error) setEmpleados(empRes.data || []);
      if (!citasRes.error) setCitas(citasRes.data || []);
    } catch (error) {
      console.error('Error cargando datos para calendario:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los datos del calendario.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectCita = useCallback(
    async (citaProspecto) => {
      if (!citaProspecto?.id) return;
      const { data, error } = await supabase
        .from('prospectos')
        .select('*')
        .eq('id', citaProspecto.id)
        .single();
      if (!error && data) {
        setSelectedProspecto(data);
        setDetailOpen(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'No se pudo cargar el prospecto.',
        });
      }
    },
    [toast]
  );

  return (
    <>
      <Helmet>
        <title>Calendario - IIHEMSA Peninsular</title>
      </Helmet>
      <div className="flex flex-col h-[calc(100vh-80px)] min-h-0">
        <div className="shrink-0 mb-2">
          <h2 className="text-2xl font-bold text-gray-900">Calendario</h2>
          <p className="text-gray-600 mt-1 text-sm">
            Vista de proyectos y citas con prospectos. Filtra por estatus en el panel izquierdo.
          </p>
        </div>
        {loading ? (
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex justify-center items-center min-h-[400px]">
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <CalendarView
              proyectos={proyectos}
              empleados={empleados}
              citas={citas}
              onSelectCita={handleSelectCita}
            />
          </div>
        )}
      </div>

      <ProspectoDetalle
        open={detailOpen}
        onOpenChange={setDetailOpen}
        prospecto={selectedProspecto}
        onRefetch={fetchData}
      />
    </>
  );
};

export default Calendario;
