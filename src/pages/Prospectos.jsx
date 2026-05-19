import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { MARCAS_COMERCIALES } from '@/lib/brandingConfig';
import ProspectoKanban from '@/components/crm/ProspectoKanban';
import ProspectoDialog from '@/components/crm/ProspectoDialog';
import ProspectoDetalle from '@/components/crm/ProspectoDetalle';

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

  useEffect(() => {
    refetch();
  }, [refetch]);

  const activosCount = useMemo(
    () =>
      prospectos.filter(
        (p) => p.etapa !== 'convertido' && p.etapa !== 'descartado'
      ).length,
    [prospectos]
  );

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
          ) : (
            <ProspectoKanban
              prospectos={filtrados}
              onCardClick={handleCardClick}
              onRefetch={refetch}
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
