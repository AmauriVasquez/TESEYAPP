import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { fetchAliasPorProveedor, upsertAlias } from '@/lib/comprasExtras';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';

const TASA_IVA_OPTS = [
  { value: '16', label: '16%' },
  { value: '8', label: '8% (Frontera)' },
  { value: '0', label: '0%' },
  { value: 'exento', label: 'Exento' },
];
const FORMA_PAGO_OPTS = [
  { value: 'CONTADO', label: 'Contado' },
  { value: 'CREDITO_30', label: 'Crédito 30 días' },
  { value: 'CREDITO_60', label: 'Crédito 60 días' },
  { value: 'CREDITO_90', label: 'Crédito 90 días' },
  { value: 'PARCIALIDADES', label: 'Parcialidades' },
];

const emptyConcepto = () => ({
  id: Date.now(),
  material_id: null,
  clave: '',
  descripcion: '',
  notas: '',
  unidad: '',
  cantidad: '',
  precio_unitario: '',
  alias_proveedor: '', // nombre que el proveedor da a este material (se guarda en material_proveedor_alias)
});
const emptyParcialidad = () => ({ id: Date.now(), concepto: '', porcentaje: 0, fechaPago: '' });

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

const NuevaOCDirectaModal = ({ open, onOpenChange, onSuccess, partidasPreseleccionadas = [], datosPedido = null }) => {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const [proveedores, setProveedores] = useState([]);
  const [loadingProveedores, setLoadingProveedores] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(false);
  const [proyectos, setProyectos] = useState([]);
  const [loadingProyectos, setLoadingProyectos] = useState(false);
  const [solicitantes, setSolicitantes] = useState([]);
  const [loadingSolicitantes, setLoadingSolicitantes] = useState(false);
  const [ocForm, setOcForm] = useState(() => emptyOcForm());
  const [solicitanteId, setSolicitanteId] = useState('');
  const [saving, setSaving] = useState(false);
  const [folioPreview, setFolioPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [proyectoId, setProyectoId] = useState('');
  const [proyectoTexto, setProyectoTexto] = useState('');
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [aliasProveedor, setAliasProveedor] = useState(() => new Map()); // material_id(str) -> {nombre_proveedor, clave_proveedor}
  const [conceptos, setConceptos] = useState([emptyConcepto()]);
  const [observaciones, setObservaciones] = useState('');
  const [formaPago, setFormaPago] = useState('CONTADO');
  const [parcialidades, setParcialidades] = useState(() => [{ id: Date.now(), concepto: '', porcentaje: 100, fechaPago: '' }]);
  const [tasaIva, setTasaIva] = useState('16');
  const [ieps, setIeps] = useState('');
  const [retencionIva, setRetencionIva] = useState('');
  const [retencionIsr, setRetencionIsr] = useState('');

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

  const loadProyectos = useCallback(async () => {
    setLoadingProyectos(true);
    try {
      const { data, error } = await supabase.from('proyectos').select('id, folio, descripcion').order('folio');
      if (error) throw error;
      setProyectos(data ?? []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los proyectos.' });
      setProyectos([]);
    } finally {
      setLoadingProyectos(false);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('materiales')
        .select('id, clave, descripcion, unidad_compra')
        .not('clave', 'is', null);
      if (cancelled) return;
      if (error) {
        console.error(error);
        return;
      }
      setCatalogoMateriales(data ?? []);
    })();
    return () => { cancelled = true; };
  }, []);

  // Cargar alias del proveedor seleccionado y prellenar filas con material.
  useEffect(() => {
    if (!open || !ocForm.proveedor_id) {
      setAliasProveedor(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const map = await fetchAliasPorProveedor(ocForm.proveedor_id);
      if (cancelled) return;
      setAliasProveedor(map);
      // Prellenar alias en filas que ya tienen material (sin pisar lo tecleado).
      setConceptos((prev) =>
        prev.map((c) => {
          if (c.material_id == null) return c;
          const a = map.get(String(c.material_id));
          if (a && !((c.alias_proveedor ?? '').trim())) {
            return { ...c, alias_proveedor: a.nombre_proveedor ?? '' };
          }
          return c;
        })
      );
    })();
    return () => { cancelled = true; };
  }, [open, ocForm.proveedor_id]);

  // Inicialización solo al abrir el modal. Dependemos solo de `open` para evitar bucle
  // (partidasPreseleccionadas/datosPedido con referencias nuevas cada render crashean con #185).
  useEffect(() => {
    if (!open) return;
    const partidas = Array.isArray(partidasPreseleccionadas) ? partidasPreseleccionadas : [];
    const datos = datosPedido ?? null;
    loadProveedores();
    loadEmpresas();
    loadProyectos();
    loadCompradorAndSolicitantes();
    setOcForm({
      ...emptyOcForm(),
      empresa_id: datos?.empresa_id ? String(datos.empresa_id) : '',
      proveedor_id: String(datos?.proveedor_id ?? datos?.proveedorId ?? '') || '',
      descripcion: (datos?.descripcion_pedido ?? datos?.descripcionPedido ?? '') || '',
    });
    setSolicitanteId('');
    const pid = datos?.proyecto_id ?? null;
    setProyectoId(pid != null && pid !== '' ? String(pid) : '');
    setProyectoTexto((datos?.proyecto_texto ?? datos?.proyectoTexto ?? '') || '');
    if (partidas.length > 0) {
      setConceptos(
        partidas.map((item, index) => ({
          id: Date.now() + index,
          material_id: item.material_id ?? item.materialId ?? null,
          clave: item.clave ?? '',
          descripcion: item.descripcion ?? '',
          unidad: item.unidad ?? '',
          notas: item.notas ?? item.observaciones ?? '',
          cantidad: item.cantidad_aprobada ?? item.cantidadAprobada ?? item.cantidad ?? '',
          precio_unitario: 0,
        }))
      );
    } else {
      setConceptos([emptyConcepto()]);
    }
    setObservaciones('');
    setFormaPago('CONTADO');
    setParcialidades([{ id: Date.now(), concepto: '', porcentaje: 100, fechaPago: '' }]);
    setTasaIva('16');
    setIeps('');
    setRetencionIva('');
    setRetencionIsr('');
    setFolioPreview('');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Solo re-ejecutar al abrir; partidas/datos se leen una vez para evitar #185.
  }, [open]);

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

  const addConcepto = () => setConceptos((prev) => [...prev, emptyConcepto()]);
  const removeConcepto = (index) => setConceptos((prev) => prev.filter((_, i) => i !== index));
  const updateConcepto = (index, field, value) => {
    setConceptos((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const setConceptoMaterial = (index, material) => {
    if (!material) {
      setConceptos((prev) => prev.map((c, i) => (i === index ? { ...c, material_id: null, alias_proveedor: '' } : c)));
      return;
    }
    const alias = aliasProveedor.get(String(material.id));
    setConceptos((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              material_id: material.id,
              clave: material.clave ?? '',
              descripcion: material.descripcion ?? '',
              unidad: material.unidad_compra ?? 'SERVICIO',
              alias_proveedor: alias?.nombre_proveedor ?? '',
            }
          : c
      )
    );
  };

  const materialOptions = React.useMemo(
    () =>
      catalogoMateriales.map((m) => ({
        value: String(m.id),
        label: m.clave && m.descripcion ? `[${m.clave}] - ${m.descripcion}` : (m.clave || m.descripcion || String(m.id)),
      })),
    [catalogoMateriales]
  );

  const cantidadInputRefs = React.useRef({});

  const addParcialidad = () => setParcialidades((prev) => [...prev, emptyParcialidad()]);
  const removeParcialidad = (index) => setParcialidades((prev) => prev.filter((_, i) => i !== index));
  const updateParcialidad = (index, field, value) => {
    setParcialidades((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const sumaPorcentajes = parcialidades.reduce((acc, curr) => acc + Number(curr.porcentaje || 0), 0);

  const validConceptos = conceptos.filter(
    (c) => (c.descripcion ?? '').trim() && Number(c.cantidad) > 0 && Number(c.precio_unitario) >= 0
  );
  const subtotal = validConceptos.reduce(
    (s, c) => s + (Number(c.cantidad) || 0) * (Number(c.precio_unitario) || 0),
    0
  );
  const tasaIvaNum = tasaIva === 'exento' ? 0 : (parseFloat(tasaIva) || 0);
  const iva = subtotal * (tasaIvaNum / 100);
  const iepsNum = parseFloat(String(ieps).replace(',', '.')) || 0;
  const retencionIvaNum = parseFloat(String(retencionIva).replace(',', '.')) || 0;
  const retencionIsrNum = parseFloat(String(retencionIsr).replace(',', '.')) || 0;
  const totalNeto = subtotal + iva + iepsNum - retencionIvaNum - retencionIsrNum;
  const empresaSel = empresas.find((e) => String(e.id) === String(ocForm.empresa_id));
  const proveedorSel = proveedores.find((p) => String(p.id) === String(ocForm.proveedor_id));

  const handleSave = async () => {
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
    if (validConceptos.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Agrega al menos un concepto con descripción, cantidad y precio.' });
      return;
    }
    if (formaPago === 'PARCIALIDADES') {
      if (Math.abs(sumaPorcentajes - 100) > 0.01) {
        toast({ variant: 'destructive', title: 'Error', description: 'La suma de las parcialidades debe ser exactamente 100%.' });
        return;
      }
      const sinConcepto = parcialidades.some((p) => !(p.concepto ?? '').trim());
      if (sinConcepto) {
        toast({ variant: 'destructive', title: 'Error', description: 'Todos los conceptos / hitos de pago son obligatorios.' });
        return;
      }
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

      const rows = validConceptos.map((c) => {
        const qty = Number(c.cantidad) || 0;
        const pu = Number(c.precio_unitario) || 0;
        const alias = (c.alias_proveedor ?? '').trim();
        // Si hay alias del proveedor para un material del catálogo, se muestra como
        // descripción del item de OC (el item sigue referenciando material_id).
        const descripcion = (c.material_id != null && alias) ? alias : (c.descripcion ?? '').trim();
        return {
          material_id: c.material_id ?? null,
          clave: (c.clave ?? '').trim() || null,
          descripcion,
          notas: (c.notas ?? '').trim() || null,
          unidad: (c.unidad ?? 'SERVICIO').trim() || 'SERVICIO',
          cantidad: qty,
          precio_unitario: pu,
          importe: qty * pu,
          pedido_item_id: null,
        };
      });

      // Creación atómica: header + conceptos en UNA transacción (sin OC huérfanas).
      const { data: nuevaOC, error: rpcError } = await supabase.rpc('crear_orden_compra', {
        p_oc: insertBody,
        p_items: rows,
      });
      if (rpcError) throw rpcError;
      const ocRow = Array.isArray(nuevaOC) ? nuevaOC[0] : nuevaOC;
      const folioMostrado = ocRow?.folio ?? ocRow?.folio_oc ?? '';

      // Guardar/actualizar alias por proveedor (no bloqueante: degrada si falta la tabla).
      try {
        const aliasRows = validConceptos.filter(
          (c) => c.material_id != null && (c.alias_proveedor ?? '').trim()
        );
        await Promise.all(
          aliasRows.map((c) =>
            upsertAlias({
              materialId: c.material_id,
              proveedorId: ocForm.proveedor_id,
              nombreProveedor: c.alias_proveedor,
              claveProveedor: c.clave,
            })
          )
        );
      } catch (aliasErr) {
        console.error('No se pudieron guardar algunos alias de proveedor:', aliasErr);
      }

      toast({ title: 'OC Directa creada', description: `Folio: ${folioMostrado || '—'}. ${rows.length} concepto(s).` });
      window.setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
      }, 600);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo guardar la OC.' });
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
    if (validConceptos.length === 0) {
      toast({ variant: 'destructive', title: 'Falta información', description: 'Agrega al menos un concepto para previsualizar.' });
      return;
    }
    setShowPreview(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>+ Nueva OC</DialogTitle>
        </DialogHeader>

        <div className="space-y-0 overflow-y-auto flex-1 min-h-0">
          {/* SECCIÓN 1: Datos generales */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-4">Datos generales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Folio OC</Label>
                <Input
                  value={folioPreview}
                  readOnly
                  placeholder=""
                  title="Folio estimado, se asigna al guardar"
                  className="font-mono mt-1 bg-gray-100 text-gray-500 border border-gray-200 border-dashed cursor-not-allowed"
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
              <div>
                <Label>Proyecto</Label>
                <Select
                  value={proyectoId || '__none__'}
                  onValueChange={(v) => {
                    if (v === '__none__') {
                      setProyectoId('');
                      return;
                    }
                    setProyectoId(v);
                    const p = proyectos.find((x) => String(x.id) === v);
                    if (p) {
                      setProyectoTexto(`${p.folio ?? ''} - ${p.descripcion ?? ''}`.trim());
                    }
                  }}
                  disabled={loadingProyectos}
                >
                  <SelectTrigger><SelectValue placeholder={loadingProyectos ? 'Cargando...' : 'Sin proyecto'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin proyecto —</SelectItem>
                    {proyectos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {(p.folio ?? '') + (p.folio && p.descripcion ? ' – ' : '') + (p.descripcion ?? '')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Proyecto / Cuenta (texto)</Label>
                <Input value={proyectoTexto} onChange={(e) => setProyectoTexto(e.target.value)} placeholder="Referencia libre o cuenta (opcional)" />
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
              <div>
                <Label>Comprador</Label>
                <Input
                  value={loadingSolicitantes && !ocForm.comprador ? 'Cargando...' : (ocForm.comprador || '—')}
                  readOnly
                  disabled
                  className="mt-1 bg-gray-50 text-gray-500 cursor-not-allowed border border-gray-200"
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
                  required
                  disabled={loadingSolicitantes}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingSolicitantes ? 'Cargando usuarios...' : 'Selecciona solicitante...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {solicitantes.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.nombre_completo ?? u.id}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: Descripción del pedido */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-4">Descripción</h3>
            <Label className="sr-only">Descripción del pedido</Label>
            <Textarea
              value={ocForm.descripcion}
              onChange={(e) => setOcForm((prev) => ({ ...prev, descripcion: e.target.value }))}
              placeholder="Describe el contexto o propósito general de esta orden de compra (opcional)."
              className="w-full h-24 resize-y border-gray-300"
            />
          </div>

          {/* SECCIÓN 3: Conceptos del pedido (núcleo) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold">Conceptos del pedido</h3>
              <Button type="button" size="sm" onClick={addConcepto} className="gap-1">
                <PlusCircle className="w-4 h-4" /> Agregar fila
              </Button>
            </div>
            <div className="w-full overflow-x-auto pb-4">
              <div className="border border-gray-200 rounded-lg overflow-hidden min-w-0">
                <table className="w-full min-w-[850px] text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-2 py-3 w-[5%] text-gray-700 font-semibold whitespace-nowrap"></th>
                      <th className="text-left px-2 py-3 w-[45%] text-gray-700 font-semibold whitespace-nowrap">Descripción</th>
                      <th className="text-left px-2 py-3 w-[10%] text-gray-700 font-semibold whitespace-nowrap">Unidad</th>
                      <th className="text-right px-2 py-3 w-[10%] text-gray-700 font-semibold whitespace-nowrap">Cantidad</th>
                      <th className="text-right px-2 py-3 w-[12%] text-gray-700 font-semibold whitespace-nowrap">Precio Unit.</th>
                      <th className="text-right px-2 py-3 w-[10%] text-gray-700 font-semibold whitespace-nowrap">Importe</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-200">
                  {conceptos.map((c, idx) => (
                      <tr key={c.id ?? idx} className="hover:bg-gray-50/80 align-top">
                        <td className="px-2 py-2 align-middle w-[5%] shrink-0">
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => removeConcepto(idx)} disabled={conceptos.length <= 1}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                        <td className="px-2 py-2 w-[45%] align-top min-w-[280px] shrink-0">
                          <div className="flex flex-col gap-1.5 min-w-[280px]">
                            {c.material_id != null && !catalogoMateriales.some((m) => String(m.id) === String(c.material_id)) ? (
                              <div className="flex h-9 items-center rounded-md border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 min-w-0">
                                {[c.clave, c.descripcion].filter(Boolean).join(' - ') || `Material #${c.material_id}`}
                              </div>
                            ) : (
                              <Combobox
                                options={materialOptions}
                                value={c.material_id != null ? String(c.material_id) : ''}
                                onChange={(v) => {
                                  const m = v ? catalogoMateriales.find((mat) => String(mat.id) === v) : null;
                                  setConceptoMaterial(idx, m ?? null);
                                  if (m) setTimeout(() => cantidadInputRefs.current[idx]?.focus(), 0);
                                }}
                                placeholder="Buscar por clave o descripción..."
                                searchPlaceholder="Clave o descripción..."
                                notFoundMessage="No se encontró el material."
                                className="w-full min-w-[280px] shrink-0"
                              />
                            )}
                            <input
                              type="text"
                              value={c.notas ?? ''}
                              onChange={(e) => updateConcepto(idx, 'notas', e.target.value)}
                              placeholder="Notas de partida (ej. color, marca pref.)"
                              className="text-xs px-2 py-1.5 rounded bg-gray-100/80 border-0 focus:ring-1 focus:ring-gray-300 w-full min-w-0 placeholder:text-gray-400"
                            />
                            {c.material_id != null && (
                              <input
                                type="text"
                                value={c.alias_proveedor ?? ''}
                                onChange={(e) => updateConcepto(idx, 'alias_proveedor', e.target.value)}
                                placeholder="Nombre del proveedor para este material (alias)"
                                title="Se guarda como alias por proveedor; el catálogo de materiales no cambia."
                                className="text-xs px-2 py-1.5 rounded bg-blue-50 border border-blue-100 focus:ring-1 focus:ring-blue-300 w-full min-w-0 placeholder:text-blue-300"
                              />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 align-middle w-[10%] min-w-[100px] shrink-0">
                          <Input
                            value={c.unidad ?? ''}
                            onChange={(e) => updateConcepto(idx, 'unidad', e.target.value)}
                            readOnly={!!c.material_id}
                            placeholder="PZA"
                            className={`h-9 px-2 border-gray-300 w-full min-w-[100px] shrink-0 ${c.material_id ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-2 align-middle w-[10%] min-w-[100px] shrink-0">
                          <Input
                            ref={(el) => { cantidadInputRefs.current[idx] = el; }}
                            type="number"
                            min="0"
                            step="any"
                            value={c.cantidad}
                            onChange={(e) => updateConcepto(idx, 'cantidad', e.target.value)}
                            className="h-9 px-2 text-right border-gray-300 w-full min-w-[100px] shrink-0"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-2 align-middle w-[12%] min-w-[120px] shrink-0">
                          <Input type="number" min="0" step="0.01" value={c.precio_unitario} onChange={(e) => updateConcepto(idx, 'precio_unitario', e.target.value)} className="h-9 px-2 text-right border-gray-300 w-full min-w-[120px] shrink-0" placeholder="0.00" />
                        </td>
                        <td className="px-2 py-2 align-middle w-[10%] min-w-[100px] shrink-0 text-right text-gray-700 tabular-nums">
                          {formatCurrency((Number(c.cantidad) || 0) * (Number(c.precio_unitario) || 0))}
                        </td>
                      </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: Condiciones de pago y totales */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h3 className="text-sm uppercase tracking-wider text-gray-500 font-bold mb-4">Condiciones de pago y totales</h3>
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <Label>Observaciones</Label>
                  <Textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional" rows={3} className="mt-1 w-full border-gray-300" />
                </div>
                <div>
                  <Label>Forma de pago</Label>
                  <Select
                    value={formaPago}
                    onValueChange={(v) => {
                      if (v !== 'PARCIALIDADES') setParcialidades([{ id: Date.now(), concepto: '', porcentaje: 100, fechaPago: '' }]);
                      setFormaPago(v);
                    }}
                  >
                    <SelectTrigger className="mt-1 w-full max-w-xs border-gray-300"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FORMA_PAGO_OPTS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formaPago === 'PARCIALIDADES' && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-3">
                      {parcialidades.map((p, idx) => (
                        <div key={p.id} className="grid grid-cols-12 gap-3 items-end mb-3">
                          <div className="col-span-4">
                            <Label className="text-xs">Concepto / Hito de Pago *</Label>
                            <Input
                              value={p.concepto ?? ''}
                              onChange={(e) => updateParcialidad(idx, 'concepto', e.target.value)}
                              placeholder="Ej. Anticipo, Contra entrega"
                              className="mt-1 h-9 border-gray-300"
                              required
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Porcentaje % *</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={p.porcentaje === '' ? '' : p.porcentaje}
                              onChange={(e) => updateParcialidad(idx, 'porcentaje', e.target.value)}
                              className="mt-1 h-9 border-gray-300"
                              required
                            />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-xs">Monto</Label>
                            <div className="mt-1 h-9 px-3 flex items-center rounded-md border border-gray-200 bg-gray-100 text-sm text-gray-700">
                              {formatCurrency((totalNeto * Number(p.porcentaje || 0)) / 100)}
                            </div>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Fecha esperada</Label>
                            <DatePicker
                              value={p.fechaPago ?? ''}
                              onChange={(v) => updateParcialidad(idx, 'fechaPago', v)}
                              className="mt-1 h-9 border-gray-300"
                            />
                          </div>
                          <div className="col-span-1 flex justify-end pb-0.5">
                            {parcialidades.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                onClick={() => removeParcialidad(idx)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={addParcialidad} className="gap-1 mt-1">
                        <PlusCircle className="w-4 h-4" /> Agregar pago
                      </Button>
                      <div className={`mt-3 text-sm ${Math.abs(sumaPorcentajes - 100) < 0.01 ? 'text-gray-600' : 'text-red-600 font-bold'}`}>
                        Total programado: {sumaPorcentajes.toFixed(1)}% / 100%
                        {Math.abs(sumaPorcentajes - 100) >= 0.01 && (
                          <span className="block mt-0.5">La suma de las parcialidades debe ser exactamente 100%</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="lg:w-80 shrink-0">
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50 space-y-3">
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>Subtotal</span>
                    <strong>{formatCurrency(subtotal)}</strong>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 items-center gap-2">
                    <span>I.V.A.</span>
                    <span className="flex items-center gap-1">
                      <select value={tasaIva} onChange={(e) => setTasaIva(e.target.value)} className="h-7 rounded border border-gray-300 bg-white px-1.5 text-sm text-gray-700">
                        {TASA_IVA_OPTS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <strong>{formatCurrency(iva)}</strong>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-700">
                    <span>IEPS (+)</span>
                    <Input type="number" min="0" step="0.01" value={ieps} onChange={(e) => setIeps(e.target.value)} className="h-8 w-20 text-right border border-gray-300 text-gray-700" placeholder="0" />
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 items-center gap-2">
                    <span className="text-gray-500"><span className="text-gray-400">(-)</span> Ret. IVA</span>
                    <Input type="number" min="0" step="0.01" value={retencionIva} onChange={(e) => setRetencionIva(e.target.value)} className="h-8 w-20 text-right border border-gray-300 text-gray-700" placeholder="0" />
                  </div>
                  <div className="flex justify-between text-sm text-gray-700 items-center gap-2">
                    <span className="text-gray-500"><span className="text-gray-400">(-)</span> Ret. ISR</span>
                    <Input type="number" min="0" step="0.01" value={retencionIsr} onChange={(e) => setRetencionIsr(e.target.value)} className="h-8 w-20 text-right border border-gray-300 text-gray-700" placeholder="0" />
                  </div>
                  <div className="flex justify-between pt-3 border-t border-gray-200">
                    <span className="text-2xl font-black text-gray-900">Total neto</span>
                    <span className="text-2xl font-black text-gray-900">{formatCurrency(totalNeto)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-3 pt-4 border-t border-gray-200 flex-shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-gray-600 hover:bg-gray-100"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleOpenPreview}
            disabled={saving}
          >
            Previsualizar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !ocForm.empresa_id || !ocForm.proveedor_id || !solicitanteId || validConceptos.length === 0 || (formaPago === 'PARCIALIDADES' && Math.abs(sumaPorcentajes - 100) >= 0.01)}
            className="flex-1 min-w-[140px] bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Guardar OC
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
              {validConceptos.map((c, idx) => {
                const qty = Number(c.cantidad) || 0;
                const pu = Number(c.precio_unitario) || 0;
                return (
                  <tr key={`${c.id ?? idx}-preview`}>
                    <td className="border border-gray-300 p-2">{c.descripcion}</td>
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

export default NuevaOCDirectaModal;
