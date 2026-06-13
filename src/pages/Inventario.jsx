import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import {
  Boxes, Search, Loader2, ArrowRightLeft, History, ShoppingCart, AlertTriangle, Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/contexts/PermissionsContext';
import { fetchInventario, estaEnMinimos } from '@/lib/inventarioApi';
import MovimientoInventarioDialog from '@/components/almacen/MovimientoInventarioDialog';
import KardexDialog from '@/components/almacen/KardexDialog';
import PedidoRestockDialog from '@/components/almacen/PedidoRestockDialog';

const CATEGORIAS = ['Todos', 'Materiales', 'Consumibles', 'Edificio', 'Servicios'];

const StockIndicator = ({ existencias, min, max }) => {
  const ex = Number(existencias) || 0;
  const mn = Number(min) || 0;
  const mx = Number(max) || 0;
  const percentage = mx > 0 ? Math.min((ex / mx) * 100, 100) : (ex > 0 ? 100 : 0);
  let colorClass = 'bg-green-500';
  if (mn > 0 && ex <= mn) colorClass = 'bg-red-500';
  else if (mn > 0 && ex <= mn * 1.2) colorClass = 'bg-yellow-500';
  return (
    <div className="flex flex-col gap-1 w-full min-w-[140px]">
      <div className="flex justify-between items-center text-xs text-gray-600">
        <span>Mín: {mn}</span>
        <span className="font-bold text-gray-900">{ex}</span>
        <span>Máx: {mx}</span>
      </div>
      <Progress value={percentage} className="h-2 [&>div]:bg-transparent" indicatorClassName={colorClass} />
    </div>
  );
};

const valorInventario = (m) => {
  const ex = Number(m.existencias) || 0;
  let costo = Number(m.costo_unitario) || 0;
  if (!costo) {
    const factor = Number(m.factor_conversion) || 0;
    costo = factor > 0 ? (Number(m.costo_compra) || 0) / factor : 0;
  }
  return ex * costo;
};

const Inventario = () => {
  const { toast } = useToast();
  const { can } = usePermissions();
  const puedeEditar = can('materiales', 'editar');

  const [materiales, setMateriales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [soloMinimos, setSoloMinimos] = useState(false);

  const [movMaterial, setMovMaterial] = useState(null);
  const [kardexMaterial, setKardexMaterial] = useState(null);
  const [restockOpen, setRestockOpen] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      setMateriales(await fetchInventario());
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message ?? 'No se pudo cargar el inventario.' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const enMinimos = useMemo(() => materiales.filter(estaEnMinimos), [materiales]);

  const filtrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return materiales.filter((m) => {
      if (categoria !== 'Todos' && m.categoria !== categoria) return false;
      if (soloMinimos && !estaEnMinimos(m)) return false;
      if (!term) return true;
      return (
        (m.descripcion && m.descripcion.toLowerCase().includes(term)) ||
        (m.clave && m.clave.toLowerCase().includes(term))
      );
    });
  }, [materiales, categoria, soloMinimos, searchTerm]);

  const valorTotal = useMemo(() => materiales.reduce((s, m) => s + valorInventario(m), 0), [materiales]);

  const fmtMoney = (n) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  return (
    <>
      <Helmet><title>Inventario - IIHEMSA Peninsular</title></Helmet>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Inventario</h1>
              <p className="text-gray-600 text-sm">Control manual de existencias de almacén.</p>
            </div>
          </div>
          {puedeEditar && (
            <Button onClick={() => setRestockOpen(true)} className="gap-2">
              <ShoppingCart className="w-4 h-4" /> Pedido de re-stock ({enMinimos.length})
            </Button>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Package className="w-4 h-4" /> Partidas</div>
            <p className="text-2xl font-bold text-gray-900">{materiales.length}</p>
          </div>
          <div className="rounded-xl border bg-red-50 border-red-200 p-4">
            <div className="flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="w-4 h-4" /> En mínimos</div>
            <p className="text-2xl font-bold text-red-900">{enMinimos.length}</p>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500"><Boxes className="w-4 h-4" /> Valor aprox.</div>
            <p className="text-2xl font-bold text-gray-900">{fmtMoney(valorTotal)}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row justify-between gap-3 mb-4">
          <Tabs value={categoria} onValueChange={setCategoria}>
            <TabsList className="flex-wrap h-auto">
              {CATEGORIAS.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Button
              variant={soloMinimos ? 'default' : 'outline'}
              onClick={() => setSoloMinimos((v) => !v)}
              className="gap-2 whitespace-nowrap"
            >
              <AlertTriangle className="w-4 h-4" /> Solo en mínimos
            </Button>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input placeholder="Buscar clave o descripción…" className="pl-10"
                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
            ) : (
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Clave</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 w-[220px]">Existencias</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtrados.map((m) => (
                    <tr key={m.id} className={cn('hover:bg-gray-50', estaEnMinimos(m) && 'bg-red-50/40')}>
                      <td className="px-4 py-3">
                        {m.clave
                          ? <span className="font-mono text-blue-600 font-semibold text-sm">{m.clave}</span>
                          : <span className="text-xs text-amber-600">Sin clave</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{m.descripcion}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-700">{m.categoria}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StockIndicator existencias={m.existencias} min={m.stock_min} max={m.stock_max} />
                        <span className="text-xs text-gray-400">en {m.unidad_uso || 'u'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {puedeEditar && (
                            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setMovMaterial(m)} title="Registrar movimiento">
                              <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Movimiento
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setKardexMaterial(m)} title="Ver kardex">
                            <History className="w-4 h-4 text-gray-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!loading && filtrados.length === 0 && (
              <p className="text-center py-10 text-gray-500">No se encontraron materiales.</p>
            )}
          </div>
        </div>
      </motion.div>

      <MovimientoInventarioDialog
        open={!!movMaterial}
        onOpenChange={(v) => !v && setMovMaterial(null)}
        material={movMaterial}
        onSaved={cargar}
      />
      <KardexDialog
        open={!!kardexMaterial}
        onOpenChange={(v) => !v && setKardexMaterial(null)}
        material={kardexMaterial}
      />
      <PedidoRestockDialog
        open={restockOpen}
        onOpenChange={setRestockOpen}
        materialesEnMinimos={enMinimos}
        onCreated={cargar}
      />
    </>
  );
};

export default Inventario;
