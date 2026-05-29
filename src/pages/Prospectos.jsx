import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Loader2, Table2, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { MARCAS_COMERCIALES } from '@/lib/brandingConfig';
import ProspectoKanban from '@/components/crm/ProspectoKanban';
import ProspectoTabla from '@/components/crm/ProspectoTabla';
import ProspectoDialog from '@/components/crm/ProspectoDialog';
import ProspectoDetalle from '@/components/crm/ProspectoDetalle';

const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);

const Prospectos = () => {
  const { toast } = useToast();
  const [prospectos, setProspectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [marcaActiva, setMarcaActiva] = useState('Todas');
  const [mostrarConvertidos, setMostrarConvertidos] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prospectoEditar, setProspectoEditar] = useState(null);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [prospectoSeleccionado, setProspectoSeleccionado] = useState(null);
  const [clientesNuevosMes, setClientesNuevosMes] = useState(0);
  const [vista, setVista] = useState('tabla');
  const [ultimaInteraccion, setUltimaInteraccion] = useState({});

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('prospectos')
      .select('*')
      .eq('eliminado', false)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar los prospectos.',
      });
      setProspectos([]);
    } else {
      setProspectos(data || []);
    }
    setLoading(false);
  }, [toast]);

  const fetchClientesNuevos = useCallback(async () => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('fuente_origen', 'prospecto_convertido')
      .gte('created_at', inicioMes);
    setClientesNuevosMes(count || 0);
  }, []);

  const fetchUltimas = useCallback(async () => {
    const { data } = await supabase
      .from('crm_interacciones')
      .select('prospecto_id, fecha')
      .eq('eliminado', false)
      .order('fecha', { ascending: false });
    const map = {};
    (data || []).forEach((row) => {
      if (row.prospecto_id && !map[row.prospecto_id]) map[row.prospecto_id] = row.fecha;
    });
    setUltimaInteraccion(map);
  }, []);

  useEffect(() => {
    refetch();
    fetchClientesNuevos();
    fetchUltimas();
  }, [refetch, fetchClientesNuevos, fetchUltimas]);

  const activosCount = useMemo(
    () =>
      prospectos.filter(
        (p) => p.etapa !== 'convertido' && p.etapa !== 'descartado'
      ).length,
    [prospectos]
  );

  const valorPipeline = useMemo(
    () =>
      prospectos
        .filter((p) => p.etapa !== 'convertido' && p.etapa !== 'descartado')
        .reduce((acc, p) => acc + (Number(p.valor_estimado) || 0), 0),
    [prospectos]
  );

  const tasaConversion = useMemo(() => {
    const convertidos = prospectos.filter((p) => p.etapa === 'convertido').length;
    const descartados = prospectos.filter((p) => p.etapa === 'descartado').length;
    const cerrados = convertidos + descartados;
    return cerrados === 0 ? null : Math.round((convertidos / cerrados) * 100);
  }, [prospectos]);

  const filtrados = useMemo(() => {
    return prospectos.filter((p) => {
      const matchMarca =
        marcaActiva === 'Todas' || p.marca_origen === marcaActiva;
      const esCerrado = p.etapa === 'convertido' || p.etapa === 'descartado';
      const matchEstado = mostrarConvertidos || !esCerrado;
      return matchMarca && matchEstado;
    });
  }, [prospectos, marcaActiva, mostrarConvertidos]);

  const handleCardClick = (p) => {
    setProspectoSeleccionado(p);
    setDetalleOpen(true);
  };

  const handleNuevo = () => {
    setProspectoEditar(null);
    setDialogOpen(true);
  };

  return (
    <>
      <Helmet>
        <title>Prospectos - IIHEMSA Peninsular</title>
        <meta name="description" content="Pipeline de prospectos comerciales" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Prospectos</h2>
            <p className="text-gray-600 mt-1">
              {activosCount} activo{activosCount !== 1 ? 's' : ''} en pipeline
            </p>
          </div>
          <Button onClick={handleNuevo} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Prospecto
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Prospectos activos', value: activosCount },
            { label: 'Valor en pipeline', value: fmtMXN(valorPipeline) },
            { label: 'Clientes nuevos (mes)', value: clientesNuevosMes },
            { label: 'Tasa de conversión', value: tasaConversion == null ? '—' : `${tasaConversion}%` },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMarcaActiva('Todas')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                marcaActiva === 'Todas'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todas
            </button>
            {MARCAS_COMERCIALES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMarcaActiva(m.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  marcaActiva === m.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {m.nombre}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="mostrar-convertidos"
              checked={mostrarConvertidos}
              onCheckedChange={setMostrarConvertidos}
            />
            <Label htmlFor="mostrar-convertidos" className="text-sm text-gray-600 cursor-pointer">
              Mostrar convertidos/descartados
            </Label>
          </div>

          <div className="flex gap-1 sm:ml-auto bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setVista('tabla')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${vista === 'tabla' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Table2 className="w-4 h-4" /> Tabla
            </button>
            <button
              type="button"
              onClick={() => setVista('kanban')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${vista === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Kanban className="w-4 h-4" /> Kanban
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-h-[320px]">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <p className="text-lg font-medium">No hay prospectos</p>
              <p className="text-sm mt-1">Ajusta los filtros o crea un nuevo prospecto.</p>
            </div>
          ) : vista === 'kanban' ? (
            <ProspectoKanban
              prospectos={filtrados}
              onCardClick={handleCardClick}
              onRefetch={refetch}
            />
          ) : (
            <ProspectoTabla
              prospectos={filtrados}
              onCardClick={handleCardClick}
              ultimaInteraccion={ultimaInteraccion}
            />
          )}
        </div>
      </div>

      <ProspectoDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setProspectoEditar(null);
        }}
        prospectoEditar={prospectoEditar}
        onSave={refetch}
      />

      <ProspectoDetalle
        open={detalleOpen}
        onOpenChange={(open) => {
          setDetalleOpen(open);
          if (!open) setProspectoSeleccionado(null);
        }}
        prospecto={prospectoSeleccionado}
        onRefetch={refetch}
      />
    </>
  );
};

export default Prospectos;
