import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { RefreshCw, Search, Loader2, Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { usePermissions } from '@/contexts/PermissionsContext';
import {
  fetchPanelCostos,
  fetchConfigPrecios,
  recalcularCostoMaterial,
  recalcularTodosLosCostos,
  guardarConfigPrecios,
} from '@/lib/costosVivos';

const fmt = (n) => (n == null ? '—' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(Number(n)));
const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-MX') : '—');

const CONFIG_DEFAULT = {
  regla_costo: 'ultimo',
  regla_costo_n: 3,
  indirectos_pct: 20,
  utilidad_pct: 30,
  iva_pct: 16,
  margen_objetivo_pct: 30,
  margen_minimo_pct: 15,
};

const REGLAS_COSTO = [
  { value: 'ultimo', label: 'Último precio' },
  { value: 'promedio', label: 'Promedio' },
  { value: 'promedio_ponderado_n', label: 'Promedio ponderado (últimas N)' },
  { value: 'mas_alto', label: 'Más alto' },
];

const ControlCostos = () => {
  const { toast } = useToast();
  const { can } = usePermissions();
  const puedeEditar = can('materiales', 'editar');

  const [panel, setPanel] = useState([]);
  const [config, setConfig] = useState(CONFIG_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [recalculandoTodos, setRecalculandoTodos] = useState(false);
  const [recalculandoId, setRecalculandoId] = useState(null);

  const cargarConfig = useCallback(async () => {
    const data = await fetchConfigPrecios();
    setConfig(data ? { ...CONFIG_DEFAULT, ...data } : CONFIG_DEFAULT);
  }, []);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      setPanel(await fetchPanelCostos());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message ?? 'No se pudo cargar el panel de costos.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    recargar();
    cargarConfig();
  }, [recargar, cargarConfig]);

  const filtrados = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return panel;
    return panel.filter((m) => (
      (m.clave && m.clave.toLowerCase().includes(term)) ||
      (m.descripcion && m.descripcion.toLowerCase().includes(term))
    ));
  }, [panel, busqueda]);

  const conCompras = useMemo(() => panel.filter((m) => m.num_compras > 0).length, [panel]);

  const handleConfigChange = (campo, valor) => {
    setConfig((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleGuardarConfig = async () => {
    setGuardando(true);
    try {
      const { ok } = await guardarConfigPrecios(config);
      if (ok) {
        toast({ title: 'Configuración guardada', description: 'La regla de costeo se actualizó correctamente.' });
        await cargarConfig();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la configuración.' });
      }
    } finally {
      setGuardando(false);
    }
  };

  const handleRecalcularTodos = async () => {
    setRecalculandoTodos(true);
    try {
      const { ok, actualizados } = await recalcularTodosLosCostos();
      if (ok) {
        toast({ title: 'Costos recalculados', description: `${actualizados} materiales actualizados` });
        await recargar();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron recalcular los costos.' });
      }
    } finally {
      setRecalculandoTodos(false);
    }
  };

  const handleRecalcularMaterial = async (materialId) => {
    setRecalculandoId(materialId);
    try {
      const { ok, costo } = await recalcularCostoMaterial(materialId);
      if (ok) {
        toast({ title: 'Material actualizado', description: `Costo actualizado: ${fmt(costo)}` });
        await recargar();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo recalcular el costo de este material.' });
      }
    } finally {
      setRecalculandoId(null);
    }
  };

  const numInputProps = (campo) => ({
    type: 'number',
    value: config[campo] ?? '',
    onChange: (e) => handleConfigChange(campo, e.target.value === '' ? '' : Number(e.target.value)),
    disabled: !puedeEditar || guardando,
  });

  return (
    <>
      <Helmet><title>Control de Costos - IIHEMSA Peninsular</title></Helmet>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Control de Costos</h1>
        <p className="text-gray-600 text-sm mt-1">
          Costos vivos derivados de las órdenes de compra. Configura la regla y recalcula.
        </p>
      </div>

      {/* Config card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Configuración de costeo</h2>
        </div>

        {!puedeEditar && (
          <p className="text-xs text-gray-500 mb-3">Solo lectura — no tienes permiso de edición.</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="regla_costo">Regla de costo</Label>
            <Select
              value={config.regla_costo}
              onValueChange={(value) => handleConfigChange('regla_costo', value)}
              disabled={!puedeEditar || guardando}
            >
              <SelectTrigger id="regla_costo">
                <SelectValue placeholder="Selecciona una regla" />
              </SelectTrigger>
              <SelectContent>
                {REGLAS_COSTO.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.regla_costo === 'promedio_ponderado_n' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="regla_costo_n">N compras</Label>
              <Input id="regla_costo_n" {...numInputProps('regla_costo_n')} />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="indirectos_pct">Indirectos %</Label>
            <Input id="indirectos_pct" {...numInputProps('indirectos_pct')} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="utilidad_pct">Utilidad %</Label>
            <Input id="utilidad_pct" {...numInputProps('utilidad_pct')} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="iva_pct">IVA %</Label>
            <Input id="iva_pct" {...numInputProps('iva_pct')} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="margen_objetivo_pct">Margen objetivo %</Label>
            <Input id="margen_objetivo_pct" {...numInputProps('margen_objetivo_pct')} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="margen_minimo_pct">Margen mínimo %</Label>
            <Input id="margen_minimo_pct" {...numInputProps('margen_minimo_pct')} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleGuardarConfig} disabled={!puedeEditar || guardando}>
            {guardando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Guardar configuración
          </Button>
          <Button variant="outline" onClick={handleRecalcularTodos} disabled={!puedeEditar || recalculandoTodos}>
            {recalculandoTodos ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Recalcular todos los costos
          </Button>
        </div>
      </div>

      {/* Materials table card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h2 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Materiales y costos</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por clave o descripción..."
              className="pl-8"
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mb-2">
          {panel.length} materiales · {conCompras} con compras
        </p>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : panel.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500 gap-2">
            <AlertCircle className="w-8 h-8 text-gray-400" />
            <p className="text-sm max-w-md">
              Aún no hay datos de costos. Registra órdenes de compra con materiales del catálogo y precios para alimentar el costo vivo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium">Clave</th>
                  <th className="py-2 pr-3 font-medium">Descripción</th>
                  <th className="py-2 pr-3 font-medium text-right"># Compras</th>
                  <th className="py-2 pr-3 font-medium">Última compra</th>
                  <th className="py-2 pr-3 font-medium text-right">Costo último</th>
                  <th className="py-2 pr-3 font-medium text-right">Promedio</th>
                  <th className="py-2 pr-3 font-medium text-right">Más alto</th>
                  <th className="py-2 pr-3 font-medium text-right">Costo vigente</th>
                  <th className="py-2 pr-3 font-medium text-right">Guardado</th>
                  <th className="py-2 pr-1 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((m) => {
                  const sinCompras = !m.num_compras;
                  return (
                    <tr
                      key={m.material_id}
                      className={`border-b border-gray-100 ${sinCompras ? 'text-gray-400' : 'text-gray-800'}`}
                    >
                      <td className="py-2 pr-3 whitespace-nowrap">{m.clave}</td>
                      <td className="py-2 pr-3">{m.descripcion}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {sinCompras ? 'Sin compras' : m.num_compras}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtFecha(m.ultima_compra)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.costo_ultimo)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.costo_promedio)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.costo_mas_alto)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums font-bold">{fmt(m.costo_vigente)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(m.costo_compra_actual)}</td>
                      <td className="py-2 pr-1 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          title="Recalcular este material"
                          disabled={!puedeEditar || sinCompras || recalculandoId === m.material_id}
                          onClick={() => handleRecalcularMaterial(m.material_id)}
                        >
                          {recalculandoId === m.material_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
};

export default ControlCostos;
