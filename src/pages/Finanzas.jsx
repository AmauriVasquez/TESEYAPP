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
import { empresaLabel, marcaLabel, estatusFactura, desglosePago } from '@/lib/facturacionDisplay';
import RegistrarFacturaDialog from '@/components/finanzas/RegistrarFacturaDialog';
import RegistrarPagoDialog from '@/components/proyectos/RegistrarPagoDialog';
import PagoMultiProyectoDialog from '@/components/finanzas/PagoMultiProyectoDialog';
import SeleccionarFormatoCotizacionDialog from '@/components/cotizaciones/SeleccionarFormatoCotizacionDialog';
import { getCuentaLabel } from '@/config/cuentasPago';
import { useProyectosPathPrefix } from '@/hooks/useProyectosPathPrefix';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { usePermissions } from '@/contexts/PermissionsContext';

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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pagoProyecto, setPagoProyecto] = useState(null);
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false);
  const [multiOpen, setMultiOpen] = useState(false);
  const [clienteSel, setClienteSel] = useState('');
  const [clientesOpts, setClientesOpts] = useState([]);
  const [proyectosCliente, setProyectosCliente] = useState([]);
  const [selProyectos, setSelProyectos] = useState([]);
  const [preMulti, setPreMulti] = useState([]);
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
  const subtotalPeriodo = useMemo(
    () => (ingresosConProyecto || []).reduce((s, i) => s + desglosePago(i.monto, i.aplica_iva).subtotal, 0),
    [ingresosConProyecto]
  );
  const ivaPeriodo = useMemo(
    () => (ingresosConProyecto || []).reduce((s, i) => s + desglosePago(i.monto, i.aplica_iva).iva, 0),
    [ingresosConProyecto]
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

  const navigate = useNavigate();
  const proyectosBase = useProyectosPathPrefix();
  const [previewCotId, setPreviewCotId] = useState(null);
  const [ingresosConProyecto, setIngresosConProyecto] = useState([]);
  const [filtroFactura, setFiltroFactura] = useState('todas');
  const [facturaProyecto, setFacturaProyecto] = useState(null);
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
    let cancelled = false;
    (async () => {
      const { data: proyData } = await supabase
        .from('proyectos')
        .select('id, folio, descripcion, requiere_cfdi, factura_descartada, cliente:cliente_id(nombre), cliente_nombre_externo, cotizacion_id, cotizacion_folio, cotizacion:cotizacion_id(branding, marca_comercial, aplica_iva)')
        .in('id', proyectoIds);
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
            aplica_iva: p?.cotizacion?.aplica_iva !== false,
            cotizacion_id: p?.cotizacion_id ?? null,
            cot_folio: p?.cotizacion_folio ?? '',
          },
        }),
        {}
      );
      const { data: progreso } = await supabase
        .from('v_proyecto_pago_progreso')
        .select('proyecto_id, costo_total, pct_pagado')
        .in('proyecto_id', proyectoIds);
      const progPorProy = (progreso || []).reduce((a, r) => { a[r.proyecto_id] = r; return a; }, {});
      const pagoIds = list.map((i) => i?.id).filter(Boolean);
      let facturaPorPago = {};
      if (pagoIds.length > 0) {
        const { data: pagosFact } = await supabase
          .from('proyecto_pagos')
          .select('id, factura:factura_id(numero)')
          .in('id', pagoIds);
        facturaPorPago = (pagosFact || []).reduce((acc, r) => {
          acc[r.id] = r?.factura?.numero ?? null;
          return acc;
        }, {});
      }
      if (cancelled) return;
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
            factura_numero: facturaPorPago[i?.id] ?? null,
            aplica_iva: p?.aplica_iva ?? true,
            cotizacion_id: p?.cotizacion_id ?? null,
            cotizacion_folio: p?.cot_folio ?? '',
            proyecto_folio: p?.folio ?? '',
            pct_pagado: progPorProy[i.proyecto_id]?.pct_pagado ?? 0,
            costo_total_proyecto: progPorProy[i.proyecto_id]?.costo_total ?? 0,
          };
        })
      );
    })();
    return () => { cancelled = true; };
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

  const ingresosFiltrados = useMemo(() => {
    if (filtroFactura === 'todas') return sortedIngresos;
    return (sortedIngresos || []).filter((i) => estatusFactura(i).key === filtroFactura);
  }, [sortedIngresos, filtroFactura]);

  const abrirFactura = useCallback(async (proyectoId) => {
    const { data } = await supabase
      .from('proyectos')
      .select('id, folio, descripcion, cotizacion:cotizacion_id(branding)')
      .eq('id', proyectoId)
      .single();
    setFacturaProyecto(data || null);
  }, []);

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
    setPickerOpen(true);
    setClienteSel('');
    setProyectosCliente([]);
    setSelProyectos([]);
    supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => {
      setClientesOpts((data || []).map((c) => ({ value: String(c.id), label: c.nombre })));
    });
  };

  const cargarProyectosCliente = async (clienteId) => {
    setSelProyectos([]);
    const { data: proys } = await supabase
      .from('proyectos')
      .select('id, folio, descripcion, cotizacion_folio, costo_total, cotizacion_id, requiere_cfdi, cliente:cliente_id(nombre)')
      .eq('cliente_id', parseInt(clienteId, 10));
    const ids = (proys || []).map((p) => p.id);
    const { data: prog } = ids.length
      ? await supabase.from('v_proyecto_pago_progreso').select('proyecto_id, costo_total, total_pagado').in('proyecto_id', ids)
      : { data: [] };
    const saldoPorProy = (prog || []).reduce((a, r) => { a[r.proyecto_id] = Number(r.costo_total || 0) - Number(r.total_pagado || 0); return a; }, {});
    const lista = (proys || [])
      .map((p) => ({ ...p, saldo: Math.round((saldoPorProy[p.id] ?? Number(p.costo_total || 0)) * 100) / 100 }))
      .filter((p) => p.saldo > 1);
    setProyectosCliente(lista);
  };

  const handleContinuarCobro = async () => {
    if (selProyectos.length === 1) {
      const pMatch = proyectosCliente.find((x) => String(x.id) === selProyectos[0]);
      if (!pMatch) return;
      const { data } = await supabase
        .from('proyectos')
        .select('id, folio, descripcion, costo_total, cotizacion_id, requiere_cfdi, cotizacion_folio, cliente:cliente_id(nombre), cliente_nombre_externo')
        .eq('id', pMatch.id)
        .single();
      if (!data) { toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el proyecto.' }); return; }
      setPagoProyecto(data);
      setPickerOpen(false);
      setPagoDialogOpen(true);
    } else if (selProyectos.length > 1) {
      const pre = proyectosCliente.filter((x) => selProyectos.includes(String(x.id))).map((x) => ({ id: x.id, folio: x.folio, descripcion: x.descripcion }));
      setPreMulti(pre);
      setPickerOpen(false);
      setMultiOpen(true);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-sm font-medium text-slate-700">Ingresos sin IVA (subtotal)</p>
                <p className="text-2xl font-bold text-slate-800">${Number(subtotalPeriodo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500 mt-1">{periodoLabel}</p>
              </div>
              <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                <p className="text-sm font-medium text-purple-700">IVA del periodo</p>
                <p className="text-2xl font-bold text-purple-800">${Number(ivaPeriodo || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-gray-500 mt-1">{periodoLabel}</p>
              </div>
            </div>
            <Tabs defaultValue="ingresos" className="space-y-2">
              <TabsList>
                <TabsTrigger value="ingresos">Ingresos del Periodo</TabsTrigger>
                <TabsTrigger value="gastos">Gastos del Periodo</TabsTrigger>
              </TabsList>
              <TabsContent value="ingresos" className="space-y-2 mt-2">
                <div className="flex gap-2 flex-wrap text-xs pb-1">
                  {[['todas', 'Todas'], ['pendiente', 'Pendientes'], ['facturado', 'Facturadas'], ['descartado', 'No se facturará'], ['sin_iva', 'Sin IVA']].map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setFiltroFactura(k)}
                      className={cn('px-3 py-1 rounded-full border transition-colors', filtroFactura === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-muted/50')}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <div className="sm:hidden space-y-2">
                  {ingresosFiltrados.length === 0 ? (
                    <p className="text-center py-6 text-gray-500">No hay ingresos en el periodo.</p>
                  ) : ingresosFiltrados.map((i, idx) => {
                    const dg = desglosePago(i.monto, i.aplica_iva);
                    return (
                    <div key={i?.id ?? `ingm-${idx}`} className="rounded-lg border p-3 bg-white">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{i.cliente}</span>
                        <span className="text-sm font-semibold text-green-700">${dg.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {i.proyecto_folio ? <button className="text-blue-600 hover:underline" onClick={() => navigate(`${proyectosBase}/${i.proyecto_id}`)}>{i.proyecto_folio}</button> : '—'}
                        {i.cotizacion_id ? <>{' · '}<button className="text-blue-600 hover:underline font-mono" onClick={() => setPreviewCotId(i.cotizacion_id)}>{i.cotizacion_folio || `COT-${i.cotizacion_id}`}</button></> : null}
                        {' · '}{empresaLabel(i.empresa)} · {getCuentaLabel(i.cuenta_value || i.metodo_pago)}
                      </p>
                      <p className="text-xs text-gray-400">{formatDateTable(i.fecha || i.fecha_pago)} · {Math.round(i.pct_pagado ?? 0)}% pagado</p>
                      {(() => {
                        const e = estatusFactura(i);
                        const toneCls = { green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800 cursor-pointer', gray: 'bg-gray-100 text-gray-600', muted: 'text-gray-400' }[e.tone];
                        const clickable = e.key === 'pendiente';
                        return (
                          <span
                            className={cn('inline-block mt-1 px-2 py-0.5 rounded-full text-xs', toneCls)}
                            onClick={clickable ? () => abrirFactura(i.proyecto_id) : undefined}
                          >
                            {e.label}{clickable ? ' ▸' : ''}
                          </span>
                        );
                      })()}
                    </div>
                    );
                  })}
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
                        <TableHead>Empresa</TableHead>
                        <TableHead>Marca</TableHead>
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
                        <TableHead>Cotización</TableHead>
                        <TableHead>Proyecto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">IVA</TableHead>
                        <TableHead
                          className="text-right cursor-pointer hover:bg-muted/50 transition-colors select-none"
                          onClick={() => handleSortIngresos('monto')}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Total
                            {sortConfigIngresos.key !== 'monto' && <ArrowUpDown className="text-muted-foreground w-4 h-4" />}
                            {sortConfigIngresos.key === 'monto' && (sortConfigIngresos.direction === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />)}
                          </span>
                        </TableHead>
                        <TableHead className="text-center">Factura</TableHead>
                        <TableHead className="text-right">% pago</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ingresosFiltrados.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center py-6 text-gray-500">No hay ingresos en el periodo.</TableCell>
                        </TableRow>
                      ) : (
                        ingresosFiltrados.map((i, idx) => (
                          <TableRow key={i?.id ?? `ing-${idx}`}>
                            {(() => { const dg = desglosePago(i.monto, i.aplica_iva); return (<>
                              <TableCell className="whitespace-nowrap">{formatDateTable(i.fecha || i.fecha_pago)}</TableCell>
                              <TableCell>{empresaLabel(i.empresa)}</TableCell>
                              <TableCell>{marcaLabel(i.marca)}</TableCell>
                              <TableCell>{i.cliente}</TableCell>
                              <TableCell>{i.cotizacion_id ? <button className="text-blue-600 hover:underline font-mono text-xs" onClick={() => setPreviewCotId(i.cotizacion_id)}>{i.cotizacion_folio || `COT-${i.cotizacion_id}`}</button> : '—'}</TableCell>
                              <TableCell>{i.proyecto_folio ? <button className="text-blue-600 hover:underline" onClick={() => navigate(`${proyectosBase}/${i.proyecto_id}`)}>{i.proyecto_folio}</button> : '—'}</TableCell>
                              <TableCell className="whitespace-nowrap">{getCuentaLabel(i.cuenta_value || i.metodo_pago)}</TableCell>
                              <TableCell className="text-right">${dg.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right">${dg.iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="text-right font-medium text-green-700">${dg.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                            </>); })()}
                            <TableCell className="text-center">
                              {(() => {
                                const e = estatusFactura(i);
                                const toneCls = { green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800 cursor-pointer', gray: 'bg-gray-100 text-gray-600', muted: 'text-gray-400' }[e.tone];
                                const clickable = e.key === 'pendiente';
                                return (
                                  <span
                                    className={cn('px-2 py-0.5 rounded-full text-xs', toneCls)}
                                    onClick={clickable ? () => abrirFactura(i.proyecto_id) : undefined}
                                  >
                                    {e.label}{clickable ? ' ▸' : ''}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-medium">{Math.round(i.pct_pagado ?? 0)}%</span>
                              <span className="block text-[10px] text-gray-400">de ${Number(i.costo_total_proyecto || 0).toLocaleString('es-MX')}</span>
                            </TableCell>
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

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-[100vw] max-w-lg sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Movimiento — elige cliente</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Combobox options={clientesOpts} value={clienteSel} onChange={(v) => { setClienteSel(v); cargarProyectosCliente(v); }} placeholder="Buscar cliente..." searchPlaceholder="Buscar por nombre..." notFoundMessage="Ningún cliente encontrado." />
            </div>
            {clienteSel && (
              <div className="space-y-2">
                <Label>Proyectos con saldo pendiente</Label>
                {proyectosCliente.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No hay proyectos con saldo pendiente para este cliente.</p>
                ) : (
                  <>
                    {proyectosCliente.map((p) => {
                      const checked = selProyectos.includes(String(p.id));
                      return (
                        <label key={p.id} className="flex items-center gap-2 p-2 border rounded cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={(e) => setSelProyectos((s) => e.target.checked ? [...s, String(p.id)] : s.filter((x) => x !== String(p.id)))} />
                          <span className="flex-1 text-sm">{p.descripcion} <span className="text-gray-400 font-mono text-xs">({p.cotizacion_folio || `COT-${p.cotizacion_id}`} / {p.folio})</span></span>
                          <span className="text-xs text-amber-700">${p.saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                        </label>
                      );
                    })}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="text-sm text-gray-600">{selProyectos.length} proyecto(s) · ${proyectosCliente.filter(p => selProyectos.includes(String(p.id))).reduce((s,p)=>s+p.saldo,0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      <Button disabled={selProyectos.length === 0} onClick={handleContinuarCobro}>Continuar</Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {pagoProyecto && (
        <RegistrarPagoDialog
          open={pagoDialogOpen}
          onOpenChange={(o) => { setPagoDialogOpen(o); if (!o) setPagoProyecto(null); }}
          proyectoId={pagoProyecto.id}
          proyecto={pagoProyecto}
          onSave={() => { fetchDatos(); fetchChartData(); fetchDatosCuentasPorCobrar(); setPagoDialogOpen(false); setPagoProyecto(null); }}
        />
      )}

      <PagoMultiProyectoDialog
        open={multiOpen}
        onOpenChange={(o) => { setMultiOpen(o); if (!o) setPreMulti([]); }}
        onSaved={() => { fetchDatos(); fetchChartData(); fetchDatosCuentasPorCobrar(); setMultiOpen(false); setPreMulti([]); }}
        preProyectos={preMulti}
      />

      <RegistrarFacturaDialog
        open={!!facturaProyecto}
        onOpenChange={(o) => { if (!o) setFacturaProyecto(null); }}
        proyecto={facturaProyecto}
        onSaved={() => { setFacturaProyecto(null); fetchDatos(); }}
      />

      {previewCotId && (
        <SeleccionarFormatoCotizacionDialog
          open={!!previewCotId}
          onOpenChange={(o) => { if (!o) setPreviewCotId(null); }}
          cotizacionId={previewCotId}
          cotizacion={null}
          modoProyecto={true}
          onEditar={() => setPreviewCotId(null)}
          onCrearNuevaVersion={() => setPreviewCotId(null)}
        />
      )}
    </>
  );
};

export default Finanzas;
