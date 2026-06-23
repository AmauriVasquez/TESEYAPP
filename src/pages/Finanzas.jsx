import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { DollarSign, TrendingUp, TrendingDown, Loader2, Plus, ChevronDown, ChevronRight, FileText, Upload, Wallet, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getIngresos, getGastos, registrarGasto } from '@/services/finanzasService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox } from '@/components/ui/combobox';
import { format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatDateTable } from '@/lib/dateUtils';
import { empresaLabel, marcaLabel } from '@/lib/facturacionDisplay';
import { getCuentaLabel } from '@/config/cuentasPago';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { usePermissions } from '@/contexts/PermissionsContext';
import { CUENTAS_PAGO, validarCobro } from '@/config/cuentasPago';

const CATEGORIAS_GASTO = [
  { value: 'material', label: 'Material' },
  { value: 'mano_obra', label: 'Mano de obra' },
  { value: 'indirecto', label: 'Indirecto' },
  { value: 'administrativo', label: 'Administrativo' },
];

const Finanzas = () => {
  const { toast } = useToast();
  const { getHiddenFields } = usePermissions();
  const hiddenFinanzas = getHiddenFields('finanzas');
  const [loading, setLoading] = useState(true);
  const [ingresos, setIngresos] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [dateRange, setDateRange] = useState(() => ({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }));
  const [gastoDialogOpen, setGastoDialogOpen] = useState(false);
  const [movimientoDialogOpen, setMovimientoDialogOpen] = useState(false);
  const [proyectosOptions, setProyectosOptions] = useState([]);
  const [selectedProyectoId, setSelectedProyectoId] = useState('');
  const [ingresoForm, setIngresoForm] = useState({ monto: '', fecha: format(new Date(), 'yyyy-MM-dd'), metodoPago: '', comentarios: '' });
  const [savingIngreso, setSavingIngreso] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [proyectosParaCuentas, setProyectosParaCuentas] = useState([]);
  const [pagosTodos, setPagosTodos] = useState([]);
  const [loadingCuentasCobrar, setLoadingCuentasCobrar] = useState(true);
  const [proyectosParaGasto, setProyectosParaGasto] = useState([]);
  const [expandidoCliente, setExpandidoCliente] = useState(null);
  const [savingGasto, setSavingGasto] = useState(false);
  const [formGasto, setFormGasto] = useState({
    proyecto_id: '',
    monto: '',
    fecha: format(new Date(), 'yyyy-MM-dd'),
    categoria: 'material',
    proveedor: '',
    descripcion: '',
    factura_file: null,
  });

  const desde = useMemo(() => {
    const v = dateRange?.from && String(dateRange.from).trim();
    return v || null;
  }, [dateRange?.from]);
  const hasta = useMemo(() => {
    const toVal = dateRange?.to && String(dateRange.to).trim();
    const fromVal = dateRange?.from && String(dateRange.from).trim();
    return toVal || fromVal || null;
  }, [dateRange?.from, dateRange?.to]);
  const periodoLabel = useMemo(() => {
    const fromStr = dateRange?.from && String(dateRange.from).trim();
    if (!fromStr) return 'Histórico Completo';
    const fromDate = parse(fromStr, 'yyyy-MM-dd', new Date());
    const fromLabel = format(fromDate, 'd MMM, yyyy', { locale: es });
    const toStr = dateRange?.to && String(dateRange.to).trim();
    if (!toStr || toStr === fromStr) return fromLabel;
    const toDate = parse(toStr, 'yyyy-MM-dd', new Date());
    return `${fromLabel} - ${format(toDate, 'd MMM, yyyy', { locale: es })}`;
  }, [dateRange]);

  const fetchDatos = useCallback(async () => {
    setLoading(true);
    try {
      const filters = desde && hasta ? { desde, hasta } : {}; // sin filtro = Histórico Completo
      const [ingRes, gasRes] = await Promise.all([
        getIngresos(filters),
        getGastos(filters),
      ]);
      if (ingRes.error) throw ingRes.error;
      if (gasRes.error) throw gasRes.error;
      setIngresos(ingRes.data || []);
      setGastos(gasRes.data || []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos de finanzas.' });
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, toast]);

  useEffect(() => { fetchDatos(); }, [fetchDatos]);

  const totalIngresos = useMemo(
    () => (ingresos || []).reduce((s, i) => s + Number(i.monto || 0), 0),
    [ingresos]
  );
  const totalGastos = useMemo(
    () => (gastos || []).reduce((s, g) => s + Number(g.monto || 0), 0),
    [gastos]
  );
  const balance = useMemo(() => Number(totalIngresos) - Number(totalGastos), [totalIngresos, totalGastos]);

  const proyectoMovSeleccionado = useMemo(
    () => proyectosOptions.find((o) => o.value === selectedProyectoId)?.raw ?? null,
    [proyectosOptions, selectedProyectoId]
  );
  const avisoMovimiento = useMemo(
    () => validarCobro({
      requiereCfdi: !!proyectoMovSeleccionado?.requiere_cfdi,
      cuentaValue: ingresoForm.metodoPago,
      branding: proyectoMovSeleccionado?.cotizacion?.branding ?? null,
    }),
    [proyectoMovSeleccionado, ingresoForm.metodoPago]
  );

  /** Cuentas por cobrar: solo proyectos activos/entregados con saldo > $1. Matemática: Saldo = Costo Total - Suma pagos. */
  const cuentasPorCobrar = useMemo(() => {
    const proyectos = proyectosParaCuentas || [];
    const pagos = pagosTodos || [];
    if (proyectos.length === 0) return [];

    const ESTATUS_EXCLUIDOS = ['Cancelado', 'Borrador'];
    const pagadoPorProyecto = (pagos || []).reduce((acc, x) => {
      const pid = x.proyecto_id;
      if (pid == null) return acc;
      acc[pid] = (acc[pid] || 0) + Number(x.monto || 0);
      return acc;
    }, {});

    const conSaldo = proyectos
      .filter((p) => p && !ESTATUS_EXCLUIDOS.includes(p.estatus))
      .map((p) => {
        const costoTotal = Number(p.cotizacion?.total ?? p.costo_total ?? 0);
        const pagado = Number(pagadoPorProyecto[p.id] || 0);
        const saldoPendiente = Number((costoTotal - pagado).toFixed(2));
        const clienteNombre =
          p.cliente?.nombre ?? p.cliente_nombre_externo ?? p.cliente_nombre ?? 'Cliente Desconocido';
        return {
          ...p,
          cliente_nombre: clienteNombre,
          costo_total: costoTotal,
          pagado,
          saldo: saldoPendiente,
          total: costoTotal,
        };
      })
      .filter((p) => p.saldo > 1 && p.costo_total > 0);

    const porCliente = {};
    (conSaldo || []).forEach((p) => {
      const nombre = p.cliente_nombre || 'Cliente Desconocido';
      if (!porCliente[nombre]) porCliente[nombre] = { nombre, deudaTotal: 0, proyectos: [] };
      porCliente[nombre].deudaTotal = Number((porCliente[nombre].deudaTotal + p.saldo).toFixed(2));
      porCliente[nombre].proyectos.push(p);
    });
    return Object.values(porCliente);
  }, [proyectosParaCuentas, pagosTodos]);

  const cuentasPorCobrarTotal = useMemo(
    () => (cuentasPorCobrar || []).reduce((s, c) => s + Number(c.deudaTotal || 0), 0),
    [cuentasPorCobrar]
  );

  const [ingresosConProyecto, setIngresosConProyecto] = useState([]);
  const [sortConfigIngresos, setSortConfigIngresos] = useState({ key: 'fecha', direction: 'desc' });
  const [sortConfigGastos, setSortConfigGastos] = useState({ key: 'fecha', direction: 'desc' });

  useEffect(() => {
    const list = ingresos || [];
    if (list.length === 0) {
      setIngresosConProyecto([]);
      return;
    }
    const proyectoIds = [...new Set(list.map((i) => i?.proyecto_id).filter(Boolean))];
    if (proyectoIds.length === 0) {
      setIngresosConProyecto(list.map((i) => ({ ...i, cliente: '-', proyecto: '-' })));
      return;
    }
    supabase
      .from('proyectos')
      .select('id, folio, descripcion, requiere_cfdi, factura_descartada, cliente:cliente_id(nombre), cliente_nombre_externo, cotizacion:cotizacion_id(branding, marca_comercial)')
      .in('id', proyectoIds)
      .then(({ data: proyData }) => {
        const mapProy = (proyData || []).reduce(
          (acc, p) => ({
            ...acc,
            [p.id]: {
              nombre: p?.cliente?.nombre ?? p?.cliente_nombre_externo ?? 'Cliente Desconocido',
              descripcion: p?.descripcion ?? '',
              folio: p?.folio ?? '',
              empresa: p?.cotizacion?.branding ?? null,
              marca: p?.cotizacion?.marca_comercial ?? null,
              requiere_cfdi: !!p?.requiere_cfdi,
              factura_descartada: !!p?.factura_descartada,
            },
          }),
          {}
        );
        setIngresosConProyecto(
          list.map((i) => {
            const p = mapProy[i?.proyecto_id];
            return {
              ...i,
              cliente: p?.nombre ?? '-',
              proyecto: p ? `${p.folio} – ${p.descripcion}` : '-',
              empresa: p?.empresa ?? null,
              marca: p?.marca ?? null,
              requiere_cfdi: p?.requiere_cfdi ?? false,
              factura_descartada: p?.factura_descartada ?? false,
            };
          })
        );
      });
  }, [ingresos]);

  const handleSortIngresos = useCallback((key) => {
    setSortConfigIngresos((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : prev.key === key ? 'asc' : 'desc',
    }));
  }, []);
  const handleSortGastos = useCallback((key) => {
    setSortConfigGastos((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : prev.key === key ? 'asc' : 'desc',
    }));
  }, []);

  const sortedIngresos = useMemo(() => {
    const list = [...(ingresosConProyecto || [])];
    const { key, direction } = sortConfigIngresos;
    const mult = direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (key === 'fecha') {
        const dA = new Date(a.fecha || a.fecha_pago || 0).getTime();
        const dB = new Date(b.fecha || b.fecha_pago || 0).getTime();
        return mult * (dA - dB);
      }
      if (key === 'cliente') return mult * String(a.cliente ?? '').localeCompare(String(b.cliente ?? ''), 'es', { sensitivity: 'base' });
      if (key === 'proyecto') return mult * String(a.proyecto ?? '').localeCompare(String(b.proyecto ?? ''), 'es', { sensitivity: 'base' });
      if (key === 'monto') return mult * (Number(a.monto) || 0) - (Number(b.monto) || 0);
      return 0;
    });
    return list;
  }, [ingresosConProyecto, sortConfigIngresos]);

  const sortedGastos = useMemo(() => {
    const list = [...(gastos || [])];
    const { key, direction } = sortConfigGastos;
    const mult = direction === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (key === 'fecha') {
        const dA = new Date(a.fecha || 0).getTime();
        const dB = new Date(b.fecha || 0).getTime();
        return mult * (dA - dB);
      }
      if (key === 'proveedor') return mult * String(a.proveedor ?? '').localeCompare(String(b.proveedor ?? ''), 'es', { sensitivity: 'base' });
      if (key === 'concepto') {
        const cA = a.descripcion || a.categoria || '';
        const cB = b.descripcion || b.categoria || '';
        return mult * String(cA).localeCompare(String(cB), 'es', { sensitivity: 'base' });
      }
      if (key === 'monto') return mult * (Number(a.monto) || 0) - (Number(b.monto) || 0);
      return 0;
    });
    return list;
  }, [gastos, sortConfigGastos]);

  const fetchChartData = useCallback(async () => {
    setLoadingCharts(true);
    try {
      const hasta = endOfMonth(new Date());
      const desde = startOfMonth(subMonths(new Date(), 11));
      const desdeStr = format(desde, 'yyyy-MM-dd');
      const hastaStr = format(hasta, 'yyyy-MM-dd');
      const [ingRes, gasRes] = await Promise.all([
        getIngresos({ desde: desdeStr, hasta: hastaStr }),
        getGastos({ desde: desdeStr, hasta: hastaStr }),
      ]);
      if (ingRes.error) throw ingRes.error;
      if (gasRes.error) throw gasRes.error;
      const ingresosList = ingRes.data || [];
      const gastosList = gasRes.data || [];
      const byMonth = {};
      for (let i = 0; i < 12; i++) {
        const d = subMonths(new Date(), 11 - i);
        const key = format(d, 'yyyy-MM');
        byMonth[key] = {
          mes: format(d, 'MMM', { locale: es }),
          ingresos: 0,
          gastos: 0,
          utilidad: 0,
          utilidadAcum: 0,
        };
      }
      (ingresosList || []).forEach((i) => {
        const fecha = typeof i?.fecha === 'string' ? i.fecha : (i?.fecha_pago || '');
        const key = fecha ? String(fecha).slice(0, 7) : format(new Date(), 'yyyy-MM');
        if (byMonth[key]) {
          byMonth[key].ingresos += Number(i?.monto || 0);
        }
      });
      (gastosList || []).forEach((g) => {
        const fecha = typeof g?.fecha === 'string' ? g.fecha : '';
        const key = fecha ? String(fecha).slice(0, 7) : format(new Date(), 'yyyy-MM');
        if (byMonth[key]) {
          byMonth[key].gastos += Number(g?.monto || 0);
        }
      });
      const ordered = Object.entries(byMonth)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([, v]) => ({ ...v, utilidad: Number(v.ingresos) - Number(v.gastos) }));
      let acum = 0;
      ordered.forEach((row) => {
        acum = Number(acum) + Number(row.utilidad);
        row.utilidadAcum = Number(acum.toFixed(2));
      });
      setChartData(ordered);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar datos para las gráficas.' });
    } finally {
      setLoadingCharts(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const handleOpenMovimiento = () => {
    setMovimientoDialogOpen(true);
    setSelectedProyectoId('');
    setIngresoForm({ monto: '', fecha: format(new Date(), 'yyyy-MM-dd'), metodoPago: '', comentarios: '' });
    supabase
      .from('proyectos')
      .select('id, folio, descripcion, requiere_cfdi, cotizacion:cotizacion_id(branding)')
      .order('id', { ascending: false })
      .then(({ data }) => {
        setProyectosOptions((data || []).map((p) => ({ value: String(p.id), label: `${p.folio} – ${p.descripcion}`, raw: p })));
      });
  };

  const handleRegistrarIngreso = async () => {
    if (!selectedProyectoId || !ingresoForm.monto || !ingresoForm.fecha || !ingresoForm.metodoPago) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Proyecto, monto, fecha y método de pago son obligatorios.' });
      return;
    }
    setSavingIngreso(true);
    try {
      const { error } = await supabase.from('proyecto_pagos').insert({
        proyecto_id: parseInt(selectedProyectoId, 10),
        monto: parseFloat(ingresoForm.monto),
        fecha_pago: ingresoForm.fecha,
        metodo_pago: ingresoForm.metodoPago,
        cuenta_value: ingresoForm.metodoPago,
        comentarios: ingresoForm.comentarios || null,
      });
      if (error) throw error;
      toast({ title: '✅ Ingreso registrado' });
      setMovimientoDialogOpen(false);
      setSelectedProyectoId('');
      setIngresoForm({ monto: '', fecha: format(new Date(), 'yyyy-MM-dd'), metodoPago: '', comentarios: '' });
      fetchDatos();
      fetchChartData();
      fetchDatosCuentasPorCobrar();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setSavingIngreso(false);
    }
  };

  /** Una sola carga: proyectos con cotización + todos los pagos. Cálculo pesado en useMemo. */
  const fetchDatosCuentasPorCobrar = useCallback(async () => {
    setLoadingCuentasCobrar(true);
    try {
      const [proyRes, pagosRes] = await Promise.all([
        supabase
          .from('proyectos')
          .select('id, folio, descripcion, estatus, cliente:cliente_id(nombre), cliente_nombre_externo, cotizacion:cotizacion_id(total)'),
        supabase.from('proyecto_pagos').select('proyecto_id, monto'),
      ]);
      if (proyRes.error) throw proyRes.error;
      if (pagosRes.error) throw pagosRes.error;
      setProyectosParaCuentas(proyRes.data || []);
      setPagosTodos(pagosRes.data || []);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar cuentas por cobrar.' });
      setProyectosParaCuentas([]);
      setPagosTodos([]);
    } finally {
      setLoadingCuentasCobrar(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDatosCuentasPorCobrar();
  }, [fetchDatosCuentasPorCobrar]);
  useEffect(() => {
    supabase.from('proyectos').select('id, folio, descripcion').order('id', { ascending: false }).then(({ data }) => setProyectosParaGasto(data || []));
  }, []);

  const handleRegistrarGasto = async (e) => {
    e.preventDefault();
    if (!formGasto.monto || !formGasto.fecha || !formGasto.categoria) {
      toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Monto, fecha y categoría son obligatorios.' });
      return;
    }
    if (!formGasto.proyecto_id) {
      toast({ variant: 'destructive', title: 'Proyecto requerido', description: 'Debes asignar el gasto a un proyecto.' });
      return;
    }
    setSavingGasto(true);
    let facturaUrl = null;
    if (formGasto.factura_file) {
      const path = `gastos/${Date.now()}_${formGasto.factura_file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('proyecto_archivos').upload(path, formGasto.factura_file);
      if (!upErr) facturaUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(path).data.publicUrl;
    }
    const { error } = await registrarGasto({
      proyecto_id: parseInt(formGasto.proyecto_id, 10),
      monto: parseFloat(formGasto.monto),
      fecha: formGasto.fecha,
      categoria: formGasto.categoria,
      proveedor: formGasto.proveedor || null,
      descripcion: formGasto.descripcion || null,
      factura_url: facturaUrl,
    });
    setSavingGasto(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: '✅ Gasto registrado' });
    setGastoDialogOpen(false);
    setFormGasto({ proyecto_id: '', monto: '', fecha: format(new Date(), 'yyyy-MM-dd'), categoria: 'material', proveedor: '', descripcion: '', factura_file: null });
    fetchDatos();
  };

  if (loading) {
    return (
      <>
        <Helmet><title>Finanzas - IIHEMSA Peninsular</title></Helmet>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          <p className="text-sm text-gray-500">Cargando finanzas...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>Finanzas - IIHEMSA Peninsular</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Finanzas</h2>
            <p className="text-gray-600 mt-1">Control de ingresos y gastos</p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <DateRangePicker value={dateRange} onChange={setDateRange} />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDateRange({
                    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
                  })
                }
              >
                Este Mes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setDateRange({
                    from: format(startOfYear(new Date()), 'yyyy-MM-dd'),
                    to: format(endOfYear(new Date()), 'yyyy-MM-dd'),
                  })
                }
              >
                Este Año
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDateRange({ from: '', to: '' })}
              >
                Histórico
              </Button>
            </div>
            <Button onClick={handleOpenMovimiento} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="w-4 h-4" /> Registrar Movimiento
            </Button>
            <Button variant="outline" onClick={() => setGastoDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Registrar Gasto
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              Reporte Financiero
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                <p className="text-sm font-medium text-green-700">Ingresos Totales</p>
                <p className="text-2xl font-bold text-green-800">${Number(totalIngresos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500 mt-1">{periodoLabel}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                <p className="text-sm font-medium text-red-700">Gastos Totales</p>
                <p className="text-2xl font-bold text-red-800">${Number(totalGastos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500 mt-1">{periodoLabel}</p>
              </div>
              {!hiddenFinanzas.includes('utilidad_neta') && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                  <p className="text-sm font-medium text-blue-700">Utilidad Neta</p>
                  <p className={cn('text-2xl font-bold', Number(balance) >= 0 ? 'text-blue-800' : 'text-red-800')}>${Number(balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                </div>
              )}
              {/* TODO: agregar bloque margen_bruto cuando exista en la UI de Finanzas */}
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                <p className="text-sm font-medium text-amber-700">Cuentas por Cobrar</p>
                <p className="text-2xl font-bold text-amber-800">${Number(cuentasPorCobrarTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <Tabs defaultValue="ingresos" className="space-y-2">
              <TabsList>
                <TabsTrigger value="ingresos">Ingresos del Periodo</TabsTrigger>
                <TabsTrigger value="gastos">Gastos del Periodo</TabsTrigger>
              </TabsList>
              <TabsContent value="ingresos" className="space-y-2 mt-2">
                <div className="sm:hidden space-y-2">
                  {sortedIngresos.length === 0 ? (
                    <p className="text-center py-6 text-gray-500">No hay ingresos en el periodo.</p>
                  ) : sortedIngresos.map((i, idx) => (
                    <div key={i?.id ?? `ingm-${idx}`} className="rounded-lg border p-3 bg-white">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{i.cliente}</span>
                        <span className="text-sm font-semibold text-green-700">${Number(i.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-xs text-gray-500">{i.proyecto}</p>
                      <p className="text-xs mt-1">{empresaLabel(i.empresa)} · {marcaLabel(i.marca)} · {getCuentaLabel(i.cuenta_value || i.metodo_pago)}</p>
                      <p className="text-xs text-gray-400">{formatDateTable(i.fecha || i.fecha_pago)}</p>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block w-full max-h-[500px] 2xl:max-h-[700px] overflow-y-auto overflow-x-auto border-b rounded-b-lg shadow-inner bg-white">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-sm [&_tr]:border-b [&_th]:bg-white [&_th]:py-3 [&_th]:shadow-[0_1px_0_0_#e5e7eb]">
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortIngresos('fecha')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Fecha
                            {sortConfigIngresos.key !== 'fecha' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigIngresos.key === 'fecha' && (sortConfigIngresos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortIngresos('cliente')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Cliente
                            {sortConfigIngresos.key !== 'cliente' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigIngresos.key === 'cliente' && (sortConfigIngresos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortIngresos('proyecto')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Proyecto
                            {sortConfigIngresos.key !== 'proyecto' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigIngresos.key === 'proyecto' && (sortConfigIngresos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortIngresos('monto')}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Monto
                            {sortConfigIngresos.key !== 'monto' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigIngresos.key === 'monto' && (sortConfigIngresos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedIngresos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-6 text-gray-500">No hay ingresos en el periodo.</TableCell>
                        </TableRow>
                      ) : (
                        sortedIngresos.map((i, idx) => (
                          <TableRow key={i?.id ?? `ing-${idx}`}>
                            <TableCell className="whitespace-nowrap">{formatDateTable(i.fecha || i.fecha_pago)}</TableCell>
                            <TableCell>{i.cliente}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{i.proyecto}</TableCell>
                            <TableCell>{empresaLabel(i.empresa)}</TableCell>
                            <TableCell>{marcaLabel(i.marca)}</TableCell>
                            <TableCell className="whitespace-nowrap">{getCuentaLabel(i.cuenta_value || i.metodo_pago)}</TableCell>
                            <TableCell className="text-right font-medium text-green-700">${Number(i.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="gastos" className="space-y-2 mt-2">
                <div className="w-full max-h-[500px] 2xl:max-h-[700px] overflow-y-auto overflow-x-auto border-b rounded-b-lg shadow-inner bg-white">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-sm [&_tr]:border-b [&_th]:bg-white [&_th]:py-3 [&_th]:shadow-[0_1px_0_0_#e5e7eb]">
                      <TableRow>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortGastos('fecha')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Fecha
                            {sortConfigGastos.key !== 'fecha' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigGastos.key === 'fecha' && (sortConfigGastos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortGastos('proveedor')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Proveedor
                            {sortConfigGastos.key !== 'proveedor' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigGastos.key === 'proveedor' && (sortConfigGastos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortGastos('concepto')}
                        >
                          <span className="inline-flex items-center gap-1">
                            Concepto
                            {sortConfigGastos.key !== 'concepto' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigGastos.key === 'concepto' && (sortConfigGastos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortGastos('monto')}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Monto
                            {sortConfigGastos.key !== 'monto' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigGastos.key === 'monto' && (sortConfigGastos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedGastos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-gray-500">No hay gastos en el periodo.</TableCell>
                        </TableRow>
                      ) : (
                        sortedGastos.map((g, idx) => (
                          <TableRow key={g?.id ?? `gasto-${idx}`}>
                            <TableCell className="whitespace-nowrap">{formatDateTable(g.fecha)}</TableCell>
                            <TableCell>{g.proveedor || '—'}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{g.descripcion || g.categoria || '—'}</TableCell>
                            <TableCell className="text-right font-medium text-red-700">${Number(g.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Ingresos del periodo</CardTitle>
              <TrendingUp className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700">
                ${Number(totalIngresos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">{periodoLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Gastos del periodo</CardTitle>
              <TrendingDown className="w-4 h-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-700">
                ${Number(totalGastos || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-gray-500 mt-1">{periodoLabel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Balance</CardTitle>
              <DollarSign className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${Number(balance) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                ${Number(balance || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Comparativa Mensual (Ingresos vs Gastos)</CardTitle>
              <p className="text-sm text-gray-500">Últimos 12 meses</p>
            </CardHeader>
            <CardContent>
              {loadingCharts ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : (chartData || []).length === 0 ? (
                <p className="text-center py-12 text-gray-500">Sin datos para mostrar.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData || []} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`} />
                    <Tooltip formatter={(v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} labelFormatter={(_, payload) => payload?.[0]?.payload?.mes} />
                    <Legend />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          {!hiddenFinanzas.includes('utilidad_estimada') && (
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Utilidad Acumulada</CardTitle>
                <p className="text-sm text-gray-500">Últimos 12 meses</p>
              </CardHeader>
              <CardContent>
                {loadingCharts ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                ) : (chartData || []).length === 0 ? (
                  <p className="text-center py-12 text-gray-500">Sin datos para mostrar.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData || []} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                      <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toLocaleString('es-MX', { maximumFractionDigits: 0 })}`} />
                      <Tooltip formatter={(v) => `$${Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} labelFormatter={(_, payload) => payload?.[0]?.payload?.mes} />
                      <Legend />
                      <Line type="monotone" dataKey="utilidadAcum" name="Utilidad acumulada" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Cuentas por Cobrar</CardTitle>
            <p className="text-sm text-gray-500">Agrupado por cliente. Solo proyectos activos/entregados con saldo &gt; $1.</p>
          </CardHeader>
          <CardContent>
            {loadingCuentasCobrar ? (
              <div className="space-y-3 py-4" aria-busy="true">
                <div className="h-4 w-full max-w-xs rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-full max-w-sm rounded bg-gray-200 animate-pulse" />
                <div className="h-4 w-full max-w-md rounded bg-gray-200 animate-pulse" />
                <p className="text-sm text-gray-500 pt-2">Calculando finanzas...</p>
              </div>
            ) : (cuentasPorCobrar || []).length === 0 ? (
              <p className="text-gray-500 py-4 text-center">No hay cuentas con saldo pendiente.</p>
            ) : (
              <div className="space-y-2">
                {(cuentasPorCobrar || []).map((item) => (
                  <Collapsible key={String(item.nombre)} open={expandidoCliente === item.nombre} onOpenChange={(open) => setExpandidoCliente(open ? item.nombre : null)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 hover:bg-gray-100 cursor-pointer">
                        <div className="flex items-center gap-2">
                          {expandidoCliente === item.nombre ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <span className="font-medium">{item.nombre ?? 'Cliente Desconocido'}</span>
                        </div>
                        <span className="font-bold text-amber-700">${Number(item.deudaTotal || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="pl-6 pt-2 pb-4 space-y-2">
                        {(item.proyectos || []).map((p) => (
                          <div key={p.id} className="flex justify-between text-sm py-2 border-b border-gray-100">
                            <span className="text-gray-700">{p.folio ?? ''} – {p.descripcion ?? ''}</span>
                            <span className="font-medium">${Number(p.saldo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={gastoDialogOpen} onOpenChange={setGastoDialogOpen}>
        <DialogContent className="w-[100vw] max-w-lg overflow-y-auto max-h-[90vh] sm:w-full">
          <DialogHeader><DialogTitle>Registrar Gasto</DialogTitle></DialogHeader>
          <form onSubmit={handleRegistrarGasto} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Proyecto *</Label>
                <Select value={formGasto.proyecto_id || ''} onValueChange={(v) => setFormGasto({ ...formGasto, proyecto_id: v })} required>
                  <SelectTrigger><SelectValue placeholder="Selecciona un proyecto" /></SelectTrigger>
                  <SelectContent>
                    {(proyectosParaGasto || []).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.folio} – {p.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoría *</Label>
                <Select value={formGasto.categoria} onValueChange={(v) => setFormGasto({ ...formGasto, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_GASTO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={formGasto.monto} onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <DatePicker value={formGasto.fecha} onChange={(fecha) => setFormGasto({ ...formGasto, fecha })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <Input value={formGasto.proveedor} onChange={(e) => setFormGasto({ ...formGasto, proveedor: e.target.value })} placeholder="Nombre del proveedor" />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <textarea className="w-full border rounded-lg px-3 py-2" rows={2} value={formGasto.descripcion} onChange={(e) => setFormGasto({ ...formGasto, descripcion: e.target.value })} placeholder="Concepto del gasto" />
            </div>
            <div className="space-y-2">
              <Label>Factura / Evidencia</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFormGasto({ ...formGasto, factura_file: e.target.files?.[0] || null })} />
                <Upload className="w-4 h-4 text-gray-400" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={savingGasto}>{savingGasto ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar Gasto'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={movimientoDialogOpen} onOpenChange={setMovimientoDialogOpen}>
        <DialogContent className="w-[100vw] max-w-md overflow-y-auto max-h-[90vh] sm:w-full">
          <DialogHeader><DialogTitle>Registrar Movimiento (Ingreso)</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Proyecto *</Label>
              <Combobox options={proyectosOptions} value={selectedProyectoId} onChange={setSelectedProyectoId} placeholder="Buscar proyecto..." searchPlaceholder="Buscar por folio o descripción..." notFoundMessage="Ningún proyecto encontrado." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monto *</Label>
                <Input type="number" step="0.01" value={ingresoForm.monto} onChange={(e) => setIngresoForm((f) => ({ ...f, monto: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>Fecha *</Label>
                <DatePicker value={ingresoForm.fecha} onChange={(fecha) => setIngresoForm((f) => ({ ...f, fecha }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Método de pago *</Label>
              <Select value={ingresoForm.metodoPago} onValueChange={(v) => setIngresoForm((f) => ({ ...f, metodoPago: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>
                  {CUENTAS_PAGO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {avisoMovimiento.mensaje && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  ⚠️ {avisoMovimiento.mensaje}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Comentarios (opcional)</Label>
              <textarea className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} value={ingresoForm.comentarios} onChange={(e) => setIngresoForm((f) => ({ ...f, comentarios: e.target.value }))} placeholder="Ej. Anticipo 50%" />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
              <Button onClick={handleRegistrarIngreso} disabled={savingIngreso}>
                {savingIngreso && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Guardar Ingreso
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Finanzas;
