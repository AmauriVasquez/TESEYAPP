import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Trash2, Loader2, MessageSquare, ToyBrick, Cuboid, Package, Building2, Wrench, Printer, ShieldCheck, ChevronDown, FileText, Pencil } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import SeleccionarFormatoDialog from '@/components/pedidos/SeleccionarFormatoDialog';
import FormatoPedidoImpresion from '@/components/pedidos/FormatoPedidoImpresion';
import AutorizarPedidoDialog from '@/components/pedidos/AutorizarPedidoDialog';
import GenerarOCModal from '@/components/compras/GenerarOCModal';
import NuevaOCDirectaModal from '@/components/compras/NuevaOCDirectaModal';
import { recepcionarPedidoActivosSiAplica } from '@/services/recepcionarPedidoActivos';
import {
  matchUnidadIdByNombre,
  nombreUnidadPorId,
  displayUnidadPedidoItem,
  unidadImpresionPedidoItem,
} from '@/lib/pedidoMaterialesItemHelpers';

const PEDIDO_BORRADOR_STORAGE_KEY = 'tesey:pedidoMaterialesDraft:v1';
const ERROR_FIELD_ATTR = 'data-error-field';

/** Vacío o número decimal en construcción (ej. "1.", "0.25"); validar con Number al añadir/guardar. */
const CANTIDAD_DECIMAL_INPUT_RE = /^\d*\.?\d*$/;

function emptyForm() {
  return {
    solicitanteId: '',
    tipoAsociacion: 'proyecto',
    asociacionId: '',
    observacionesGenerales: '',
    estatus: 'Pendiente',
    prioridad: 'Normal',
    tipoPedido: 'material',
    categoriaMaterial: 'Materiales',
    materialSeleccionado: '',
    categoriaActivoSeleccionada: '',
    activoDescripcion: '',
    activoMarca: '',
    activoModelo: '',
    activoRequiereMantenimiento: false,
    activoRequiereResponsiva: false,
    activoUnidadId: '',
    cantidad: '',
    observaciones: '',
  };
}

/** rowId estable por fila (UUID o db-<id>); migra uniqueId legado. */
function ensureMaterialesRowIds(list) {
  if (!Array.isArray(list)) return [];
  return list.map((it) => {
    const fromRow =
      it.rowId != null && String(it.rowId).trim() !== '' ? String(it.rowId) : '';
    const fromLegacy =
      it.uniqueId != null && String(it.uniqueId).trim() !== '' ? String(it.uniqueId) : '';
    const fromDb = it.id != null ? `db-${it.id}` : '';
    const rowId = fromRow || fromLegacy || fromDb || uuidv4();
    const { uniqueId: _u, rowId: _r, ...rest } = it;
    return { ...rest, rowId };
  });
}

function itemRowKey(item) {
  return String(item.rowId ?? '');
}

function scrollToFirstError(errMap) {
  const keys = Object.keys(errMap);
  if (!keys.length) return;
  const firstKey = keys[0];
  const esc = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(firstKey) : String(firstKey).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const el = document.querySelector(`[${ERROR_FIELD_ATTR}="${esc}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/**
 * Validación pura: solo lectura del snapshot, sin mutar ítems ni el estado.
 * Claves: solicitante, asociacion, materiales, desc_<rowId>, cant_<rowId>
 */
function validatePedidoMaterialesForm(snapshot) {
  const { form, materiales, isProjectLocked, proyectoPrefijado } = snapshot;
  const solicitanteId = form.solicitanteId;
  const asociacionId = form.asociacionId;
  const tipoAsociacion = form.tipoAsociacion;
  const tipoPedido = form.tipoPedido ?? 'material';
  const out = {};
  if (!solicitanteId) {
    out.solicitante = 'Selecciona un solicitante.';
  }
  const effectiveAsociacionId = isProjectLocked
    ? asociacionId || proyectoPrefijado?.id?.toString?.() || proyectoPrefijado?.id
    : asociacionId;
  if (
    effectiveAsociacionId === '' ||
    effectiveAsociacionId === null ||
    effectiveAsociacionId === undefined
  ) {
    out.asociacion =
      tipoAsociacion === 'proyecto' ? 'Selecciona un proyecto activo.' : 'Selecciona una cuenta de gasto.';
  }
  if (materiales.length === 0) {
    out.materiales =
      tipoPedido === 'activo' ? 'Agrega al menos una línea de activo al pedido.' : 'Agrega al menos un material al pedido.';
  }
  materiales.forEach((item) => {
    const k = itemRowKey(item);
    if (!k) return;
    const desc = (item.descripcion ?? '').toString().trim();
    if (tipoPedido === 'activo') {
      const cid = item.categoria_id;
      if (cid === null || cid === undefined || cid === '') {
        out[`desc_${k}`] = 'Selecciona una categoría de activo.';
      }
      if (!desc) {
        out[`desc_${k}`] = 'Descripción del activo obligatoria.';
      }
      const uid = item.unidad_id;
      if (uid === null || uid === undefined || uid === '') {
        out[`unidad_${k}`] = 'Selecciona una unidad de catálogo.';
      }
    } else {
      const mid = item.material_id;
      if ((mid === null || mid === undefined || mid === '') && !desc) {
        out[`desc_${k}`] = 'Material o descripción requerido.';
      }
    }
    const q = item.cantidad;
    const qn = q === null || q === undefined || q === '' ? NaN : Number(q);
    if (Number.isNaN(qn) || qn <= 0) {
      out[`cant_${k}`] = 'La cantidad debe ser mayor que cero.';
    }
    if (tipoPedido === 'activo' && Number.isFinite(qn) && Math.floor(qn) !== qn) {
      out[`cant_${k}`] = 'En pedidos de activos la cantidad debe ser un número entero (unidades a generar).';
    }
  });
  return out;
}

/** Fila de tabla (no edición expandida): memoizada para evitar remount al validar. */
const PedidoMaterialDisplayRow = React.memo(function PedidoMaterialDisplayRow({
  item,
  itemKey,
  descError,
  cantError,
  unidadError,
  seleccionable,
  hasOC,
  checked,
  togglePartida,
  onStartEdit,
  onRemove,
}) {
  return (
    <tr className={cn('hover:bg-gray-50', !seleccionable && 'bg-gray-50/60')}>
      <td className="px-2 py-3 text-center align-middle">
        <input
          type="checkbox"
          checked={checked}
          disabled={!seleccionable}
          onChange={(e) => {
            if (!seleccionable) return;
            togglePartida(itemKey, e.target.checked);
          }}
          className={cn(
            'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
            seleccionable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
          )}
          aria-label={seleccionable ? `Seleccionar partida: ${item.descripcion ?? ''}` : 'Partida con OC asignada'}
        />
      </td>
      <td
        className={cn('px-4 py-3 min-w-[200px]', descError && 'error-field rounded-md')}
        {...{ [ERROR_FIELD_ATTR]: `desc_${itemKey}` }}
      >
        <div className="font-medium break-words">{item.descripcion ?? ''}</div>
        {item.marca || item.modelo ? (
          <div className="text-xs text-indigo-700 mt-1">
            {item.marca ? `Marca: ${item.marca}` : ''}
            {item.marca && item.modelo ? ' · ' : ''}
            {item.modelo ? `Modelo: ${item.modelo}` : ''}
          </div>
        ) : null}
        {item.requiere_mantenimiento || item.requiere_responsiva ? (
          <div className="text-xs text-gray-500 mt-1">
            {item.requiere_mantenimiento ? 'Req. mantenimiento' : ''}
            {item.requiere_mantenimiento && item.requiere_responsiva ? ' · ' : ''}
            {item.requiere_responsiva ? 'Req. responsiva' : ''}
          </div>
        ) : null}
        {item.observaciones ? (
          <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
            <MessageSquare className="w-3 h-3" /> {item.observaciones}
          </div>
        ) : null}
      </td>
      <td
        className={cn('px-2 py-3 text-center', (cantError || unidadError) && 'error-field rounded-md')}
        {...{ [ERROR_FIELD_ATTR]: `cant_${itemKey}` }}
      >
        <span className={cn('font-mono font-medium', cantError && 'text-red-600')}>{item.cantidad ?? ''}</span>
        <span className={cn('text-xs text-gray-500 ml-1', unidadError && 'text-red-600 font-medium')}>
          {displayUnidadPedidoItem(item) || 'N/A'}
        </span>
      </td>
      <td className="px-2 py-3">
        {hasOC ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
              (item.oc_estatus === 'Pendiente de Validación' || item.oc_estatus === 'Pendiente validación') &&
                'bg-amber-100 text-amber-800',
              (item.oc_estatus === 'Pendiente de Pago' || item.oc_estatus === 'Pendiente pago') &&
                'bg-orange-100 text-orange-800',
              (item.oc_estatus === 'Pendiente de Entrega' || item.oc_estatus === 'Pendiente entrega') &&
                'bg-blue-100 text-blue-800',
              (!item.oc_estatus ||
                ![
                  'Pendiente de Validación',
                  'Pendiente validación',
                  'Pendiente de Pago',
                  'Pendiente pago',
                  'Pendiente de Entrega',
                  'Pendiente entrega',
                ].some((s) => (item.oc_estatus || '').includes(s))) &&
                'bg-gray-100 text-gray-700'
            )}
          >
            {item.oc_folio ?? 'OC'} {item.oc_estatus ? ` · ${item.oc_estatus}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
            Pendiente de OC
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-600" onClick={() => onStartEdit(item)} title="Editar">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => onRemove(itemKey)} title="Eliminar">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
});

const NuevoPedidoDialog = ({
  open: openProp = false,
  visible,
  onOpenChange,
  onSave,
  pedidoGuardado,
  proyecto: proyectoPrefijado,
  onPedidoUpdated,
}) => {
  const isOpen = typeof visible === 'boolean' ? visible : openProp;
  const { toast } = useToast();
  const { user } = useAuth();

  const [form, setForm] = useState(emptyForm);
  const [materiales, setMateriales] = useState([]);
  const [errors, setErrors] = useState({});
  const [showConfirmClose, setShowConfirmClose] = useState(false);

  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preselectedFormat, setPreselectedFormat] = useState(null);

  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // State for format selection dialog
  const [showFormatSelection, setShowFormatSelection] = useState(false);
  const [showImpresionPedido, setShowImpresionPedido] = useState(false);
  const [currentPedidoData, setCurrentPedidoData] = useState(null);
  const [editingItemKey, setEditingItemKey] = useState(null);
  const [editItemForm, setEditItemForm] = useState({
    cantidad: '',
    material_id: '',
    categoria_id: '',
    unidad_id: '',
    descripcion: '',
    marca: '',
    modelo: '',
    requiere_mantenimiento: false,
    requiere_responsiva: false,
    observaciones: '',
  });
  const [showGenerarOC, setShowGenerarOC] = useState(false);
  const [showNuevaOCDesdePedido, setShowNuevaOCDesdePedido] = useState(false);
  const [partidasSeleccionadas, setPartidasSeleccionadas] = useState([]);

  const [usuarios, setUsuarios] = useState([]);
  const [proyectosActivos, setProyectosActivos] = useState([]);
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [categoriasActivosPedido, setCategoriasActivosPedido] = useState([]);
  const [catalogoUnidadesPedido, setCatalogoUnidadesPedido] = useState([]);

  const defaultUnidadActivoId = useMemo(() => {
    const arr = catalogoUnidadesPedido;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const pza = arr.find((u) => {
      const n = (u.nombre ?? '').toString().trim().toUpperCase();
      return n === 'PZA' || n === 'PZ' || n.includes('PIEZA');
    });
    return (pza ?? arr[0])?.id ?? null;
  }, [catalogoUnidadesPedido]);

  useEffect(() => {
    if ((form.tipoPedido ?? 'material') !== 'activo') return;
    if (!catalogoUnidadesPedido.length || defaultUnidadActivoId == null) return;
    setForm((f) => {
      if (f.activoUnidadId && catalogoUnidadesPedido.some((u) => String(u.id) === String(f.activoUnidadId))) {
        return f;
      }
      return { ...f, activoUnidadId: String(defaultUnidadActivoId) };
    });
  }, [form.tipoPedido, catalogoUnidadesPedido, defaultUnidadActivoId]);

  const statusOptions = [
    'Pendiente',
    'Autorizado',
    'Pago Pendiente',
    'Recolección Pendiente',
    'Entrega Pendiente',
    'Entregado'
  ];

  const itemStatusOptions = ['Pendiente', 'En Proceso', 'Entregado'];

  const isProjectLocked = !!proyectoPrefijado;
  const isEditing = !!pedidoGuardado?.id;
  const isCloneMode = !!pedidoGuardado && !pedidoGuardado.id;

  const proyectoPrefijadoId = proyectoPrefijado?.id;
  const proyectoPrefRef = useRef(proyectoPrefijado);
  proyectoPrefRef.current = proyectoPrefijado;

  const lastOpenRef = useRef(false);
  const lastPedidoKeyRef = useRef(null);
  const suppressDraftSaveUntilRef = useRef(0);
  const dialogWasOpenForFetchRef = useRef(false);

  /** Catálogo / usuarios / proyectos: deps estables (evita setLoading en cada render si cambia la ref de `proyecto`). */
  useEffect(() => {
    if (!isOpen) {
      dialogWasOpenForFetchRef.current = false;
      return;
    }
    const justOpened = !dialogWasOpenForFetchRef.current;
    dialogWasOpenForFetchRef.current = true;
    let cancelled = false;
    (async () => {
      if (justOpened) setLoading(true);
      try {
        const promises = [
          supabase.from('materiales').select('id, descripcion, unidad_compra, categoria'),
          supabase.from('usuarios').select('id, nombre_completo'),
          supabase.from('categorias_activos').select('id, nombre, descripcion').order('nombre', { ascending: true }),
          supabase.from('catalogo_unidades').select('id, nombre').order('nombre', { ascending: true }),
        ];
        if (!isProjectLocked) {
          promises.push(
            supabase.from('proyectos').select('id, folio, descripcion, cotizacion_folio').not('estatus', 'in', '("Terminado","Entregado","Cancelado")')
          );
        }
        const results = await Promise.all(promises);
        const materialesRes = results[0];
        const usersRes = results[1];
        const categoriasActivosRes = results[2];
        const unidadesRes = results[3];
        const proyectosRes = !isProjectLocked ? results[4] : null;

        if (cancelled) return;
        if (materialesRes.error) throw materialesRes.error;
        setCatalogoMateriales(materialesRes.data || []);

        if (usersRes.error) throw usersRes.error;
        setUsuarios(usersRes.data || []);

        if (categoriasActivosRes.error) {
          console.error('categorias_activos (pedido):', categoriasActivosRes.error.message, categoriasActivosRes.error);
          setCategoriasActivosPedido([]);
        } else {
          console.log('categorias:', categoriasActivosRes.data);
          setCategoriasActivosPedido(categoriasActivosRes.data || []);
        }

        if (unidadesRes.error) {
          console.error('catalogo_unidades (pedido):', unidadesRes.error.message, unidadesRes.error);
          setCatalogoUnidadesPedido([]);
        } else {
          setCatalogoUnidadesPedido(unidadesRes.data || []);
        }

        if (!isProjectLocked) {
          if (proyectosRes.error) throw proyectosRes.error;
          setProyectosActivos(proyectosRes.data || []);
        } else {
          const pref = proyectoPrefRef.current;
          if (pref) setProyectosActivos([pref]);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error fetching data:', error);
          toast({
            variant: 'destructive',
            title: 'Error de conexión',
            description: 'No se pudo cargar la información necesaria. Verifique su conexión o configuración.',
          });
        }
      } finally {
        if (!cancelled && justOpened) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isProjectLocked, proyectoPrefijadoId, toast]);

  const mapItemsFromPedidoGuardado = useCallback((pg) => {
    if (!pg) return [];
    const tipoP = pg.tipo_pedido ?? 'material';
    const unitLabel = (i) => {
      const fromEmb = i.catalogo_unidades?.nombre;
      const fromId = nombreUnidadPorId(catalogoUnidadesPedido, i.unidad_id);
      const legacy = (i.unidad ?? '').toString().trim();
      const mat = i.materiales?.unidad_compra ?? i.material?.unidad_compra;
      return (fromEmb || fromId || legacy || mat || '').toString().trim();
    };
    if (pg.pedidos_materiales_items) {
      return ensureMaterialesRowIds(
        (pg.pedidos_materiales_items ?? []).map((i) => ({
          id: i.id,
          material_id: i.material_id,
          categoria_id: i.categoria_id ?? null,
          unidad_id: i.unidad_id ?? null,
          marca: i.marca ?? '',
          modelo: i.modelo ?? '',
          requiere_mantenimiento: i.requiere_mantenimiento ?? false,
          requiere_responsiva: i.requiere_responsiva ?? false,
          descripcion:
            tipoP === 'activo'
              ? (i.descripcion ?? 'Sin descripción')
              : (i.materiales?.descripcion ?? i.descripcion ?? 'Material'),
          cantidad: i.cantidad,
          unidad: unitLabel(i),
          observaciones: i.observaciones ?? '',
          orden_compra_id: i.orden_compra_id ?? null,
          precio_unitario: i.precio_unitario ?? null,
          oc_folio: i.ordenes_compra?.folio_oc ?? null,
          oc_estatus: i.ordenes_compra?.estatus ?? null,
        }))
      );
    }
    if (pg.items) {
      return ensureMaterialesRowIds(
        (pg.items ?? []).map((i) => ({
          id: i.id,
          uniqueId: i.uniqueId,
          material_id: i.material_id,
          categoria_id: i.categoria_id ?? null,
          unidad_id: i.unidad_id ?? null,
          marca: i.marca ?? '',
          modelo: i.modelo ?? '',
          requiere_mantenimiento: i.requiere_mantenimiento ?? false,
          requiere_responsiva: i.requiere_responsiva ?? false,
          descripcion:
            tipoP === 'activo'
              ? (i.descripcion ?? 'Sin descripción')
              : (i.materiales?.descripcion ?? i.material?.descripcion ?? i.descripcion ?? 'Material'),
          cantidad: i.cantidad,
          unidad: unitLabel(i),
          observaciones: i.observaciones ?? '',
          orden_compra_id: i.orden_compra_id ?? null,
          precio_unitario: i.precio_unitario ?? null,
          oc_folio: i.ordenes_compra?.folio_oc ?? i.oc_folio ?? null,
          oc_estatus: i.ordenes_compra?.estatus ?? i.oc_estatus ?? null,
        }))
      );
    }
    return [];
  }, [catalogoUnidadesPedido]);

  useEffect(() => {
    if (!isOpen) {
      lastOpenRef.current = false;
      lastPedidoKeyRef.current = null;
      return;
    }

    const pedidoKey =
      pedidoGuardado?.id != null ? `id:${pedidoGuardado.id}` : pedidoGuardado ? 'clone' : 'new';

    const justOpened = !lastOpenRef.current;
    lastOpenRef.current = true;

    const pedidoChanged = lastPedidoKeyRef.current !== pedidoKey;
    const shouldInit = justOpened || pedidoChanged;

    if (!shouldInit) return;

    lastPedidoKeyRef.current = pedidoKey;
    setErrors({});
    setShowConfirmClose(false);

    if (!pedidoGuardado) {
      setCurrentPedidoData(null);

      let draftForm = null;
      let initialMateriales = [];
      try {
        const raw = localStorage.getItem(PEDIDO_BORRADOR_STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d && typeof d === 'object') {
            if (d.form && typeof d.form === 'object') {
              draftForm = { ...emptyForm(), ...d.form };
              if (Array.isArray(d.materiales) && d.materiales.length > 0) {
                initialMateriales = ensureMaterialesRowIds(d.materiales);
              }
            } else {
              draftForm = {
                ...emptyForm(),
                solicitanteId: d.solicitanteId != null ? String(d.solicitanteId) : '',
                tipoAsociacion: d.tipoAsociacion === 'cuenta' ? 'cuenta' : 'proyecto',
                asociacionId: d.asociacionId != null ? String(d.asociacionId) : '',
                observacionesGenerales: typeof d.observacionesGenerales === 'string' ? d.observacionesGenerales : '',
                estatus: typeof d.estatus === 'string' ? d.estatus : 'Pendiente',
                prioridad: typeof d.prioridad === 'string' ? d.prioridad : 'Normal',
                tipoPedido: d.tipoPedido === 'activo' ? 'activo' : 'material',
                categoriaMaterial: typeof d.categoriaMaterial === 'string' ? d.categoriaMaterial : 'Materiales',
              };
              if (Array.isArray(d.items) && d.items.length > 0) {
                initialMateriales = ensureMaterialesRowIds(d.items);
              }
            }
          }
        }
      } catch {
        /* ignore borrador corrupto */
      }

      const base = draftForm ?? emptyForm();
      const locked = isProjectLocked && proyectoPrefijadoId != null;
      setForm({
        ...emptyForm(),
        ...base,
        solicitanteId: base.solicitanteId || user?.id || '',
        tipoAsociacion: locked ? 'proyecto' : base.tipoAsociacion,
        asociacionId: locked ? String(proyectoPrefijadoId) : base.asociacionId,
        materialSeleccionado: '',
        categoriaActivoSeleccionada: '',
        activoDescripcion: '',
        activoMarca: '',
        activoModelo: '',
        activoRequiereMantenimiento: false,
        activoRequiereResponsiva: false,
        activoUnidadId: '',
        cantidad: '',
        observaciones: '',
      });
      setMateriales(initialMateriales);
    } else {
      const loadedItems = mapItemsFromPedidoGuardado(pedidoGuardado);
      setForm({
        ...emptyForm(),
        solicitanteId: pedidoGuardado.solicitante_id ?? '',
        tipoAsociacion: pedidoGuardado.proyecto_id ? 'proyecto' : 'cuenta',
        asociacionId:
          pedidoGuardado.proyecto_id != null ? String(pedidoGuardado.proyecto_id) : (pedidoGuardado.cuenta ?? ''),
        observacionesGenerales: pedidoGuardado.observaciones ?? '',
        estatus: pedidoGuardado.estatus ?? 'Pendiente',
        prioridad: pedidoGuardado.prioridad ?? 'Normal',
        tipoPedido: pedidoGuardado.tipo_pedido === 'activo' ? 'activo' : 'material',
        categoriaMaterial: 'Materiales',
        materialSeleccionado: '',
        categoriaActivoSeleccionada: '',
        activoDescripcion: '',
        activoMarca: '',
        activoModelo: '',
        activoRequiereMantenimiento: false,
        activoRequiereResponsiva: false,
        activoUnidadId: '',
        cantidad: '',
        observaciones: '',
      });
      setMateriales(loadedItems);
      setCurrentPedidoData({
        ...pedidoGuardado,
        items: loadedItems,
        pedido_activos: [],
      });
    }
  }, [isOpen, pedidoGuardado, user?.id, isProjectLocked, proyectoPrefijadoId, mapItemsFromPedidoGuardado]);

  const clearPedidoDraft = useCallback(() => {
    try {
      localStorage.removeItem(PEDIDO_BORRADOR_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isOpen || pedidoGuardado?.id) return;
    if (Date.now() < suppressDraftSaveUntilRef.current) return;
    try {
      localStorage.setItem(
        PEDIDO_BORRADOR_STORAGE_KEY,
        JSON.stringify({
          form,
          materiales,
        })
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [isOpen, pedidoGuardado?.id, form, materiales]);

  const formHasProtectableData = useMemo(() => {
    if (!isOpen) return false;
    if (materiales.length > 0) return true;
    if (String(form.observacionesGenerales || '').trim() !== '') return true;
    if (String(form.asociacionId || '').trim() !== '') return true;
    if (
      String(form.materialSeleccionado || '').trim() !== '' ||
      String(form.categoriaActivoSeleccionada || '').trim() !== '' ||
      String(form.activoDescripcion || '').trim() !== '' ||
      String(form.activoMarca || '').trim() !== '' ||
      String(form.activoModelo || '').trim() !== '' ||
      String(form.activoUnidadId || '').trim() !== '' ||
      String(form.cantidad || '').trim() !== ''
    )
      return true;
    return false;
  }, [
    isOpen,
    materiales.length,
    form.observacionesGenerales,
    form.asociacionId,
    form.materialSeleccionado,
    form.categoriaActivoSeleccionada,
    form.activoDescripcion,
    form.activoMarca,
    form.activoModelo,
    form.activoUnidadId,
    form.cantidad,
  ]);

  const formHasData = useCallback(() => {
    return (
      materiales.length > 0 ||
      String(form.asociacionId || '').trim() !== '' ||
      String(form.observacionesGenerales || '').trim() !== '' ||
      String(form.materialSeleccionado || '').trim() !== '' ||
      String(form.categoriaActivoSeleccionada || '').trim() !== '' ||
      String(form.activoDescripcion || '').trim() !== '' ||
      String(form.activoMarca || '').trim() !== '' ||
      String(form.activoModelo || '').trim() !== '' ||
      String(form.activoUnidadId || '').trim() !== '' ||
      String(form.cantidad || '').trim() !== '' ||
      String(form.observaciones || '').trim() !== ''
    );
  }, [form, materiales.length]);

  const handleDialogOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) {
        if (showConfirmClose) return;
        if (isSaving) return;
        if (formHasData()) {
          setShowConfirmClose(true);
          return;
        }
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, showConfirmClose, isSaving, formHasData]
  );

  useEffect(() => {
    if (!isOpen || catalogoUnidadesPedido.length === 0) return;
    setMateriales((prev) => {
      if (!prev.length) return prev;
      let changed = false;
      const next = prev.map((row) => {
        const uid = row.unidad_id;
        if (uid == null || uid === '') return row;
        const name = nombreUnidadPorId(catalogoUnidadesPedido, uid);
        if (!name || row.unidad === name) return row;
        changed = true;
        return { ...row, unidad: name };
      });
      return changed ? next : prev;
    });
  }, [isOpen, catalogoUnidadesPedido]);

  const confirmDiscardAndClose = useCallback(() => {
    setShowConfirmClose(false);
    setForm(emptyForm());
    setMateriales([]);
    setErrors({});
    setPartidasSeleccionadas([]);
    setEditingItemKey(null);
    setEditItemForm({
      cantidad: '',
      material_id: '',
      categoria_id: '',
      unidad_id: '',
      descripcion: '',
      marca: '',
      modelo: '',
      requiere_mantenimiento: false,
      requiere_responsiva: false,
      observaciones: '',
    });
    clearPedidoDraft();
    onOpenChange(false);
  }, [clearPedidoDraft, onOpenChange]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!formHasProtectableData) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [formHasProtectableData]);

  const togglePartidaSeleccionada = useCallback((itemKey, checked) => {
    setPartidasSeleccionadas((prev) =>
      checked ? (prev.includes(itemKey) ? prev : [...prev, itemKey]) : prev.filter((id) => id !== itemKey)
    );
  }, []);

  const handleAddItem = useCallback(() => {
    const tipoPedido = form.tipoPedido ?? 'material';
    const raw = form.cantidad;
    const qty =
      raw === '' || raw == null || String(raw).trim() === ''
        ? NaN
        : Number(String(raw).replace(',', '.'));
    const newErrors = {};
    if (Number.isNaN(qty) || qty <= 0) {
      newErrors.cantidad = 'Ingresa una cantidad válida.';
    }

    if (tipoPedido === 'activo') {
      const activoDescripcion = String(form.activoDescripcion ?? '').trim();
      if (!form.categoriaActivoSeleccionada) {
        newErrors.material = 'Selecciona una categoría de activo.';
      }
      if (!activoDescripcion) {
        newErrors.descripcionActivo = 'La descripción del activo es obligatoria.';
      }
      if (catalogoUnidadesPedido.length === 0) {
        newErrors.unidadActivo = 'No hay unidades en el catálogo.';
      } else if (!form.activoUnidadId || String(form.activoUnidadId).trim() === '') {
        newErrors.unidadActivo = 'Selecciona una unidad.';
      } else if (!catalogoUnidadesPedido.some((u) => String(u.id) === String(form.activoUnidadId))) {
        newErrors.unidadActivo = 'La unidad seleccionada no es válida.';
      }
      if (Number.isFinite(qty) && Math.floor(qty) !== qty) {
        newErrors.cantidad = 'La cantidad debe ser un número entero (unidades a generar al recepcionar).';
      }
      if (Object.keys(newErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...newErrors }));
        return;
      }
      const cat = categoriasActivosPedido.find((c) => c.id?.toString() === form.categoriaActivoSeleccionada);
      if (!cat) {
        setErrors((prev) => ({ ...prev, material: 'Activo no encontrado en el catálogo.' }));
        return;
      }
      const uidAct = Number.parseInt(String(form.activoUnidadId), 10);
      if (!Number.isFinite(uidAct) || uidAct <= 0) {
        setErrors((prev) => ({ ...prev, unidadActivo: 'Selecciona una unidad válida.' }));
        return;
      }
      const newItem = {
        rowId: uuidv4(),
        id: null,
        material_id: null,
        categoria_id: cat.id,
        marca: String(form.activoMarca ?? '').trim().toUpperCase(),
        modelo: String(form.activoModelo ?? '').trim().toUpperCase(),
        requiere_mantenimiento: form.activoRequiereMantenimiento === true,
        requiere_responsiva: form.activoRequiereResponsiva === true,
        descripcion: activoDescripcion,
        cantidad: qty,
        unidad_id: uidAct,
        unidad: nombreUnidadPorId(catalogoUnidadesPedido, uidAct) || '',
        observaciones: form.observaciones ?? '',
        orden_compra_id: null,
        precio_unitario: null,
        oc_folio: null,
        oc_estatus: null,
      };
      setMateriales((prev) => [...prev, newItem]);
      setErrors((e) => {
        const n = { ...e };
        delete n.materiales;
        delete n.material;
        delete n.descripcionActivo;
        delete n.unidadActivo;
        delete n.cantidad;
        return n;
      });
      setForm((f) => ({
        ...f,
        categoriaActivoSeleccionada: '',
        activoDescripcion: '',
        activoMarca: '',
        activoModelo: '',
        activoRequiereMantenimiento: false,
        activoRequiereResponsiva: false,
        activoUnidadId: defaultUnidadActivoId != null ? String(defaultUnidadActivoId) : '',
        cantidad: '',
        observaciones: '',
      }));
      return;
    }

    if (!form.materialSeleccionado) {
      newErrors.material = 'Selecciona un material.';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
      return;
    }

    const material = catalogoMateriales.find((m) => m.id?.toString() === form.materialSeleccionado);
    if (!material) {
      setErrors((prev) => ({ ...prev, material: 'Material no encontrado en el catálogo.' }));
      return;
    }

    const uidMat = matchUnidadIdByNombre(catalogoUnidadesPedido, material.unidad_compra);
    const newItem = {
      rowId: uuidv4(),
      id: null,
      material_id: material.id,
      categoria_id: null,
      marca: '',
      modelo: '',
      requiere_mantenimiento: false,
      requiere_responsiva: false,
      descripcion: material.descripcion ?? 'Material',
      cantidad: qty,
      unidad_id: uidMat,
      unidad: nombreUnidadPorId(catalogoUnidadesPedido, uidMat) || (material.unidad_compra ?? ''),
      observaciones: form.observaciones ?? '',
      orden_compra_id: null,
      precio_unitario: null,
      oc_folio: null,
      oc_estatus: null,
    };

    setMateriales((prev) => [...prev, newItem]);
    setErrors((e) => {
      const n = { ...e };
      delete n.materiales;
      delete n.material;
      delete n.cantidad;
      return n;
    });
    setForm((f) => ({ ...f, materialSeleccionado: '', cantidad: '', observaciones: '' }));
  }, [form, catalogoMateriales, categoriasActivosPedido, catalogoUnidadesPedido, defaultUnidadActivoId]);

  const handleRemoveItem = useCallback((rowKey) => {
    setMateriales((prev) => prev.filter((item) => itemRowKey(item) !== rowKey));
  }, []);

  const getItemKey = useCallback((item) => itemRowKey(item), []);

  useEffect(() => {
    setPartidasSeleccionadas((prev) => {
      const next = prev.filter((id) => materiales.some((it) => getItemKey(it) === id));
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [materiales, getItemKey]);

  const handleItemChange = useCallback(
    async (itemKey, field, value) => {
      let currentItem = null;
      setMateriales((prev) =>
        prev.map((i) => {
          if (getItemKey(i) !== itemKey) return i;
          currentItem = { ...i, [field]: value };
          return currentItem;
        })
      );
      if (!currentItem) return;

      if (isEditing && currentItem.id) {
        try {
          const { error } = await supabase.from('pedidos_materiales_items').update({ [field]: value }).eq('id', currentItem.id);
          if (error) throw error;
          onPedidoUpdated?.();
        } catch (err) {
          console.error('Error en handleItemChange:', err);
          toast({ variant: 'destructive', title: 'Error al guardar', description: 'No se pudo guardar el cambio.' });
        }
      }
    },
    [isEditing, getItemKey, onPedidoUpdated, toast]
  );

  const handleItemBlur = useCallback((itemKey, field, value) => {
    handleItemChange(itemKey, field, value);
  }, [handleItemChange]);

  const handleStartEditItem = useCallback((item) => {
    const key = getItemKey(item);
    setEditingItemKey(key);
    setEditItemForm({
      cantidad: String(item.cantidad ?? ''),
      material_id: String(item.material_id ?? ''),
      categoria_id: String(item.categoria_id ?? ''),
      unidad_id: item.unidad_id != null && item.unidad_id !== '' ? String(item.unidad_id) : '',
      descripcion: String(item.descripcion ?? ''),
      marca: String(item.marca ?? ''),
      modelo: String(item.modelo ?? ''),
      requiere_mantenimiento: item.requiere_mantenimiento === true,
      requiere_responsiva: item.requiere_responsiva === true,
      observaciones: item.observaciones ?? ''
    });
  }, [getItemKey]);

  const handleCancelEditItem = useCallback(() => {
    setEditingItemKey(null);
    setEditItemForm({
      cantidad: '',
      material_id: '',
      categoria_id: '',
      unidad_id: '',
      descripcion: '',
      marca: '',
      modelo: '',
      requiere_mantenimiento: false,
      requiere_responsiva: false,
      observaciones: '',
    });
  }, []);

  const handleSaveEditItem = useCallback(async () => {
    if (!editingItemKey) return;
    const item = materiales.find((i) => getItemKey(i) === editingItemKey);
    if (!item) {
      handleCancelEditItem();
      return;
    }
    const tipoPedido = form.tipoPedido ?? 'material';
    const cantidadNum = parseFloat(editItemForm.cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Cantidad inválida.' });
      return;
    }
    if (tipoPedido === 'activo' && Math.floor(cantidadNum) !== cantidadNum) {
      toast({ variant: 'destructive', title: 'Error', description: 'La cantidad debe ser un número entero.' });
      return;
    }

    if (tipoPedido === 'activo') {
      const descripcion = String(editItemForm.descripcion ?? '').trim();
      const cat = categoriasActivosPedido.find((c) => c.id?.toString() === editItemForm.categoria_id);
      if (!cat) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una categoría de activo.' });
        return;
      }
      if (!descripcion) {
        toast({ variant: 'destructive', title: 'Error', description: 'La descripción del activo es obligatoria.' });
        return;
      }
      const uidEdit = Number.parseInt(String(editItemForm.unidad_id ?? ''), 10);
      if (!Number.isFinite(uidEdit) || uidEdit <= 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Selecciona una unidad válida.' });
        return;
      }
      if (!catalogoUnidadesPedido.some((u) => String(u.id) === String(uidEdit))) {
        toast({ variant: 'destructive', title: 'Error', description: 'La unidad seleccionada no es válida.' });
        return;
      }
      setMateriales((prev) =>
        prev.map((i) =>
          getItemKey(i) === editingItemKey
            ? {
                ...i,
                cantidad: cantidadNum,
                material_id: null,
                categoria_id: cat.id,
                marca: String(editItemForm.marca ?? '').trim().toUpperCase(),
                modelo: String(editItemForm.modelo ?? '').trim().toUpperCase(),
                requiere_mantenimiento: editItemForm.requiere_mantenimiento === true,
                requiere_responsiva: editItemForm.requiere_responsiva === true,
                descripcion,
                unidad_id: uidEdit,
                unidad: nombreUnidadPorId(catalogoUnidadesPedido, uidEdit) || displayUnidadPedidoItem(i) || '',
                observaciones: editItemForm.observaciones?.trim() ?? '',
              }
            : i
        )
      );
      setErrors((e) => {
        const n = { ...e };
        delete n[`desc_${editingItemKey}`];
        delete n[`cant_${editingItemKey}`];
        delete n[`unidad_${editingItemKey}`];
        return n;
      });
      if (item.id) {
        try {
          const { error } = await supabase.from('pedidos_materiales_items').update({
            cantidad: cantidadNum,
            material_id: null,
            categoria_id: cat.id,
            descripcion,
            unidad_id: uidEdit,
            marca: String(editItemForm.marca ?? '').trim().toUpperCase() || null,
            modelo: String(editItemForm.modelo ?? '').trim().toUpperCase() || null,
            requiere_mantenimiento: editItemForm.requiere_mantenimiento === true,
            requiere_responsiva: editItemForm.requiere_responsiva === true,
            observaciones: editItemForm.observaciones?.trim() || null,
          }).eq('id', item.id);
          if (error) throw error;
          toast({ title: 'Partida actualizada', description: 'Cambios guardados.', duration: 2000 });
          onPedidoUpdated?.();
        } catch (err) {
          console.error('Error en handleSaveEditItem:', err);
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la partida.' });
        }
      }
      handleCancelEditItem();
      return;
    }

    const material = catalogoMateriales.find((m) => m.id?.toString() === editItemForm.material_id);
    if (!material) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un material.' });
      return;
    }
    const uidMat = matchUnidadIdByNombre(catalogoUnidadesPedido, material.unidad_compra);
    setMateriales((prev) =>
      prev.map((i) =>
        getItemKey(i) === editingItemKey
          ? {
              ...i,
              cantidad: cantidadNum,
              material_id: material.id,
              categoria_id: null,
              marca: '',
              modelo: '',
              requiere_mantenimiento: false,
              requiere_responsiva: false,
              descripcion: material.descripcion ?? 'Material',
              unidad_id: uidMat,
              unidad: nombreUnidadPorId(catalogoUnidadesPedido, uidMat) || (material.unidad_compra ?? ''),
              observaciones: editItemForm.observaciones?.trim() ?? '',
            }
          : i
      )
    );
    setErrors((e) => {
      const n = { ...e };
      delete n[`desc_${editingItemKey}`];
      delete n[`cant_${editingItemKey}`];
      return n;
    });
    if (item.id) {
      try {
        const { error } = await supabase.from('pedidos_materiales_items').update({
          cantidad: cantidadNum,
          material_id: material.id,
          categoria_id: null,
          unidad_id: uidMat,
          marca: null,
          modelo: null,
          requiere_mantenimiento: null,
          requiere_responsiva: null,
          observaciones: editItemForm.observaciones?.trim() || null
        }).eq('id', item.id);
        if (error) throw error;
        toast({ title: 'Partida actualizada', description: 'Cambios guardados.', duration: 2000 });
        onPedidoUpdated?.();
      } catch (err) {
        console.error('Error en handleSaveEditItem:', err);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar la partida.' });
      }
    }
    handleCancelEditItem();
  }, [editingItemKey, editItemForm, materiales, getItemKey, catalogoMateriales, categoriasActivosPedido, catalogoUnidadesPedido, defaultUnidadActivoId, form.tipoPedido, toast, onPedidoUpdated, handleCancelEditItem]);

  const handleSave = async () => {
    const nextErrors = validatePedidoMaterialesForm({
      form,
      materiales,
      isProjectLocked,
      proyectoPrefijado,
    });
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      queueMicrotask(() => scrollToFirstError(nextErrors));
      return;
    }
    setErrors({});

    const effectiveAsociacionId = isProjectLocked
      ? form.asociacionId || proyectoPrefijado?.id?.toString?.() || proyectoPrefijado?.id
      : form.asociacionId;

    setIsSaving(true);
    try {
      const savedPedido = await onSave({
        solicitante_id: form.solicitanteId,
        tipo: form.tipoAsociacion,
        asociacionId: effectiveAsociacionId,
        observaciones_generales: form.observacionesGenerales,
        tipo_pedido: form.tipoPedido ?? 'material',
        items: materiales.map((i) => ({
          id: i.id,
          material_id: i.material_id,
          categoria_id: i.categoria_id ?? null,
          unidad_id: i.unidad_id ?? null,
          descripcion: i.descripcion ?? null,
          marca: (i.marca ?? '').toString().trim().toUpperCase() || null,
          modelo: (i.modelo ?? '').toString().trim().toUpperCase() || null,
          requiere_mantenimiento: i.requiere_mantenimiento === true,
          requiere_responsiva: i.requiere_responsiva === true,
          cantidad: i.cantidad === '' || i.cantidad == null ? i.cantidad : Number(i.cantidad),
          observaciones: i.observaciones,
          orden_compra_id: i.orden_compra_id ?? null,
          precio_unitario: i.precio_unitario ?? null,
        })),
        estatus: form.estatus,
        prioridad: form.prioridad,
      });

      if (savedPedido == null) {
        return;
      }

      suppressDraftSaveUntilRef.current = Date.now() + 2500;
      clearPedidoDraft();

      const proyecto =
        form.tipoAsociacion === 'proyecto'
          ? proyectosActivos.find((p) => p.id.toString() === form.asociacionId) || proyectoPrefijado
          : null;
      const solicitante = usuarios.find((u) => u.id === form.solicitanteId);

      const dataForPreview = savedPedido || {
        folio: 'NUEVO (Guardado)',
        fecha: new Date(),
        proyecto,
        cuenta: form.tipoAsociacion === 'cuenta' ? form.asociacionId : null,
        solicitante,
        observaciones_generales: form.observacionesGenerales,
        items: materiales,
      };

      setCurrentPedidoData(dataForPreview);
      setShowFormatSelection(true);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Hubo un problema al guardar el pedido. Tus datos siguen en el formulario.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    const prevEstatus = form.estatus;
    setForm((f) => ({ ...f, estatus: newStatus }));
    if (isEditing && pedidoGuardado?.id) {
      setUpdatingStatus(true);
      try {
        if (newStatus === 'Entregado' && (form.tipoPedido ?? 'material') === 'activo') {
          const recep = await recepcionarPedidoActivosSiAplica(supabase, {
            pedidoId: pedidoGuardado.id,
            nuevoEstatus: newStatus,
            tipoPedido: form.tipoPedido,
          });
          if (!recep.ok) {
            throw new Error(recep.message || 'No se pudo generar la recepción de activos.');
          }
          if (recep.result?.skipped) {
            toast({
              title: 'Recepción de activos',
              description: recep.result.message ?? 'Los activos ya estaban vinculados a este pedido.',
            });
          } else if (recep.result?.created) {
            toast({
              title: 'Activos generados',
              description: `Se crearon ${recep.result.created} registro(s) en activos.`,
            });
          }
        }

        const { error } = await supabase
          .from('pedidos_materiales')
          .update({ estatus: newStatus })
          .eq('id', pedidoGuardado.id);

        if (error) throw error;

        toast({ title: "Estatus Actualizado", description: `El pedido ha cambiado a ${newStatus}.` });
        setCurrentPedidoData((prev) => ({ ...prev, estatus: newStatus }));

        if (newStatus === 'Entregado' && (form.tipoPedido ?? 'material') === 'activo') {
          setCurrentPedidoData((prev) => ({ ...(prev || {}), pedido_activos: [] }));
        }

        if (onPedidoUpdated) await onPedidoUpdated();
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message ?? 'No se pudo actualizar el estatus.',
        });
        setForm((f) => ({ ...f, estatus: prevEstatus }));
      } finally {
        setUpdatingStatus(false);
      }
    }
  };

  const handleAuthorizationSuccess = async () => {
    await handleStatusChange('Autorizado');
  };

  const getPedidoDataForFormat = () => {
    if (currentPedidoData) return currentPedidoData;
    const proyecto =
      form.tipoAsociacion === 'proyecto'
        ? proyectosActivos.find((p) => p.id.toString() === form.asociacionId) || proyectoPrefijado
        : null;
    const solicitante = usuarios.find((u) => u.id === form.solicitanteId);
    return {
      folio: pedidoGuardado?.folio || 'BORRADOR',
      fecha: pedidoGuardado?.fecha || new Date(),
      proyecto,
      cuenta: form.tipoAsociacion === 'cuenta' ? form.asociacionId : null,
      solicitante: solicitante || { nombre_completo: 'Usuario no encontrado' },
      observaciones_generales: form.observacionesGenerales,
      tipo_pedido: form.tipoPedido ?? pedidoGuardado?.tipo_pedido ?? 'material',
      items: materiales,
      estatus: form.estatus,
    };
  };

  const getDatosPedidoParaOC = () => {
    const proyecto =
      form.tipoAsociacion === 'proyecto'
        ? proyectosActivos.find((p) => p.id.toString() === form.asociacionId) || proyectoPrefijado
        : null;
    const proyectoTexto = proyecto
      ? `${proyecto.folio ?? ''} - ${proyecto.descripcion ?? ''}`.trim()
      : form.tipoAsociacion === 'cuenta'
        ? form.asociacionId
        : '';
    return {
      proyecto_texto: proyectoTexto,
      proyectoTexto,
      proyecto_id: proyecto?.id ?? pedidoGuardado?.proyecto_id ?? null,
      descripcion_pedido: form.observacionesGenerales || (pedidoGuardado?.observaciones ?? ''),
      descripcionPedido: form.observacionesGenerales || (pedidoGuardado?.observaciones ?? ''),
      empresa_id: pedidoGuardado?.empresa_id ?? null,
      proveedor_id: pedidoGuardado?.proveedor_id ?? null,
      proveedorId: pedidoGuardado?.proveedorId ?? pedidoGuardado?.proveedor_id ?? null,
    };
  };

  const handlePrintTESEY = () => {
    setPreselectedFormat('TESEY');
    setShowImpresionPedido(true);
  };

  const handleRequestIIHEMSA = () => {
    setPreselectedFormat('IIHEMSA');
    setShowImpresionPedido(true);
  };

  const materialOptions = useMemo(() => {
    return (catalogoMateriales ?? [])
      .filter((m) => m.categoria === form.categoriaMaterial)
      .map((m) => ({ value: String(m.id), label: m.descripcion ?? '' }));
  }, [catalogoMateriales, form.categoriaMaterial]);

  const addCantidadStripInvalid = useMemo(() => {
    const raw = form.cantidad;
    if (raw === '' || raw == null || String(raw).trim() === '') return true;
    const q = Number(String(raw).replace(',', '.'));
    if (Number.isNaN(q) || q <= 0) return true;
    if ((form.tipoPedido ?? 'material') === 'activo' && Math.floor(q) !== q) return true;
    return false;
  }, [form.cantidad, form.tipoPedido]);

  const handleFormCantidadChange = useCallback((e) => {
    const value = e.target.value;
    if (value === '') {
      setForm((f) => ({ ...f, cantidad: '' }));
      setErrors((prev) => {
        if (!prev.cantidad) return prev;
        const next = { ...prev };
        delete next.cantidad;
        return next;
      });
      return;
    }
    if (!CANTIDAD_DECIMAL_INPUT_RE.test(value)) return;
    setForm((f) => ({ ...f, cantidad: value }));
    setErrors((prev) => {
      if (!prev.cantidad) return prev;
      const next = { ...prev };
      delete next.cantidad;
      return next;
    });
  }, []);

  const handleEditItemCantidadChange = useCallback((e) => {
    const value = e.target.value;
    if (value === '') {
      setEditItemForm((f) => ({ ...f, cantidad: '' }));
      return;
    }
    if (!CANTIDAD_DECIMAL_INPUT_RE.test(value)) return;
    setEditItemForm((f) => ({ ...f, cantidad: value }));
  }, []);

  const proyectoOptions = useMemo(() => (proyectosActivos ?? []).map(p => ({ value: String(p.id), label: `${p.folio ?? ''} - ${p.descripcion ?? ''}` })), [proyectosActivos]);
  const usuarioOptions = useMemo(() => (usuarios ?? []).map(u => ({ value: u.id, label: u.nombre_completo ?? '' })), [usuarios]);
  const statusOptionsList = useMemo(() => statusOptions, []);
  const itemStatusOptionsList = useMemo(() => itemStatusOptions, []);
  const cuentasGastoList = useMemo(() => ['Consumibles', 'Mantenimiento', 'Edificio', 'Activos', 'Herramienta', 'Stock'], []);
  const activoDescripcion = form.activoDescripcion ?? '';

  const setActivoDescripcion = useCallback((value) => {
    setForm((f) => ({ ...f, activoDescripcion: value }));
    setErrors((prev) => {
      if (!prev.descripcionActivo) return prev;
      const next = { ...prev };
      delete next.descripcionActivo;
      return next;
    });
  }, []);

  const onSolicitanteSelect = useCallback((v) => {
    setForm((f) => ({ ...f, solicitanteId: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n.solicitante;
      return n;
    });
  }, []);

  const onAsociacionSelect = useCallback((v) => {
    setForm((f) => ({ ...f, asociacionId: v }));
    setErrors((e) => {
      const n = { ...e };
      delete n.asociacion;
      return n;
    });
  }, []);

  const selectableItemKeys = useMemo(
    () =>
      materiales
        .filter((i) => {
          const hasOC = !!(i.orden_compra_id ?? i.oc_folio);
          if (hasOC) return false;
          const tp = form.tipoPedido ?? 'material';
          if (tp === 'activo') return !!(i.categoria_id);
          return !!i.material_id;
        })
        .map((i) => getItemKey(i)),
    [materiales, getItemKey, form.tipoPedido]
  );

  const categoriasActivosOptions = useMemo(
    () =>
      (categoriasActivosPedido ?? []).map((c) => ({
        value: String(c.id),
        label: c.nombre ?? '',
      })),
    [categoriasActivosPedido]
  );

  const textoCategoriaSeleccionadaPedido = useMemo(() => {
    const id = form.categoriaActivoSeleccionada;
    if (id == null || String(id).trim() === '') return '';
    const cat = (categoriasActivosPedido ?? []).find((c) => String(c.id) === String(id));
    if (!cat) return '';
    const desc = (cat.descripcion ?? '').toString().trim();
    const nom = (cat.nombre ?? '').toString().trim();
    return desc || nom || '';
  }, [form.categoriaActivoSeleccionada, categoriasActivosPedido]);

  const textoCategoriaEdicion = useMemo(() => {
    const id = editItemForm.categoria_id;
    if (id == null || String(id).trim() === '') return '';
    const cat = (categoriasActivosPedido ?? []).find((c) => String(c.id) === String(id));
    if (!cat) return '';
    const desc = (cat.descripcion ?? '').toString().trim();
    const nom = (cat.nombre ?? '').toString().trim();
    return desc || nom || '';
  }, [editItemForm.categoria_id, categoriasActivosPedido]);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent forceMount className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{pedidoGuardado?.id ? `Detalle Pedido: ${pedidoGuardado.folio} (${(pedidoGuardado.tipo_pedido ?? form.tipoPedido ?? 'material') === 'activo' ? 'Activo' : 'Material'})` : isCloneMode ? 'Nuevo Pedido (Pedir de nuevo)' : 'Nuevo Pedido de Materiales'}</DialogTitle></DialogHeader>

          {loading ? <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
            <div className="flex-1 overflow-y-auto pr-2">
              {/* ... (Secciones superiores iguales) ... */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4">
                {/* ... (Selects de estatus general, solicitante, etc.) ... */}
                <div className="md:col-span-2 flex justify-end items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor="estatus-select" className="font-bold text-gray-700">Estatus General:</Label>
                    <div className="w-48">
                      <Select
                        value={form.estatus}
                        onValueChange={handleStatusChange}
                        disabled={!isEditing || updatingStatus}
                      >
                        <SelectTrigger id="estatus-select" className={cn(
                          "font-semibold",
                          form.estatus === 'Pendiente' && "text-yellow-600",
                          form.estatus === 'Autorizado' && "text-green-600",
                          form.estatus === 'Entregado' && "text-blue-600"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptionsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                  </div>

                  {form.estatus === 'Pendiente' && (
                    <Button
                      onClick={() => setShowAuthDialog(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white gap-2 shadow-sm"
                      size="sm"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Autorizar Pedido
                    </Button>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="prioridad-select">Prioridad</Label>
                  <Select
                    value={form.prioridad}
                    onValueChange={(v) => setForm((f) => ({ ...f, prioridad: v }))}
                  >
                    <SelectTrigger id="prioridad-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="Alta">Alta</SelectItem><SelectItem value="Urgente">Urgente</SelectItem></SelectContent></Select>
                </div>

                {!isEditing && (
                  <div className="md:col-span-2">
                    <Label htmlFor="tipo-pedido-select">Tipo de pedido</Label>
                    <Select
                      value={form.tipoPedido ?? 'material'}
                      onValueChange={(v) => {
                        setMateriales([]);
                        setPartidasSeleccionadas([]);
                        setErrors((e) => {
                          const n = { ...e };
                          delete n.materiales;
                          return n;
                        });
                        setForm((f) => ({
                          ...f,
                          tipoPedido: v,
                          materialSeleccionado: '',
                          categoriaActivoSeleccionada: '',
                          activoDescripcion: '',
                          activoMarca: '',
                          activoModelo: '',
                          activoRequiereMantenimiento: false,
                          activoRequiereResponsiva: false,
                          activoUnidadId: v === 'activo' && defaultUnidadActivoId != null ? String(defaultUnidadActivoId) : '',
                          cantidad: '',
                          observaciones: '',
                        }));
                      }}
                    >
                      <SelectTrigger id="tipo-pedido-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="activo">Activo</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 mt-1">
                      Pedido de activo: líneas por categoría; al marcar el pedido como Entregado se crean tantos
                      registros únicos en Activos como la cantidad indicada (sin usar cantidad en la tabla de activos).
                    </p>
                  </div>
                )}
                {isEditing && (
                  <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-gray-600">Tipo de pedido:</span>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        (form.tipoPedido ?? 'material') === 'activo'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-800'
                      )}
                    >
                      {(form.tipoPedido ?? 'material') === 'activo' ? 'Activo' : 'Material'}
                    </span>
                  </div>
                )}
                <div className="md:col-span-2" {...{ [ERROR_FIELD_ATTR]: 'solicitante' }}>
                  <Label htmlFor="solicitante-select">Solicitante</Label>
                  <Select value={form.solicitanteId} onValueChange={onSolicitanteSelect} disabled={isEditing}>
                    <SelectTrigger id="solicitante-select" className={cn(errors.solicitante && 'border-red-500 error-field')}>
                      <SelectValue placeholder="Seleccione un solicitante..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(usuarios ?? []).map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre_completo ?? ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.solicitante ? (
                    <p className="mt-1 text-sm text-red-600">{errors.solicitante}</p>
                  ) : null}
                </div>
                <div className="space-y-4 md:col-span-2" {...{ [ERROR_FIELD_ATTR]: 'asociacion' }}>
                  <h3 className="font-semibold text-gray-800 border-t pt-4">Asociar Pedido</h3>
                  <Tabs
                    value={form.tipoAsociacion}
                    onValueChange={(v) => {
                      if (!isProjectLocked && !isEditing) {
                        setForm((f) => ({ ...f, tipoAsociacion: v, asociacionId: '' }));
                        setErrors((e) => {
                          const n = { ...e };
                          delete n.asociacion;
                          return n;
                        });
                      }
                    }}
                  >
                    <TabsList className={cn('grid w-full', isProjectLocked ? 'grid-cols-1' : 'grid-cols-2')}>
                      <TabsTrigger value="proyecto" disabled={isProjectLocked || isEditing}>
                        Proyecto
                      </TabsTrigger>
                      {!isProjectLocked && (
                        <TabsTrigger value="cuenta" disabled={isEditing}>
                          Cuenta
                        </TabsTrigger>
                      )}
                    </TabsList>
                    <div className="mt-4">
                      {form.tipoAsociacion === 'proyecto' && (
                        <>
                          <Label htmlFor="proyecto-select">Seleccionar Proyecto Activo</Label>
                          <Select
                            value={form.asociacionId}
                            onValueChange={onAsociacionSelect}
                            disabled={isProjectLocked || isEditing}
                          >
                            <SelectTrigger id="proyecto-select" className={cn(errors.asociacion && 'border-red-500 error-field')}>
                              <SelectValue placeholder="Elige un proyecto..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(proyectosActivos ?? []).map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                  {p.folio ?? ''} - {p.descripcion ?? ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                      {form.tipoAsociacion === 'cuenta' && !isProjectLocked && (
                        <>
                          <Label htmlFor="cuenta-select">Seleccionar Cuenta de Gasto</Label>
                          <Select value={form.asociacionId} onValueChange={onAsociacionSelect} disabled={isEditing}>
                            <SelectTrigger id="cuenta-select" className={cn(errors.asociacion && 'border-red-500 error-field')}>
                              <SelectValue placeholder="Elige una cuenta..." />
                            </SelectTrigger>
                            <SelectContent>
                              {cuentasGastoList.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </>
                      )}
                    </div>
                  </Tabs>
                  {errors.asociacion ? (
                    <p className="mt-2 text-sm text-red-600">{errors.asociacion}</p>
                  ) : null}
                </div>
                <div className="space-y-2 md:col-span-2"><h3 className="font-semibold text-gray-800 border-t pt-4">Observaciones Generales del Pedido</h3><Textarea placeholder="Añade aquí cualquier instrucción o comentario general sobre el pedido..." value={form.observacionesGenerales} onChange={(e) => setForm((f) => ({ ...f, observacionesGenerales: e.target.value }))} disabled={isEditing} /></div>

                {(form.tipoPedido ?? 'material') === 'material' ? (
                <div className="space-y-4 md:col-span-2 bg-gray-50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" /> Agregar Materiales
                  </h3>
                  <Tabs value={form.categoriaMaterial} onValueChange={(value) => { setForm((f) => ({ ...f, categoriaMaterial: value, materialSeleccionado: '' })); }}>
                    <TabsList className="grid w-full grid-cols-5 h-auto py-1">
                      <TabsTrigger value="Materiales" className="gap-2 text-xs py-2"><Package className="w-3 h-3" />Materiales</TabsTrigger>
                      <TabsTrigger value="Consumibles" className="gap-2 text-xs py-2"><ToyBrick className="w-3 h-3" />Consumibles</TabsTrigger>
                      <TabsTrigger value="Activos" className="gap-2 text-xs py-2"><Cuboid className="w-3 h-3" />Activos</TabsTrigger>
                      <TabsTrigger value="Edificio" className="gap-2 text-xs py-2"><Building2 className="w-3 h-3" />Edificio</TabsTrigger>
                      <TabsTrigger value="Servicios" className="gap-2 text-xs py-2"><Wrench className="w-3 h-3" />Servicios</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-4 space-y-1" {...{ [ERROR_FIELD_ATTR]: 'material' }}>
                      <Label htmlFor="material-select" className="text-xs">Material</Label>
                      <Combobox
                        options={materialOptions}
                        value={form.materialSeleccionado}
                        onChange={(v) => {
                          setForm((f) => ({ ...f, materialSeleccionado: v }));
                          setErrors((prev) => {
                            if (!prev.material) return prev;
                            const next = { ...prev };
                            delete next.material;
                            return next;
                          });
                        }}
                        placeholder="Busca un material..."
                        searchPlaceholder="Buscar material..."
                        notFoundMessage="No se encontró el material."
                        className={cn('w-full', errors.material && 'error-field')}
                      />
                      {errors.material ? (
                        <span className="text-red-500 text-xs block">{errors.material}</span>
                      ) : null}
                    </div>
                    <div className="sm:col-span-2 space-y-1" {...{ [ERROR_FIELD_ATTR]: 'cantidad' }}>
                      <Label htmlFor="cantidad" className="text-xs">Cantidad</Label>
                      <Input
                        id="cantidad"
                        type="number"
                        step="1"
                        inputMode="decimal"
                        value={form.cantidad ?? ''}
                        onChange={handleFormCantidadChange}
                        placeholder="Ej. 10 o 1.5"
                        className={cn(errors.cantidad && 'error-field')}
                      />
                      {errors.cantidad ? (
                        <span className="text-red-500 text-xs block">{errors.cantidad}</span>
                      ) : null}
                    </div>
                    <div className="sm:col-span-3">
                      <Label htmlFor="observaciones" className="text-xs">Observaciones</Label>
                      <Input id="observaciones" value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} placeholder="Opcional" />
                    </div>
                    <div className="sm:col-span-1">
                      <Button
                        type="button"
                        onClick={handleAddItem}
                        disabled={addCantidadStripInvalid}
                        className="w-full gap-2 bg-blue-600 hover:bg-blue-700"
                        size="sm"
                      >
                        <PlusCircle className="w-4 h-4" /> Añadir
                      </Button>
                    </div>
                  </div>
                </div>
                ) : (
                <div className="flex flex-col gap-4 md:gap-5 md:col-span-2 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 md:p-5">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2 text-base">
                      <Cuboid className="w-5 h-5 shrink-0 text-indigo-600" />
                      Agregar activos (categoría)
                    </h3>
                    <p className="text-xs text-gray-600 leading-relaxed max-w-3xl">
                      Cada línea es una categoría de activo. Al marcar el pedido como <strong>Entregado</strong> se generan tantos
                      registros en Activos como la <strong>cantidad entera</strong> indicada.
                    </p>
                  </div>

                  <div className="rounded-md border border-indigo-100/80 bg-white/90 p-3 md:p-4 space-y-4 md:space-y-5 shadow-sm">
                    {/* Fila 1: categoría + descripción */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-2 flex flex-col gap-1.5 min-w-0" {...{ [ERROR_FIELD_ATTR]: 'material' }}>
                        <Label htmlFor="catalogo-activo-select" className="text-sm font-medium text-gray-800">
                          Categoría
                        </Label>
                        <Combobox
                          options={categoriasActivosOptions}
                          value={form.categoriaActivoSeleccionada}
                          onChange={(v) => {
                            setForm((f) => ({ ...f, categoriaActivoSeleccionada: v }));
                            setErrors((prev) => {
                              if (!prev.material) return prev;
                              const next = { ...prev };
                              delete next.material;
                              return next;
                            });
                          }}
                          placeholder="Buscar categoría..."
                          searchPlaceholder="Buscar categoría..."
                          notFoundMessage="Sin resultados."
                          className={cn('w-full', errors.material && 'error-field')}
                        />
                        {textoCategoriaSeleccionadaPedido ? (
                          <p className="text-xs text-gray-700 leading-snug border-l-2 border-indigo-200 pl-2 py-1 bg-indigo-50/50 rounded-r">
                            {textoCategoriaSeleccionadaPedido}
                          </p>
                        ) : null}
                        {errors.material ? (
                          <span className="text-red-600 text-xs">{errors.material}</span>
                        ) : null}
                      </div>
                      <div className="md:col-span-3 flex flex-col gap-1.5 min-w-0" {...{ [ERROR_FIELD_ATTR]: 'descripcionActivo' }}>
                        <Label htmlFor="activo-descripcion-base" className="text-sm font-medium text-gray-800">
                          Descripción del activo
                        </Label>
                        <Input
                          id="activo-descripcion-base"
                          type="text"
                          autoComplete="off"
                          value={activoDescripcion}
                          onChange={(e) => setActivoDescripcion(e.target.value)}
                          placeholder="Ej. Taladro inalámbrico 20V"
                          className={cn('w-full', errors.descripcionActivo && 'error-field')}
                        />
                        {errors.descripcionActivo ? (
                          <span className="text-red-600 text-xs">{errors.descripcionActivo}</span>
                        ) : null}
                      </div>
                    </div>

                    {/* Fila 2: cantidad + unidad + observaciones */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div className="md:col-span-1 flex flex-col gap-1.5" {...{ [ERROR_FIELD_ATTR]: 'cantidad' }}>
                        <Label htmlFor="cantidad-activo" className="text-sm font-medium text-gray-800">
                          Cantidad
                        </Label>
                        <Input
                          id="cantidad-activo"
                          type="number"
                          step="1"
                          min="1"
                          inputMode="numeric"
                          value={form.cantidad ?? ''}
                          onChange={handleFormCantidadChange}
                          placeholder="Ej. 3"
                          className={cn('w-full', errors.cantidad && 'error-field')}
                        />
                        <span className="text-[11px] text-gray-500">Solo números enteros</span>
                        {errors.cantidad ? <span className="text-red-600 text-xs">{errors.cantidad}</span> : null}
                      </div>
                      <div className="md:col-span-1 flex flex-col gap-1.5 min-w-0" {...{ [ERROR_FIELD_ATTR]: 'unidadActivo' }}>
                        <Label htmlFor="activo-unidad-select" className="text-sm font-medium text-gray-800">
                          Unidad
                        </Label>
                        <select
                          id="activo-unidad-select"
                          value={form.activoUnidadId ?? ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((f) => ({ ...f, activoUnidadId: v }));
                            setErrors((prev) => {
                              if (!prev.unidadActivo) return prev;
                              const next = { ...prev };
                              delete next.unidadActivo;
                              return next;
                            });
                          }}
                          disabled={catalogoUnidadesPedido.length === 0}
                          className={cn(
                            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            'disabled:cursor-not-allowed disabled:opacity-50',
                            errors.unidadActivo && 'border-red-500 error-field'
                          )}
                        >
                          <option value="">Seleccionar unidad…</option>
                          {(catalogoUnidadesPedido ?? []).map((u) => (
                            <option key={u.id} value={String(u.id)}>
                              {u.nombre}
                            </option>
                          ))}
                        </select>
                        {errors.unidadActivo ? (
                          <span className="text-red-600 text-xs">{errors.unidadActivo}</span>
                        ) : null}
                      </div>
                      <div className="md:col-span-3 flex flex-col gap-1.5 min-w-0">
                        <Label htmlFor="observaciones-activo" className="text-sm font-medium text-gray-800">
                          Observaciones
                        </Label>
                        <Input
                          id="observaciones-activo"
                          value={form.observaciones}
                          onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                          placeholder="Opcional"
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Fila 3: marca + modelo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2 flex flex-col gap-1.5 min-w-0">
                        <Label htmlFor="activo-marca" className="text-sm font-medium text-gray-800">
                          Marca
                        </Label>
                        <Input
                          id="activo-marca"
                          value={form.activoMarca ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, activoMarca: e.target.value.toUpperCase() }))}
                          placeholder="EJ. MAKITA"
                          className="w-full uppercase"
                        />
                        <span className="text-[11px] text-gray-500">Se guarda en mayúsculas</span>
                      </div>
                      <div className="md:col-span-2 flex flex-col gap-1.5 min-w-0">
                        <Label htmlFor="activo-modelo" className="text-sm font-medium text-gray-800">
                          Modelo
                        </Label>
                        <Input
                          id="activo-modelo"
                          value={form.activoModelo ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, activoModelo: e.target.value.toUpperCase() }))}
                          placeholder="EJ. XPH14"
                          className="w-full uppercase"
                        />
                        <span className="text-[11px] text-gray-500">Se guarda en mayúsculas</span>
                      </div>
                    </div>

                    {/* Fila 4: checkboxes */}
                    <div
                      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center pt-2 border-t border-indigo-100"
                      role="group"
                      aria-label="Requisitos del activo"
                    >
                      <label className="flex items-center gap-2.5 text-sm text-gray-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={form.activoRequiereMantenimiento === true}
                          onChange={(e) => setForm((f) => ({ ...f, activoRequiereMantenimiento: e.target.checked }))}
                        />
                        Requiere mantenimiento
                      </label>
                      <label className="flex items-center gap-2.5 text-sm text-gray-800 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={form.activoRequiereResponsiva === true}
                          onChange={(e) => setForm((f) => ({ ...f, activoRequiereResponsiva: e.target.checked }))}
                        />
                        Requiere responsiva
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      disabled={addCantidadStripInvalid || categoriasActivosOptions.length === 0}
                      className="w-full sm:w-auto gap-2 bg-indigo-600 hover:bg-indigo-700"
                      size="sm"
                    >
                      <PlusCircle className="w-4 h-4 shrink-0" />
                      Añadir línea
                    </Button>
                  </div>

                  {categoriasActivosOptions.length === 0 ? (
                    <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3 leading-relaxed">
                      No hay categorías en <code className="text-xs bg-amber-100/80 px-1 rounded">categorias_activos</code>.
                      Crea categorías en <strong>Activos</strong> → pestaña <strong>Categorías</strong> para habilitar pedidos de activos.
                    </p>
                  ) : null}
                </div>
                )}
              </div>

              {/* Items List with Editable Fields */}
              <div className="space-y-2 mt-4" {...{ [ERROR_FIELD_ATTR]: 'materiales' }}>
                <h3 className="font-semibold text-gray-800">Resumen del Pedido</h3>
                {errors.materiales ? (
                  <p className="text-sm text-red-600">{errors.materiales}</p>
                ) : null}
                <div className="w-full overflow-x-auto pb-2">
                  <div className="border rounded-lg overflow-hidden inline-block min-w-0">
                    <table className="w-full min-w-[700px] text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="w-10 px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={
                              selectableItemKeys.length > 0 &&
                              selectableItemKeys.every((k) => partidasSeleccionadas.includes(k))
                            }
                            onChange={(e) => {
                              setPartidasSeleccionadas(e.target.checked ? [...selectableItemKeys] : []);
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            aria-label="Seleccionar o desmarcar todas las partidas"
                          />
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[200px]">Partida</th>
                        <th className="text-center px-2 py-3 font-medium text-gray-600 w-24 min-w-[80px]">Cant.</th>
                        <th className="text-left px-2 py-3 font-medium text-gray-600 w-40 min-w-[120px]">OC</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 w-24 min-w-[90px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {materiales.length > 0 ? materiales.map((item) => {
                        const itemKey = getItemKey(item);
                        const isEditingRow = editingItemKey === itemKey;
                        const hasOC = !!(item.orden_compra_id ?? item.oc_folio);
                        const isActivoLine = (form.tipoPedido ?? 'material') === 'activo' && !!(item.categoria_id);
                        const seleccionable = !hasOC && (!!item.material_id || isActivoLine);
                        const rowMatErr = [errors[`desc_${itemKey}`], errors[`cant_${itemKey}`], errors[`unidad_${itemKey}`]]
                          .filter(Boolean)
                          .join(' ');
                        return (
                        <React.Fragment key={item.rowId ?? itemKey}>
                          {isEditingRow ? (
                            <tr className="bg-blue-50/50 border-l-2 border-blue-400">
                              <td className="px-3 py-3 sm:px-4" colSpan={5}>
                                <div className="flex flex-col gap-3">
                                  {(form.tipoPedido ?? 'material') === 'activo' ? (
                                    <>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                                        <div className="flex flex-col gap-1 min-w-0 lg:col-span-1">
                                          <Label className="text-xs font-medium text-gray-800">Cantidad</Label>
                                          <Input
                                            type="number"
                                            step="1"
                                            inputMode="numeric"
                                            value={editItemForm.cantidad ?? ''}
                                            onChange={handleEditItemCantidadChange}
                                            className="h-9 w-full"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 lg:col-span-1">
                                          <Label className="text-xs font-medium text-gray-800">Unidad</Label>
                                          <select
                                            value={editItemForm.unidad_id ?? ''}
                                            onChange={(e) =>
                                              setEditItemForm((f) => ({ ...f, unidad_id: e.target.value }))
                                            }
                                            disabled={catalogoUnidadesPedido.length === 0}
                                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                                          >
                                            <option value="">Seleccionar…</option>
                                            {(catalogoUnidadesPedido ?? []).map((u) => (
                                              <option key={u.id} value={String(u.id)}>
                                                {u.nombre}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 lg:col-span-2">
                                          <Label className="text-xs font-medium text-gray-800">Categoría</Label>
                                          <Combobox
                                            options={categoriasActivosOptions}
                                            value={editItemForm.categoria_id}
                                            onChange={(v) => setEditItemForm((f) => ({ ...f, categoria_id: v }))}
                                            placeholder="Categoría..."
                                            searchPlaceholder="Buscar categoría..."
                                            notFoundMessage="No encontrado."
                                            className="w-full"
                                          />
                                          {textoCategoriaEdicion ? (
                                            <p className="text-xs text-gray-700 leading-snug border-l-2 border-indigo-200 pl-2 py-0.5 bg-white/80 rounded-r">
                                              {textoCategoriaEdicion}
                                            </p>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0 sm:col-span-2 lg:col-span-2">
                                          <Label className="text-xs font-medium text-gray-800">Descripción del activo</Label>
                                          <Input
                                            value={editItemForm.descripcion}
                                            onChange={(e) => setEditItemForm((f) => ({ ...f, descripcion: e.target.value }))}
                                            placeholder="Ej. Taladro inalámbrico 20V"
                                            className="h-9 w-full"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1 min-w-0">
                                          <Label className="text-xs font-medium text-gray-800">Marca</Label>
                                          <Input
                                            value={editItemForm.marca}
                                            onChange={(e) => setEditItemForm((f) => ({ ...f, marca: e.target.value.toUpperCase() }))}
                                            className="h-9 w-full uppercase"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-1 min-w-0">
                                          <Label className="text-xs font-medium text-gray-800">Modelo</Label>
                                          <Input
                                            value={editItemForm.modelo}
                                            onChange={(e) => setEditItemForm((f) => ({ ...f, modelo: e.target.value.toUpperCase() }))}
                                            className="h-9 w-full uppercase"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-4 border-t border-blue-100 pt-2">
                                        <label className="flex items-center gap-2 text-xs text-gray-800">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300"
                                            checked={editItemForm.requiere_mantenimiento === true}
                                            onChange={(e) =>
                                              setEditItemForm((f) => ({ ...f, requiere_mantenimiento: e.target.checked }))
                                            }
                                          />
                                          Requiere mantenimiento
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-gray-800">
                                          <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300"
                                            checked={editItemForm.requiere_responsiva === true}
                                            onChange={(e) =>
                                              setEditItemForm((f) => ({ ...f, requiere_responsiva: e.target.checked }))
                                            }
                                          />
                                          Requiere responsiva
                                        </label>
                                      </div>
                                      <div className="flex flex-col gap-1 min-w-0">
                                        <Label className="text-xs font-medium text-gray-800">Observaciones</Label>
                                        <Input
                                          value={editItemForm.observaciones}
                                          onChange={(e) => setEditItemForm((f) => ({ ...f, observaciones: e.target.value }))}
                                          placeholder="Opcional"
                                          className="h-9 w-full"
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                                      <div className="flex flex-col gap-1 w-full sm:w-auto sm:min-w-[100px]">
                                        <Label className="text-xs font-medium text-gray-800">Cantidad</Label>
                                        <Input
                                          type="number"
                                          step="any"
                                          inputMode="decimal"
                                          value={editItemForm.cantidad ?? ''}
                                          onChange={handleEditItemCantidadChange}
                                          className="h-9 w-full sm:w-28"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1 flex-1 min-w-0 sm:min-w-[220px]">
                                        <Label className="text-xs font-medium text-gray-800">Material</Label>
                                        <Combobox
                                          options={materialOptions}
                                          value={editItemForm.material_id}
                                          onChange={(v) => setEditItemForm((f) => ({ ...f, material_id: v }))}
                                          placeholder="Material..."
                                          searchPlaceholder="Buscar..."
                                          notFoundMessage="No encontrado."
                                          className="w-full"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                                        <Label className="text-xs font-medium text-gray-800">Observaciones</Label>
                                        <Input
                                          value={editItemForm.observaciones}
                                          onChange={(e) => setEditItemForm((f) => ({ ...f, observaciones: e.target.value }))}
                                          placeholder="Opcional"
                                          className="h-9 w-full"
                                        />
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1 border-t border-blue-100">
                                    <Button size="sm" variant="outline" onClick={handleCancelEditItem} className="w-full sm:w-auto">
                                      Cancelar
                                    </Button>
                                    <Button size="sm" onClick={handleSaveEditItem} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                                      Guardar
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <PedidoMaterialDisplayRow
                              item={item}
                              itemKey={itemKey}
                              descError={!!errors[`desc_${itemKey}`]}
                              cantError={!!errors[`cant_${itemKey}`]}
                              unidadError={!!errors[`unidad_${itemKey}`]}
                              seleccionable={seleccionable}
                              hasOC={hasOC}
                              checked={partidasSeleccionadas.includes(itemKey)}
                              togglePartida={togglePartidaSeleccionada}
                              onStartEdit={handleStartEditItem}
                              onRemove={handleRemoveItem}
                            />
                          )}
                          {rowMatErr ? (
                            <tr className="bg-red-50">
                              <td colSpan={5} className="px-4 py-1 text-xs text-red-700">
                                {rowMatErr}
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                        );
                      }) : (
                        <tr>
                          <td colSpan={5} className="text-center text-sm text-gray-500 py-8">
                            {(form.tipoPedido ?? 'material') === 'activo'
                              ? 'Aún no has agregado líneas de activos.'
                              : 'Aún no has agregado materiales.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>

                {(form.tipoPedido ?? 'material') === 'activo' && isEditing && pedidoGuardado?.id ? (
                  <div className="space-y-3 mt-6 rounded-lg border border-indigo-200 bg-indigo-50/40 p-4">
                    <h3 className="font-semibold text-gray-900">Activos generados desde este pedido</h3>
                    {(() => {
                      const rel = pedidoGuardado?.pedido_activos ?? currentPedidoData?.pedido_activos ?? [];
                      if (!rel.length) {
                        return (
                          <p className="text-sm text-gray-600">
                            Cuando el estatus sea <strong>Entregado</strong>, se procesará la recepción de activos según la
                            configuración del sistema (las filas vinculadas no se muestran aquí).
                          </p>
                        );
                      }
                      return (
                        <ul className="divide-y rounded-md border bg-white text-sm max-h-48 overflow-y-auto">
                          {rel.map((row) => (
                            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                              <span className="font-medium text-gray-900">{row.activos?.nombre ?? '—'}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">{row.activos?.estado ?? ''}</span>
                                {row.activos?.id ? (
                                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                                    <Link to={`/activos/${row.activos.id}`}>Ver activo</Link>
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-t gap-2">
            <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cerrar</Button></DialogClose>

            {isEditing ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  onClick={() => setShowNuevaOCDesdePedido(true)}
                  variant="default"
                  disabled={
                    (form.tipoPedido ?? 'material') === 'activo' || partidasSeleccionadas.length === 0
                  }
                  className={cn(
                    "gap-2",
                    (form.tipoPedido ?? 'material') === 'activo' || partidasSeleccionadas.length === 0
                      ? "bg-gray-400 cursor-not-allowed hover:bg-gray-400"
                      : "bg-amber-600 hover:bg-amber-700"
                  )}
                  title={(form.tipoPedido ?? 'material') === 'activo' ? 'No aplica a pedidos de activos' : undefined}
                >
                  Generar OC
                </Button>
                <Button onClick={handleSave} disabled={isSaving || loading} className="bg-green-600 hover:bg-green-700">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>

                <div className="flex items-center ml-2">
                  <Button
                    onClick={handlePrintTESEY}
                    className="gap-2 rounded-r-none border-r border-primary/20 bg-primary text-white shadow hover:bg-primary/90 transition px-4 py-2"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="rounded-l-none px-2 bg-primary text-white shadow hover:bg-primary/90 transition border-0">
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={handleRequestIIHEMSA}>
                        Formato V2-IIH
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ) : (

              <Button onClick={handleSave} disabled={isSaving || loading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar y Generar Formato'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Deseas salir?</AlertDialogTitle>
            <AlertDialogDescription>
              Se perderá la información capturada en este formulario que no hayas guardado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction type="button" className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmDiscardAndClose}>
              Sí, salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormatoPedidoImpresion
        open={showImpresionPedido}
        onOpenChange={setShowImpresionPedido}
        pedido={getPedidoDataForFormat()}
        defaultFormat={preselectedFormat}
      />

      <SeleccionarFormatoDialog
        open={showFormatSelection}
        onOpenChange={setShowFormatSelection}
        pedidoData={getPedidoDataForFormat()}
        defaultFormat={preselectedFormat}
      />

      <AutorizarPedidoDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        onAuthorized={handleAuthorizationSuccess}
      />

      <GenerarOCModal
        open={showGenerarOC}
        onOpenChange={setShowGenerarOC}
        pedidoId={pedidoGuardado?.id}
        items={materiales}
        onSuccess={onPedidoUpdated}
      />

      <NuevaOCDirectaModal
        open={showNuevaOCDesdePedido}
        onOpenChange={setShowNuevaOCDesdePedido}
        onSuccess={() => { setShowNuevaOCDesdePedido(false); onPedidoUpdated?.(); }}
        partidasPreseleccionadas={materiales
          .filter((i) => partidasSeleccionadas.includes(getItemKey(i)))
          .map((i) => {
            const mat = catalogoMateriales.find((m) => String(m?.id) === String(i.material_id));
            return {
              material_id: i.material_id ?? null,
              clave: i.clave ?? mat?.clave ?? '',
              descripcion: i.descripcion ?? '',
              unidad: unidadImpresionPedidoItem(i),
              notas: i.observaciones ?? '',
              observaciones: i.observaciones ?? '',
              cantidad: i.cantidad ?? 0,
            };
          })}
        datosPedido={getDatosPedidoParaOC()}
      />
    </>
  );
};

export default NuevoPedidoDialog;