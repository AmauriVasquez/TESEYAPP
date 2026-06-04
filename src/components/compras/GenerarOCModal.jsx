import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { unidadImpresionPedidoItem } from '@/lib/pedidoMaterialesItemHelpers';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';

const TASA_IVA_OPTS = [
  { value: '16', label: '16%' },
  { value: '8', label: '8% (Frontera)' },
  { value: '0', label: '0%' },
  { value: 'exento', label: 'Exento' },
];
const FORMA_PAGO_OPTS = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'PARCIALIDADES', label: 'Parcialidades' },
];
const emptyPago = () => ({ concepto: '', porcentaje: '' });

function formatCurrency(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(Number(n) || 0);
}

function proveedorLabel(p) {
  const n = (p?.nombre_comercial ?? '').toString().trim();
  const r = (p?.razon_social ?? '').toString().trim();
  return n || r || String(p?.id ?? '');
}

const emptyOcForm = () => ({
  empresa_id: '',
  proveedor_id: '',
  solicitante: '',
  comprador: '',
  descripcion: '',
});

/**
 * Modal para generar OC desde un Pedido de Materiales.
 * Diseño alineado con "+ Nueva OC": empresa, proveedor, datos bancarios, proyecto, partidas con selección, observaciones y esquema de pagos.
 */
const GenerarOCModal = ({ open, onOpenChange, pedidoId, items: itemsProp = [], pedidoInfo: pedidoInfoProp, proveedorSugeridoId, onSuccess }) => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [folioPreview, setFolioPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [ocForm, setOcForm] = useState(() => emptyOcForm());
  const [solicitantes, setSolicitantes] = useState([]);
  const [loadingSolicitantes, setLoadingSolicitantes] = useState(false);
  const [solicitanteId, setSolicitanteId] = useState('');
  const [proyectoTexto, setProyectoTexto] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [formaPago, setFormaPago] = useState('CONTADO');
  const [parcialidades, setParcialidades] = useState([{ concepto: 'Anticipo', porcentaje: '50' }, { concepto: 'Saldo', porcentaje: '50' }]);
  const [tasaIva, setTasaIva] = useState('16');
  const [ieps, setIeps] = useState('');
  const [retencionIva, setRetencionIva] = useState('');
  const [retencionIsr, setRetencionIsr] = useState('');
  const [pedidoItems, setPedidoItems] = useState([]);
  const [selection, setSelection] = useState({}); // itemId -> { selected, cantidadSolicitar, precio_unitario }
  // Partidas EXTRA libres (no ligadas al pedido): material_id/pedido_item_id null.
  const [extraItems, setExtraItems] = useState([]); // [{ id, descripcion, unidad, cantidad, precio_unitario }]

  const loadProveedores = useCallback(async () => {
    setLoadingProveedores(true);
    try {
      const { data, error } = await supabase
        .from('proveedores')
        .select('id, nombre_comercial, razon_social')
        .order('nombre_comercial');
      if (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Error cargando proveedores' });
        setProveedores([]);
        return;
      }
      setProveedores(data ?? []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Error cargando proveedores' });
      setProveedores([]);
    } finally {
      setLoadingProveedores(false);
    }
  }, [toast]);

  const loadEmpresas = useCallback(async () => {
    setLoadingEmpresas(true);
    try {
      const { data, error } = await supabase.from('empresas').select('id, nombre, prefijo').order('nombre');
      if (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'Error cargando empresas' });
        setEmpresas([]);
        return;
      }
      setEmpresas(data ?? []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'Error cargando empresas' });
      setEmpresas([]);
    } finally {
      setLoadingEmpresas(false);
    }
  }, [toast]);

  const loadCompradorAndSolicitantes = useCallback(async () => {
    setLoadingSolicitantes(true);
    setOcForm((prev) => ({ ...prev, comprador: '' }));
    try {
      const [compradorRes, solicitantesRes] = await Promise.all([
        authUser?.id
          ? supabase.from('usuarios').select('nombre_completo').eq('id', authUser.id).maybeSingle()
          : { data: null },
        supabase.from('usuarios').select('id, nombre_completo').order('nombre_completo'),
      ]);
      const nombre = compradorRes?.data?.nombre_completo ?? authUser?.user_metadata?.full_name ?? authUser?.email ?? '';
      setOcForm((prev) => ({ ...prev, comprador: nombre || '' }));
      if (solicitantesRes.error) throw solicitantesRes.error;
      setSolicitantes(solicitantesRes.data ?? []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los usuarios.' });
      setSolicitantes([]);
    } finally {
      setLoadingSolicitantes(false);
    }
  }, [authUser?.id, authUser?.user_metadata?.full_name, authUser?.email, toast]);

  const fetchItemsAndPedido = useCallback(async () => {
    if (!pedidoId) {
      setPedidoItems([]);
      return;
    }
    setLoadingItems(true);
    try {
      const [itemsRes, pedidoRes] = await Promise.all([
        supabase
          .from('pedidos_materiales_items')
          .select('id, cantidad, material_id, precio_unitario, unidad_id, descripcion, catalogo_unidades(nombre), materiales(descripcion, unidad_compra)')
          .eq('pedido_id', pedidoId),
        supabase
          .from('pedidos_materiales')
          .select('id, folio, cuenta, proyecto_id, proyecto:proyecto_id(descripcion, folio)')
          .eq('id', pedidoId)
          .single()
      ]);
      if (itemsRes.error) throw itemsRes.error;
      const rows = (itemsRes.data ?? []).map((i) => ({
        id: i.id,
        cantidad: Number(i.cantidad) || 0,
        material_id: i.material_id,
        descripcion: (i.descripcion ?? i.materiales?.descripcion ?? '—').toString().trim() || '—',
        unidad: unidadImpresionPedidoItem(i),
        precio_unitario: i.precio_unitario ?? 0,
      }));
      setPedidoItems(rows);
      if (pedidoRes?.data) {
        const proy = pedidoRes.data.proyecto;
        const proyLabel = proy ? (proy.descripcion || proy.folio || '') : '';
        setProyectoTexto(proyLabel || pedidoRes.data.cuenta || pedidoRes.data.folio || '');
      }
      setSelection({});
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las partidas del pedido.' });
      setPedidoItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [pedidoId, toast]);

  useEffect(() => {
    if (open) {
      loadProveedores();
      loadEmpresas();
      loadCompradorAndSolicitantes();
      setOcForm({
        ...emptyOcForm(),
        proveedor_id: proveedorSugeridoId ? String(proveedorSugeridoId) : '',
      });
      setSolicitanteId('');
      setFolioPreview('');
      setObservaciones('');
      setFormaPago('CONTADO');
      setParcialidades([{ concepto: 'Anticipo', porcentaje: '50' }, { concepto: 'Saldo', porcentaje: '50' }]);
      setTasaIva('16');
      setIeps('');
      setRetencionIva('');
      setRetencionIsr('');
      setExtraItems([]);
      if (pedidoId) {
        fetchItemsAndPedido();
      } else {
        setPedidoItems([]);
        setSelection({});
      }
    }
  }, [open, pedidoId, loadProveedores, loadEmpresas, loadCompradorAndSolicitantes, fetchItemsAndPedido, proveedorSugeridoId, pedidoInfoProp?.proyecto_id]);

  useEffect(() => {
    if (!open || loadingEmpresas || empresas.length === 0) return;
    setOcForm((prev) => (prev.empresa_id ? prev : { ...prev, empresa_id: String(empresas[0].id) }));
  }, [open, loadingEmpresas, empresas]);

  useEffect(() => {
    const loadFolioPreview = async () => {
      if (!open || !ocForm.empresa_id) {
        setFolioPreview('');
        return;
      }
      try {
        const empresaSel = empresas.find((e) => String(e.id) === String(ocForm.empresa_id));
        const prefijo = (empresaSel?.prefijo ?? empresaSel?.nombre ?? '').toString().trim().toUpperCase();
        const { data, error } = await supabase
          .from('empresa_folios')
          .select('ultimo_consecutivo')
          .eq('empresa_id', ocForm.empresa_id)
          .single();
        if (error) throw error;
        const consecutivo = (Number(data?.ultimo_consecutivo) || 0) + 1;
        setFolioPreview(`${prefijo}-OC-${String(consecutivo).padStart(6, '0')}`);
      } catch (err) {
        console.error(err);
        setFolioPreview('Error al generar folio');
      }
    };
    loadFolioPreview();
  }, [open, ocForm.empresa_id, empresas]);

  useEffect(() => {
    if (open && !pedidoId && itemsProp?.length > 0) {
      const rows = itemsProp.filter((i) => i.id).map((i) => ({
        id: i.id,
        cantidad: Number(i.cantidad) || 0,
        material_id: i.material_id ?? null,
        descripcion: (i.descripcion ?? '—').toString().trim() || '—',
        unidad: unidadImpresionPedidoItem(i),
        precio_unitario: i.precio_unitario ?? 0,
      }));
      setPedidoItems(rows);
      setProyectoTexto(pedidoInfoProp?.proyecto?.descripcion ?? pedidoInfoProp?.folio ?? '');
      setSelection({});
    }
  }, [open, pedidoId, itemsProp, pedidoInfoProp]);

  const setItemSelected = (itemId, selected) => {
    const item = pedidoItems.find((i) => i.id === itemId);
    setSelection((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        selected,
        cantidadSolicitar: prev[itemId]?.cantidadSolicitar ?? item?.cantidad ?? 0,
        precio_unitario: prev[itemId]?.precio_unitario ?? item?.precio_unitario ?? 0
      }
    }));
  };

  const setItemCantidadSolicitar = (itemId, value) => {
    const num = parseFloat(value);
    setSelection((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        selected: prev[itemId]?.selected ?? false,
        cantidadSolicitar: Number.isFinite(num) && num >= 0 ? num : (prev[itemId]?.cantidadSolicitar ?? 0),
        precio_unitario: prev[itemId]?.precio_unitario ?? 0
      }
    }));
  };

  const setItemPrecio = (itemId, value) => {
    const num = parseFloat(value);
    setSelection((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        selected: prev[itemId]?.selected ?? false,
        cantidadSolicitar: prev[itemId]?.cantidadSolicitar ?? pedidoItems.find((i) => i.id === itemId)?.cantidad ?? 0,
        precio_unitario: Number.isFinite(num) && num >= 0 ? num : 0
      }
    }));
  };

  const getItemSelection = (itemId) => {
    const item = pedidoItems.find((i) => i.id === itemId);
    const s = selection[itemId];
    return {
      selected: s?.selected ?? false,
      cantidadSolicitar: s?.cantidadSolicitar ?? item?.cantidad ?? 0,
      precio_unitario: s?.precio_unitario ?? item?.precio_unitario ?? 0
    };
  };

  const addExtraItem = () =>
    setExtraItems((prev) => [
      ...prev,
      { id: `extra-${Date.now()}-${prev.length}`, descripcion: '', unidad: '', cantidad: '', precio_unitario: '' },
    ]);
  const removeExtraItem = (id) => setExtraItems((prev) => prev.filter((e) => e.id !== id));
  const updateExtraItem = (id, field, value) =>
    setExtraItems((prev) => prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)));

  // Extras válidas: con descripción, cantidad > 0 y precio >= 0.
  const validExtraItems = extraItems.filter(
    (e) => (e.descripcion ?? '').trim() && Number(e.cantidad) > 0 && Number(e.precio_unitario) >= 0
  );

  const selectedItems = pedidoItems.filter((i) => getItemSelection(i.id).selected);
  const subtotalPedido = selectedItems.reduce((sum, i) => {
    const { cantidadSolicitar, precio_unitario } = getItemSelection(i.id);
    return sum + (Number(cantidadSolicitar) || 0) * (Number(precio_unitario) || 0);
  }, 0);
  const subtotalExtras = validExtraItems.reduce(
    (sum, e) => sum + (Number(e.cantidad) || 0) * (Number(e.precio_unitario) || 0),
    0
  );
  const subtotal = subtotalPedido + subtotalExtras;
  // ¿Hay al menos una partida (del pedido o extra) para poder guardar?
  const hayPartidas = selectedItems.length > 0 || validExtraItems.length > 0;
  const tasaIvaNum = tasaIva === 'exento' ? 0 : (parseFloat(tasaIva) || 0);
  const iva = subtotal * (tasaIvaNum / 100);
  const iepsNum = parseFloat(String(ieps).replace(',', '.')) || 0;
  const retencionIvaNum = parseFloat(String(retencionIva).replace(',', '.')) || 0;
  const retencionIsrNum = parseFloat(String(retencionIsr).replace(',', '.')) || 0;
  const totalNeto = subtotal + iva + iepsNum - retencionIvaNum - retencionIsrNum;
  const empresaSel = empresas.find((e) => String(e.id) === String(ocForm.empresa_id));
  const proveedorSel = proveedores.find((p) => String(p.id) === String(ocForm.proveedor_id));

  const addParcialidad = () => setParcialidades((prev) => [...prev, emptyPago()]);
  const removeParcialidad = (index) => setParcialidades((prev) => prev.filter((_, i) => i !== index));
  const updateParcialidad = (index, field, value) => {
    setParcialidades((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };
  const sumaPorcentajes = parcialidades.reduce((s, p) => s + (parseFloat(String(p.porcentaje).replace(',', '.')) || 0), 0);
  const porcentajesValidos = Math.abs(sumaPorcentajes - 100) < 0.01;

  const handleConfirm = async () => {
    if (!ocForm.empresa_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una empresa.' });
      return;
    }
    if (!ocForm.proveedor_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un proveedor.' });
      return;
    }
    if (!solicitanteId || !(ocForm.solicitante ?? '').trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un solicitante.' });
      return;
    }
    if (!hayPartidas) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona al menos una partida del pedido o agrega una partida extra.' });
      return;
    }
    const sinCantidad = selectedItems.find((i) => {
      const { cantidadSolicitar } = getItemSelection(i.id);
      return !(Number(cantidadSolicitar) > 0);
    });
    if (sinCantidad) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cada partida debe tener cantidad a solicitar mayor a cero.' });
      return;
    }
    const invalid = selectedItems.find((i) => {
      const p = getItemSelection(i.id).precio_unitario;
      return p == null || p < 0;
    });
    if (invalid) {
      toast({ variant: 'destructive', title: 'Error', description: 'Indica un precio unitario válido en todas las partidas seleccionadas.' });
      return;
    }
    if (formaPago === 'PARCIALIDADES' && !porcentajesValidos) {
      toast({ variant: 'destructive', title: 'Error', description: 'La suma de porcentajes debe ser exactamente 100%.' });
      return;
    }

    setSaving(true);
    try {
      const insertBody = {
        empresa_id: ocForm.empresa_id,
        proveedor_id: ocForm.proveedor_id,
        solicitante: (ocForm.solicitante || '').trim(),
        comprador: (ocForm.comprador || '').trim(),
        descripcion: (ocForm.descripcion || '').trim(),
      };

      const ociRowsPedido = selectedItems.map((item) => {
        const { cantidadSolicitar, precio_unitario } = getItemSelection(item.id);
        const qty = Number(cantidadSolicitar) || 0;
        const pu = Number(precio_unitario) || 0;
        const row = {
          descripcion: (item.descripcion ?? '').toString().trim() || '—',
          cantidad: qty,
          unidad: (item.unidad ?? 'N/A').toString().trim() || 'N/A',
          precio_unitario: pu,
          importe: qty * pu,
          material_id: item.material_id ?? null,
        };
        // Solo si la partida proviene de un pedido: la RPC la enlaza en la misma transacción.
        if (pedidoId) row.pedido_item_id = item.id;
        return row;
      });

      // Partidas EXTRA libres: no ligadas al pedido (material_id/pedido_item_id null).
      const ociRowsExtra = validExtraItems.map((e) => {
        const qty = Number(e.cantidad) || 0;
        const pu = Number(e.precio_unitario) || 0;
        return {
          descripcion: (e.descripcion ?? '').toString().trim() || '—',
          cantidad: qty,
          unidad: (e.unidad ?? 'N/A').toString().trim() || 'N/A',
          precio_unitario: pu,
          importe: qty * pu,
          material_id: null,
        };
      });

      const ociRows = [...ociRowsPedido, ...ociRowsExtra];

      if (ociRows.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se puede crear una orden de compra sin partidas.' });
        return;
      }

      // Creación atómica: header + partidas + enlace de items del pedido en UNA transacción.
      const { data: nuevaOC, error: rpcError } = await supabase.rpc('crear_orden_compra', {
        p_oc: insertBody,
        p_items: ociRows,
      });
      if (rpcError) throw rpcError;
      const ocRow = Array.isArray(nuevaOC) ? nuevaOC[0] : nuevaOC;
      const folioMostrado = ocRow?.folio ?? ocRow?.folio_oc ?? '';

      toast({ title: 'OC generada', description: `Folio: ${folioMostrado || '—'}. ${ociRows.length} partida(s).` });
      window.setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 600);
    } catch (err) {
      console.error('Error generar OC:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo generar la orden de compra.' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPreview = () => {
    if (!ocForm.empresa_id) {
      toast({ variant: 'destructive', title: 'Falta información', description: 'Selecciona una empresa para previsualizar.' });
      return;
    }
    if (!ocForm.proveedor_id) {
      toast({ variant: 'destructive', title: 'Falta información', description: 'Selecciona un proveedor para previsualizar.' });
      return;
    }
    if (!hayPartidas) {
      toast({ variant: 'destructive', title: 'Falta información', description: 'Selecciona al menos una partida (del pedido o extra) para previsualizar.' });
      return;
    }
    setShowPreview(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Generar OC desde Pedido</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Folio OC</Label>
              <Input
                value={folioPreview}
                readOnly
                placeholder=""
                title="Folio estimado, se asigna al guardar"
                className="font-mono mt-1 bg-gray-100 text-gray-500 border-dashed cursor-not-allowed"
              />
            </div>
            <div>
              <Label>Empresa *</Label>
              <Select
                value={ocForm.empresa_id || undefined}
                onValueChange={(v) => setOcForm((prev) => ({ ...prev, empresa_id: v }))}
                required
                disabled={loadingEmpresas || empresas.length === 0}
              >
                <SelectTrigger><SelectValue placeholder={loadingEmpresas ? 'Cargando...' : 'Selecciona empresa...'} /></SelectTrigger>
                <SelectContent>
                  {empresas.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Proyecto / Cuenta</Label>
              <Input value={proyectoTexto} onChange={(e) => setProyectoTexto(e.target.value)} placeholder="Del pedido (pre-llenado)" />
            </div>
            <div>
              <Label>Comprador</Label>
              <Input
                value={loadingSolicitantes && !ocForm.comprador ? 'Cargando...' : (ocForm.comprador || '—')}
                readOnly
                disabled
                className="bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
            <div>
              <Label>Solicitante *</Label>
              <Select
                value={solicitanteId || undefined}
                onValueChange={(v) => {
                  setSolicitanteId(v);
                  const u = solicitantes.find((x) => String(x.id) === String(v));
                  setOcForm((prev) => ({ ...prev, solicitante: u?.nombre_completo ?? '' }));
                }}
                disabled={loadingSolicitantes}
              >
                <SelectTrigger><SelectValue placeholder={loadingSolicitantes ? 'Cargando...' : 'Selecciona solicitante...'} /></SelectTrigger>
                <SelectContent>
                  {solicitantes.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.nombre_completo ?? u.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proveedor *</Label>
              <Select
                value={ocForm.proveedor_id || undefined}
                onValueChange={(v) => setOcForm((prev) => ({ ...prev, proveedor_id: v }))}
                disabled={loadingProveedores}
              >
                <SelectTrigger><SelectValue placeholder={loadingProveedores ? 'Cargando...' : 'Selecciona proveedor...'} /></SelectTrigger>
                <SelectContent>
                  {proveedores.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{proveedorLabel(p)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descripción del pedido</Label>
            <Textarea value={ocForm.descripcion} onChange={(e) => setOcForm((prev) => ({ ...prev, descripcion: e.target.value }))} placeholder="Justificación de la compra" rows={2} className="mt-1" />
          </div>

          <div>
            <Label>Partidas del pedido</Label>
            {loadingItems ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="w-10 px-2 py-2 text-center">Sel</th>
                      <th className="text-center px-2 py-2 font-medium w-10">PDA</th>
                      <th className="text-left px-2 py-2 font-medium">Descripción / Material</th>
                      <th className="text-center px-2 py-2 font-medium w-16">Unidad</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Cant. pedida</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Cant. a solicitar</th>
                      <th className="text-right px-2 py-2 font-medium w-28">Precio unit.</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pedidoItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-gray-500 py-6">
                          No hay partidas. Guarda el pedido antes de generar una OC o abre desde un pedido guardado.
                        </td>
                      </tr>
                    ) : (
                      pedidoItems.map((item, idx) => {
                        const { selected, cantidadSolicitar, precio_unitario } = getItemSelection(item.id);
                        const importe = (Number(cantidadSolicitar) || 0) * (Number(precio_unitario) || 0);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2 text-center">
                              <Checkbox checked={selected} onCheckedChange={(c) => setItemSelected(item.id, !!c)} />
                            </td>
                            <td className="px-2 py-2 text-center font-mono">{idx + 1}</td>
                            <td className="px-2 py-2">{item.descripcion}</td>
                            <td className="px-2 py-2 text-center">{item.unidad}</td>
                            <td className="px-2 py-2 text-right font-mono">{item.cantidad}</td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                className="h-8 w-20 text-right"
                                value={selected ? (cantidadSolicitar === 0 ? '' : cantidadSolicitar) : ''}
                                onChange={(e) => setItemCantidadSolicitar(item.id, e.target.value)}
                                disabled={!selected}
                                placeholder={String(item.cantidad)}
                              />
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                className="h-8 w-24 text-right"
                                value={selected ? (precio_unitario || '') : ''}
                                onChange={(e) => setItemPrecio(item.id, e.target.value)}
                                disabled={!selected}
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">{selected ? formatCurrency(importe) : '—'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {/* Partidas EXTRA libres (no ligadas al pedido) */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <Label>Partidas adicionales (no ligadas al pedido)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addExtraItem} className="gap-1">
                  <PlusCircle className="w-4 h-4" /> Agregar partida
                </Button>
              </div>
              {extraItems.length > 0 && (
                <div className="border rounded-lg overflow-x-auto mt-2">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-2 py-2 font-medium">Descripción</th>
                        <th className="text-center px-2 py-2 font-medium w-20">Unidad</th>
                        <th className="text-right px-2 py-2 font-medium w-24">Cantidad</th>
                        <th className="text-right px-2 py-2 font-medium w-28">Precio unit.</th>
                        <th className="text-right px-2 py-2 font-medium w-24">Importe</th>
                        <th className="w-10 px-2 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {extraItems.map((e) => {
                        const importe = (Number(e.cantidad) || 0) * (Number(e.precio_unitario) || 0);
                        return (
                          <tr key={e.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2">
                              <Input
                                value={e.descripcion}
                                onChange={(ev) => updateExtraItem(e.id, 'descripcion', ev.target.value)}
                                placeholder="Descripción libre"
                                className="h-8"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                value={e.unidad}
                                onChange={(ev) => updateExtraItem(e.id, 'unidad', ev.target.value)}
                                placeholder="PZA"
                                className="h-8 w-20 text-center"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={e.cantidad}
                                onChange={(ev) => updateExtraItem(e.id, 'cantidad', ev.target.value)}
                                className="h-8 w-20 text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={e.precio_unitario}
                                onChange={(ev) => updateExtraItem(e.id, 'precio_unitario', ev.target.value)}
                                className="h-8 w-24 text-right"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-2 text-right font-medium">{formatCurrency(importe)}</td>
                            <td className="px-2 py-2 text-center">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeExtraItem(e.id)}>
                                <Trash2 className="w-4 h-4" />
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

            <div className="mt-2">
              <Label>Observaciones</Label>
              <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" rows={2} className="mt-1" />
            </div>
          </div>

          <div>
            <Label>Forma de pago</Label>
            <Select value={formaPago} onValueChange={setFormaPago}>
              <SelectTrigger className="mt-1 w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMA_PAGO_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formaPago === 'PARCIALIDADES' && (
              <div className="mt-3 border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Esquema de pagos (parcialidades)</Label>
                  <Button type="button" size="sm" variant="outline" onClick={addParcialidad} className="gap-1">
                    <PlusCircle className="w-4 h-4" /> Agregar
                  </Button>
                </div>
                {parcialidades.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={p.concepto}
                      onChange={(e) => updateParcialidad(idx, 'concepto', e.target.value)}
                      placeholder="Concepto (ej. Anticipo)"
                      className="h-8 flex-1 min-w-[120px]"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={p.porcentaje}
                      onChange={(e) => updateParcialidad(idx, 'porcentaje', e.target.value)}
                      placeholder="%"
                      className="h-8 w-20 text-right"
                    />
                    <span className="text-sm text-gray-500">%</span>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeParcialidad(idx)} disabled={parcialidades.length <= 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <p className={porcentajesValidos ? 'text-sm text-green-700' : 'text-sm text-red-600'}>
                  Suma: {sumaPorcentajes.toFixed(1)}% {porcentajesValidos ? '' : '— Debe ser exactamente 100%'}
                </p>
              </div>
            )}
          </div>

          {hayPartidas && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
              <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
                <span>Subtotal: <strong>{formatCurrency(subtotal)}</strong></span>
                <span className="flex items-center gap-1">
                  I.V.A.
                  <select
                    value={tasaIva}
                    onChange={(e) => setTasaIva(e.target.value)}
                    className="h-7 rounded border border-gray-300 bg-white px-1.5 text-sm"
                  >
                    {TASA_IVA_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  : <strong>{formatCurrency(iva)}</strong>
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
                <span className="text-gray-600">IEPS (+):</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ieps}
                  onChange={(e) => setIeps(e.target.value)}
                  className="h-8 w-24 text-right"
                  placeholder="0.00"
                />
                <span className="text-red-600">Ret. IVA (−):</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={retencionIva}
                  onChange={(e) => setRetencionIva(e.target.value)}
                  className="h-8 w-24 text-right text-red-700 border-red-200"
                  placeholder="0.00"
                />
                <span className="text-red-600">Ret. ISR (−):</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={retencionIsr}
                  onChange={(e) => setRetencionIsr(e.target.value)}
                  className="h-8 w-24 text-right text-red-700 border-red-200"
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end pt-1 border-t border-gray-200">
                <span>Total neto: <strong>{formatCurrency(totalNeto)}</strong></span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={handleOpenPreview} disabled={saving}>Previsualizar</Button>
          <Button
            onClick={handleConfirm}
            disabled={
              saving ||
              !hayPartidas ||
              !ocForm.empresa_id ||
              !ocForm.proveedor_id ||
              !solicitanteId ||
              (formaPago === 'PARCIALIDADES' && !porcentajesValidos)
            }
            className="bg-green-600 hover:bg-green-700"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Generar OC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Previsualización de Orden de Compra</DialogTitle>
        </DialogHeader>
        <div className="mx-auto w-full max-w-[816px] bg-white border border-gray-300 shadow-sm p-8 text-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs text-gray-500 uppercase">Empresa</p>
              <p className="font-semibold">{empresaSel?.nombre ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase">Folio</p>
              <p className="font-mono font-semibold">{folioPreview || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleDateString('es-MX')}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <p><span className="font-semibold">Proveedor:</span> {proveedorLabel(proveedorSel)}</p>
            <p><span className="font-semibold">Proyecto:</span> {proyectoTexto || '—'}</p>
            <p><span className="font-semibold">Comprador:</span> {ocForm.comprador || '—'}</p>
            <p><span className="font-semibold">Solicitante:</span> {ocForm.solicitante || '—'}</p>
          </div>
          <table className="w-full border border-gray-300 mb-6">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 p-2 text-left">Descripción</th>
                <th className="border border-gray-300 p-2 text-right">Cantidad</th>
                <th className="border border-gray-300 p-2 text-right">Precio</th>
                <th className="border border-gray-300 p-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {selectedItems.map((item) => {
                const { cantidadSolicitar, precio_unitario } = getItemSelection(item.id);
                const qty = Number(cantidadSolicitar) || 0;
                const pu = Number(precio_unitario) || 0;
                return (
                  <tr key={`${item.id}-preview`}>
                    <td className="border border-gray-300 p-2">{item.descripcion}</td>
                    <td className="border border-gray-300 p-2 text-right">{qty}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatCurrency(pu)}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatCurrency(qty * pu)}</td>
                  </tr>
                );
              })}
              {validExtraItems.map((e) => {
                const qty = Number(e.cantidad) || 0;
                const pu = Number(e.precio_unitario) || 0;
                return (
                  <tr key={`${e.id}-preview`}>
                    <td className="border border-gray-300 p-2">{e.descripcion}</td>
                    <td className="border border-gray-300 p-2 text-right">{qty}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatCurrency(pu)}</td>
                    <td className="border border-gray-300 p-2 text-right">{formatCurrency(qty * pu)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="ml-auto w-72 space-y-2">
            <div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            <div className="flex justify-between"><span>IVA</span><strong>{formatCurrency(iva)}</strong></div>
            <div className="flex justify-between border-t pt-2"><span>Total</span><strong>{formatCurrency(totalNeto)}</strong></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default GenerarOCModal;
