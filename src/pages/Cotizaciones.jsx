import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Plus, Search, Filter, Copy, CheckCircle, XCircle, MoreVertical, Edit, Trash2, Loader2, ArrowRight, User, Printer, RotateCcw, History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import CotizacionDialog from '@/components/cotizaciones/CotizacionDialog';
import SeleccionarFormatoCotizacionDialog from '@/components/cotizaciones/SeleccionarFormatoCotizacionDialog';
import CambiarClienteCotizacionDialog from '@/components/cotizaciones/CambiarClienteCotizacionDialog';
import ApproveQuoteModal from '@/components/cotizaciones/ApproveQuoteModal';
import HistorialVersionesModal from '@/components/cotizaciones/HistorialVersionesModal';
import CatalogoServicios from '@/components/cotizaciones/CatalogoServicios';
import CalculadoraPartida from '@/components/cotizaciones/CalculadoraPartida';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { formatDateTable } from '@/lib/dateUtils';
import { notifyCotizacionAprobada } from '@/services/TelegramService';
import { useProyectosPathPrefix } from '@/hooks/useProyectosPathPrefix';
import { MARCAS_COMERCIALES, BRANDINGS } from '@/lib/brandingConfig';

const EstatusBadge = ({ estatus }) => {
  const baseClasses = 'px-3 py-1 text-xs font-medium rounded-full inline-block';
  const styles = {
    Borrador: 'bg-gray-100 text-gray-800',
    Enviada: 'bg-blue-100 text-blue-800',
    Aprobada: 'bg-green-100 text-green-800',
    Rechazada: 'bg-red-100 text-red-800',
    Historial: 'bg-slate-200 text-slate-700',
    Obsoleta: 'bg-slate-200 text-slate-600',
  };
  return <span className={`${baseClasses} ${styles[estatus] ?? 'bg-gray-100 text-gray-800'}`}>{estatus}</span>;
};

const Cotizaciones = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const proyectosBase = useProyectosPathPrefix();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterMarca, setFilterMarca] = useState('Todos');
  const [filterEmpresa, setFilterEmpresa] = useState('Todos');
  const [filterFechaOrden, setFilterFechaOrden] = useState('desc');
  const [cotizaciones, setCotizaciones] = useState([]);
  const [proyectosPorCotizacion, setProyectosPorCotizacion] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [changeClientDialogOpen, setChangeClientDialogOpen] = useState(false);
  const [cotizacionToChangeClient, setCotizacionToChangeClient] = useState(null);
  
  const [selectedCotizacion, setSelectedCotizacion] = useState(null);
  const [approveQuoteModalOpen, setApproveQuoteModalOpen] = useState(false);
  const [quoteToApprove, setQuoteToApprove] = useState(null);
  const [initialTemplate, setInitialTemplate] = useState(null);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [cotizacionParaHistorial, setCotizacionParaHistorial] = useState(null);

  const [mostrarCalculadoraBeta, setMostrarCalculadoraBeta] = useState(false);

  // FASE 2: Modal "Proyecto Existente Detectado" (actualizar en lugar de crear)
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [pendingApprovalData, setPendingApprovalData] = useState(null);

  /** Extrae el folio base (ej. CTZ-050-v2 → CTZ-050, COT-2026-0073-V2 → COT-2026-0073) */
  const getFolioBase = (folio) => {
    if (!folio || typeof folio !== 'string') return '';
    return folio.replace(/-[vV]\d+$/i, '').trim();
  };

  /** FASE 1: Busca si ya existe un proyecto para esta "familia" de cotizaciones (mismo folio base). */
  const findExistingProjectForQuote = useCallback(async (cotizacionFolio) => {
    const folioBase = getFolioBase(cotizacionFolio);
    if (!folioBase) return null;
    const { data, error } = await supabase
      .from('proyectos')
      .select('id, folio, cotizacion_folio')
      .or(`cotizacion_folio.eq.${folioBase},cotizacion_folio.ilike.${folioBase}-%`)
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Error buscando proyecto existente:', error);
      return null;
    }
    return data;
  }, []);

  /**
   * Tarea 4: mapea cada cotización con su proyecto (si existe) en una sola pasada.
   * Empareja por `cotizacion_id` directo y, como respaldo, por familia de folio
   * (`cotizacion_folio` base), para cotizaciones versionadas (CTZ-050-V2 → CTZ-050).
   * Devuelve un objeto { [cotizacionId]: { id, folio } }.
   */
  const fetchProyectosDeCotizaciones = useCallback(async (cots) => {
    if (!cots || cots.length === 0) return {};
    const cotIds = cots.map((c) => c.id);
    const foliosBase = Array.from(
      new Set(cots.map((c) => getFolioBase(c.folio)).filter(Boolean))
    );

    const orClauses = [`cotizacion_id.in.(${cotIds.join(',')})`];
    if (foliosBase.length > 0) {
      orClauses.push(`cotizacion_folio.in.(${foliosBase.map((f) => `"${f}"`).join(',')})`);
    }

    const { data, error } = await supabase
      .from('proyectos')
      .select('id, folio, cotizacion_id, cotizacion_folio')
      .or(orClauses.join(','));

    if (error) {
      console.error('Error cargando proyectos de cotizaciones:', error);
      return {};
    }

    // Índices para empareje: por cotizacion_id directo y por folio base de la familia.
    const porCotId = new Map();
    const porFolioBase = new Map();
    (data || []).forEach((p) => {
      if (p.cotizacion_id != null && !porCotId.has(p.cotizacion_id)) porCotId.set(p.cotizacion_id, p);
      const base = getFolioBase(p.cotizacion_folio);
      if (base && !porFolioBase.has(base)) porFolioBase.set(base, p);
    });

    const mapa = {};
    cots.forEach((c) => {
      const match = porCotId.get(c.id) || porFolioBase.get(getFolioBase(c.folio));
      if (match) mapa[c.id] = { id: match.id, folio: match.folio };
    });
    return mapa;
  }, []);

  const fetchCotizaciones = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('cotizaciones')
      .select('*, cliente:cliente_id(nombre)')
      .eq('es_ultima_version', true)
      .order('id', { ascending: false });
    if (filterStatus !== 'Todos') {
      query = query.eq('estatus', filterStatus);
    }
    const { data, error } = await query;

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las cotizaciones.' });
        console.error(error);
    } else {
        const formattedData = data.map(c => ({
            ...c,
            cliente_nombre: c.cliente?.nombre || c.cliente_nombre_externo,
        }));
        setCotizaciones(formattedData);
        const mapaProyectos = await fetchProyectosDeCotizaciones(formattedData);
        setProyectosPorCotizacion(mapaProyectos);
    }
    setLoading(false);
  }, [toast, filterStatus, fetchProyectosDeCotizaciones]);

  const autoRechazarAntiguas = useCallback(async () => {
    const now = new Date();
    const inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .slice(0, 10);

    const { data, error } = await supabase
      .from('cotizaciones')
      .update({ estatus: 'Rechazada' })
      .in('estatus', ['Borrador', 'Enviada'])
      .eq('es_ultima_version', true)
      .lt('fecha', inicioMesActual)
      .select('id');

    if (error) {
      console.error('autoRechazarAntiguas error:', error);
    } else if (data && data.length > 0) {
      toast({
        title: `${data.length} cotización${data.length > 1 ? 'es' : ''} rechazada${data.length > 1 ? 's' : ''}`,
        description: 'Cotizaciones de meses anteriores marcadas como Rechazadas automáticamente.',
      });
    }

    await fetchCotizaciones();
  }, [toast, fetchCotizaciones]);

  const autoRechazarRanRef = useRef(false);

  useEffect(() => {
    if (autoRechazarRanRef.current) return;
    autoRechazarRanRef.current = true;
    autoRechazarAntiguas();
  }, [autoRechazarAntiguas]);

  useEffect(() => {
    fetchCotizaciones();
  }, [fetchCotizaciones]);

  useEffect(() => {
    const openId = location.state?.openCotizacionId;
    const action = location.state?.action;
    if (!openId || cotizaciones.length === 0) return;
    const c = cotizaciones.find(x => x.id === openId);
    if (!c) return;
    if (action === 'crearNuevaVersion') {
      handleCrearNuevaVersion(c);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    if (action === 'duplicarPlantilla') {
      handleDuplicarComoPlantilla(c);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    setSelectedCotizacion(c);
    if (action === 'editar') {
      setDialogOpen(true);
    } else {
      setPrintDialogOpen(true);
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state?.openCotizacionId, location.state?.action, cotizaciones, navigate, location.pathname]);

  /** Payload común para crear o actualizar proyecto desde cotización. */
  const buildProjectPayloadFromQuote = (cotizacionAprobada) => {
    const payload = {
      cotizacion_id: cotizacionAprobada.id,
      cotizacion_folio: cotizacionAprobada.folio,
      cliente_id: cotizacionAprobada.cliente_id,
      cliente_nombre_externo: cotizacionAprobada.cliente_nombre_externo ?? null,
      descripcion: cotizacionAprobada.descripcion,
      requiere_cfdi: cotizacionAprobada.aplica_iva !== false,
    };
    if (cotizacionAprobada.total != null) payload.costo_total = Number(cotizacionAprobada.total);
    return payload;
  };

  /**
   * FASE 3: Crea un nuevo proyecto (INSERT) o actualiza el existente (UPDATE).
   * @param {object} cotizacionAprobada - Cotización aprobada
   * @param {{ isUpdate: boolean, existingProjectId?: number, existingProject?: object }} options
   */
  const handleCreateOrUpdateProjectFromQuote = async (cotizacionAprobada, options = {}) => {
    const { isUpdate, existingProjectId, existingProject } = options;
    // Tarea 3: guardia dura. Nunca crear/actualizar un proyecto sin cliente real.
    if (cotizacionAprobada?.cliente_id == null) {
      toast({ variant: 'destructive', title: 'Cliente requerido', description: 'No se puede generar el proyecto sin un cliente real.' });
      return null;
    }
    const payload = buildProjectPayloadFromQuote(cotizacionAprobada);

    if (isUpdate && existingProjectId != null) {
      const { data: updatedProject, error: updateError } = await supabase
        .from('proyectos')
        .update(payload)
        .eq('id', existingProjectId)
        .select()
        .single();
      if (updateError) {
        toast({ variant: 'destructive', title: 'Error al actualizar proyecto', description: updateError.message });
        return null;
      }
      console.log('Proyecto actualizado con la nueva versión de la cotización');
      return updatedProject;
    }

    // INSERT: nuevo proyecto
    const { data: lastProject, error: fetchError } = await supabase
      .from('proyectos')
      .select('folio')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio del proyecto.' });
      return null;
    }

    const nextFolioNumber = lastProject ? parseInt(lastProject.folio.split('-')[2], 10) + 1 : 1;
    const currentYear = new Date().getFullYear();
    const newFolio = `PRJ-${currentYear}-${String(nextFolioNumber).padStart(4, '0')}`;

    const insertPayload = {
      folio: newFolio,
      ...payload,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
      estatus: 'Por Iniciar',
      avance: 0,
      prioridad: 'Media',
    };
    const { data: newProject, error: createError } = await supabase.from('proyectos').insert(insertPayload).select().single();

    if (createError) {
      toast({ variant: 'destructive', title: 'Error al crear proyecto', description: createError.message });
      return null;
    }
    return newProject;
  };

  const handleCreateProjectFromQuote = async (cotizacionAprobada) => {
    return handleCreateOrUpdateProjectFromQuote(cotizacionAprobada, { isUpdate: false });
  };

  const handleStatusChange = async (id, estatus) => {
    // Tarea 3: la aprobación SIEMPRE pasa por ApproveQuoteModal (resuelve cliente y crea proyecto
    // con la guardia de cliente real). Evitamos un atajo que apruebe/genere proyecto sin cliente.
    if (estatus === 'Aprobada') {
      const cotizacion = cotizaciones.find(c => c.id === id);
      if (cotizacion) {
        setQuoteToApprove(cotizacion);
        setApproveQuoteModalOpen(true);
      }
      return;
    }
    const { error } = await supabase.from('cotizaciones').update({ estatus }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus.' });
    } else {
      toast({ title: `✅ Estatus Actualizado`, description: `La cotización ahora está ${estatus}.` });
      await fetchCotizaciones();
    }
  };

  const notifyAndToastProjectCreated = async (cotizacionAprobada, nuevoProyecto) => {
    let clienteNombre = cotizacionAprobada?.cliente_nombre || cotizacionAprobada?.cliente?.nombre || cotizacionAprobada?.cliente_nombre_externo || 'Sin cliente';
    if (nuevoProyecto.cliente_id) {
      const { data: clienteData } = await supabase.from('clientes').select('nombre').eq('id', nuevoProyecto.cliente_id).single();
      if (clienteData) clienteNombre = clienteData.nombre;
    } else if (nuevoProyecto.cliente_nombre_externo) {
      clienteNombre = nuevoProyecto.cliente_nombre_externo;
    }
    notifyCotizacionAprobada({
      projectData: { folio: nuevoProyecto.folio, descripcion: nuevoProyecto.descripcion, cliente_nombre: clienteNombre, cotizacion_folio: cotizacionAprobada.folio },
      quoteData: { folio: cotizacionAprobada.folio, descripcion: cotizacionAprobada.descripcion },
    });
    toast({
      title: '🎉 ¡Proyecto Creado!',
      description: `El proyecto ${nuevoProyecto.folio} se ha creado desde la cotización.`,
      action: <Button variant="outline" size="sm" onClick={() => navigate(`${proyectosBase}/${nuevoProyecto.id}`)}>Ver Proyecto <ArrowRight className="w-4 h-4 ml-2"/></Button>
    });
  };

  const handleConfirmApproval = async ({ cotizacionResuelta, isDirty }) => {
    const id = cotizacionResuelta.id;
    // Tarea 3: guardia en capa de datos. No se aprueba ni se crea proyecto sin cliente real.
    if (cotizacionResuelta.cliente_id == null) {
      toast({ variant: 'destructive', title: 'Cliente requerido', description: 'Asigna un cliente real antes de aprobar la cotización.' });
      throw new Error('Aprobación bloqueada: cotización sin cliente_id');
    }
    if (isDirty) {
      const { error: updateErr } = await supabase.from('cotizaciones').update({
        cliente_id: cotizacionResuelta.cliente_id,
        cliente_nombre_externo: cotizacionResuelta.cliente_nombre_externo,
        aplica_iva: cotizacionResuelta.aplica_iva,
        total: cotizacionResuelta.total,
        estatus: 'Aprobada',
      }).eq('id', id);
      if (updateErr) {
        toast({ variant: 'destructive', title: 'Error', description: updateErr.message });
        throw updateErr;
      }
    } else {
      const { error: statusErr } = await supabase.from('cotizaciones').update({ estatus: 'Aprobada' }).eq('id', id);
      if (statusErr) {
        toast({ variant: 'destructive', title: 'Error', description: statusErr.message });
        throw statusErr;
      }
    }

    // FASE 1: Detección de proyecto existente (misma familia de cotización)
    const existingProject = await findExistingProjectForQuote(cotizacionResuelta.folio);
    if (existingProject) {
      setPendingApprovalData({ cotizacionResuelta, isDirty, existingProject });
      setApproveQuoteModalOpen(false);
      setShowUpdateModal(true);
      await fetchCotizaciones();
      return;
    }

    const nuevoProyecto = await handleCreateProjectFromQuote(cotizacionResuelta);
    if (nuevoProyecto) await notifyAndToastProjectCreated(cotizacionResuelta, nuevoProyecto);
    await fetchCotizaciones();
  };

  const handleAcceptUpdateExistingProject = async () => {
    if (!pendingApprovalData) return;
    const { cotizacionResuelta, existingProject } = pendingApprovalData;
    const updated = await handleCreateOrUpdateProjectFromQuote(cotizacionResuelta, {
      isUpdate: true,
      existingProjectId: existingProject.id,
      existingProject,
    });
    setShowUpdateModal(false);
    setPendingApprovalData(null);
    if (updated) {
      toast({
        title: '✅ Proyecto actualizado correctamente',
        description: `El proyecto ${updated.folio} se actualizó con la cotización ${cotizacionResuelta.folio}.`,
        action: <Button variant="outline" size="sm" onClick={() => navigate(`${proyectosBase}/${updated.id}`)}>Ver Proyecto <ArrowRight className="w-4 h-4 ml-2" /></Button>,
      });
      await fetchCotizaciones();
    }
  };

  const handleEdit = (cotizacion) => {
    setInitialTemplate(null);
    setSelectedCotizacion(cotizacion);
    setDialogOpen(true);
  };

  const handleCrearNuevaVersion = async (c) => {
    try {
      const versionActual = (c.version ?? 1);
      const nuevaVersion = versionActual + 1;
      const baseFolio = (c.folio || '').replace(/-V\d+$/, '');
      const nuevoFolio = `${baseFolio}-V${nuevaVersion}`;
      const { data: nuevaCotizacion, error: insertErr } = await supabase
        .from('cotizaciones')
        .insert({
          folio: nuevoFolio,
          version: nuevaVersion,
          cotizacion_padre_id: c.id,
          es_ultima_version: true,
          cliente_id: c.cliente_id,
          cliente_nombre_externo: c.cliente_nombre_externo,
          descripcion: c.descripcion,
          fecha: new Date().toISOString().split('T')[0],
          total: c.total,
          aplica_iva: c.aplica_iva !== false,
          descuento_porcentaje: c.descuento_porcentaje ?? 0,
          descuento_monto: c.descuento_monto ?? 0,
          branding: c.branding ?? 'iihemsa',
          estatus: 'Borrador',
          cotizacion_control: c.cotizacion_control,
          usuario_cotizacion: c.usuario_cotizacion,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const { data: itemsData, error: itemsErr } = await supabase
        .from('cotizaciones_items')
        .select('*')
        .eq('cotizacion_id', c.id);
      if (itemsErr) throw itemsErr;
      const items = itemsData || [];
      if (items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          cotizacion_id: nuevaCotizacion.id,
          descripcion: item.descripcion,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          unidad: item.unidad,
          observaciones: item.observaciones,
        }));
        const { error: insItemsErr } = await supabase.from('cotizaciones_items').insert(itemsToInsert);
        if (insItemsErr) throw insItemsErr;
      }

      await supabase
        .from('cotizaciones')
        .update({ es_ultima_version: false, estatus: 'Historial' })
        .eq('id', c.id);

      toast({ title: '✅ Nueva versión creada', description: `Se abrirá la cotización ${nuevoFolio} para editar.` });
      await fetchCotizaciones();
      setSelectedCotizacion(nuevaCotizacion);
      setDialogOpen(true);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al crear nueva versión', description: err.message });
    }
  };

  const handleDuplicarComoPlantilla = (c) => {
    setInitialTemplate(c);
    setSelectedCotizacion(null);
    setDialogOpen(true);
  };

  const handlePrint = (cotizacion) => {
    setSelectedCotizacion(cotizacion);
    setPrintDialogOpen(true);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la cotización.' });
    } else {
      await fetchCotizaciones();
      toast({ title: '🗑️ Cotización Eliminada' });
    }
  };

  const updateQuoteClient = async (cotizacionId, newClienteId, newClienteNombreExterno = null) => {
    const { error: errCot } = await supabase.from('cotizaciones').update({
      cliente_id: newClienteId,
      cliente_nombre_externo: newClienteNombreExterno,
    }).eq('id', cotizacionId);
    if (errCot) return { error: errCot };
    const { data: proy } = await supabase.from('proyectos').select('id').eq('cotizacion_id', cotizacionId).maybeSingle();
    if (proy) {
      const { error: errProy } = await supabase.from('proyectos').update({
        cliente_id: newClienteId,
        cliente_nombre_externo: newClienteNombreExterno,
      }).eq('id', proy.id);
      if (errProy) return { error: errProy };
    }
    return { error: null };
  };

  const filteredCotizaciones = useMemo(() => {
    let result = cotizaciones.filter(c => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch =
        c.folio?.toLowerCase().includes(searchLower) ||
        c.cliente_nombre?.toLowerCase().includes(searchLower) ||
        c.cotizacion_control?.toLowerCase().includes(searchLower) ||
        c.descripcion?.toLowerCase().includes(searchLower) ||
        c.usuario_cotizacion?.toLowerCase().includes(searchLower);
      const matchStatus = filterStatus === 'Todos' || c.estatus === filterStatus;
      const matchMarca = filterMarca === 'Todos' || c.marca_comercial === filterMarca;
      const matchEmpresa = filterEmpresa === 'Todos' || c.branding === filterEmpresa;
      return matchSearch && matchStatus && matchMarca && matchEmpresa;
    });
    result = [...result].sort((a, b) => {
      const da = new Date(a.fecha + 'T00:00:00').getTime();
      const db = new Date(b.fecha + 'T00:00:00').getTime();
      return filterFechaOrden === 'asc' ? da - db : db - da;
    });
    return result;
  }, [cotizaciones, searchTerm, filterStatus, filterMarca, filterEmpresa, filterFechaOrden]);

  // Menú de acciones por cotización — reutilizado en tabla (web) y tarjetas (móvil)
  const renderAccionesCotizacion = (c) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => handlePrint(c)}>
          <Printer className="mr-2 h-4 w-4 text-amber-600" /> Imprimir
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { setQuoteToApprove(c); setApproveQuoteModalOpen(true); }} disabled={c.estatus === 'Aprobada'}>
          <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Aprobar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleStatusChange(c.id, 'Rechazada')} disabled={c.estatus === 'Rechazada'}>
          <XCircle className="mr-2 h-4 w-4 text-red-500" /> Rechazar
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Edit className="mr-2 h-4 w-4" /> Editar / Versiones
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onSelect={() => handleEdit(c)}>
              <Edit className="mr-2 h-4 w-4" /> Corregir (Sobrescribir)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleCrearNuevaVersion(c)}>
              <RotateCcw className="mr-2 h-4 w-4" /> Crear Nueva Versión
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleDuplicarComoPlantilla(c)}>
              <Copy className="mr-2 h-4 w-4" /> Duplicar (Como Plantilla)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => { setCotizacionParaHistorial(c); setHistorialOpen(true); }}>
          <History className="mr-2 h-4 w-4" /> Ver Historial de Versiones
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => { setCotizacionToChangeClient(c); setChangeClientDialogOpen(true); }}>
          <User className="mr-2 h-4 w-4" /> Cambiar cliente
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleDelete(c.id)} className="text-red-600">
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <Helmet>
        <title>Cotizaciones - IIHEMSA Peninsular</title>
        <meta name="description" content="Gestión de cotizaciones y propuestas comerciales" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cotizaciones</h2>
            <p className="text-gray-600 mt-1">Crea y gestiona tus propuestas comerciales</p>
          </div>
        </div>
        
        <Tabs defaultValue="cotizaciones" className="w-full">
            <div className="overflow-x-auto">
            <TabsList className="w-full md:w-auto grid w-full grid-cols-2 md:inline-flex">
                <TabsTrigger value="cotizaciones">Cotizaciones</TabsTrigger>
                <TabsTrigger value="catalogo">Catálogo de Servicios</TabsTrigger>
            </TabsList>
            </div>

            <TabsContent value="cotizaciones" className="space-y-6 mt-6">
                <div className="flex justify-end gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        onClick={() => setMostrarCalculadoraBeta(true)}
                        className="gap-2"
                    >
                        🧪 Test Calculadora (Beta)
                    </Button>
                    <Button
                        onClick={() => {
                        setSelectedCotizacion(null);
                        setDialogOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cotización
                    </Button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
                    <div className="relative w-full sm:flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar por folio, cliente, usuario o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto gap-2">
                            <Filter className="w-4 h-4" />
                            {filterStatus}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {['Todos', 'Borrador', 'Enviada', 'Aprobada', 'Rechazada'].map(status => (
                            <DropdownMenuItem key={status} onSelect={() => setFilterStatus(status)}>
                              {status}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div>
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                    ) : filteredCotizaciones.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            <h3 className="text-lg font-medium">No hay cotizaciones aún</h3>
                            <p className="text-sm mt-1">Crea tu primera cotización para empezar.</p>
                        </div>
                    ) : (
                      <>
                        {/* MÓVIL — tarjetas */}
                        <div className="sm:hidden divide-y divide-gray-200">
                          {filteredCotizaciones.map((c) => {
                            const marca = (MARCAS_COMERCIALES.find(m => m.id === c.marca_comercial)?.nombre ?? c.marca_comercial ?? '—').toUpperCase();
                            const empresa = BRANDINGS.find(b => b.id === c.branding)?.nombre ?? c.branding ?? '—';
                            const proy = proyectosPorCotizacion[c.id];
                            return (
                              <div key={c.id} onClick={() => handleEdit(c)} className="p-4 cursor-pointer active:bg-gray-50">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-mono text-sm text-blue-600">{c.folio}</p>
                                    {c.cotizacion_control && <p className="text-[11px] text-gray-500 font-mono">Control: {c.cotizacion_control}</p>}
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <EstatusBadge estatus={c.estatus} />
                                    {renderAccionesCotizacion(c)}
                                  </div>
                                </div>
                                <p className="mt-2 font-medium text-gray-900 break-words">{c.cliente_nombre}</p>
                                {c.descripcion && <p className="text-sm text-gray-500 break-words">{c.descripcion}</p>}
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-gray-900">{c.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</span>
                                  <span className="text-xs text-gray-500">{formatDateTable(c.fecha)}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                                  <span className="text-gray-500 break-words">{marca} · {empresa}</span>
                                  {proy ? (
                                    <Link to={`${proyectosBase}/${proy.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-blue-600 hover:underline shrink-0">
                                      {proy.folio}
                                    </Link>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* ESCRITORIO — tabla */}
                        <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proyecto</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center gap-1">
                                <span>Marca / Empresa</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className={`inline-flex items-center rounded p-0.5 hover:bg-gray-200 transition-colors ${filterMarca !== 'Todos' || filterEmpresa !== 'Todos' ? 'text-blue-600' : 'text-gray-400'}`}>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-48">
                                    <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase">Marca</div>
                                    <DropdownMenuItem onSelect={() => setFilterMarca('Todos')} className={filterMarca === 'Todos' ? 'font-semibold text-blue-600' : ''}>
                                      Todas
                                    </DropdownMenuItem>
                                    {MARCAS_COMERCIALES.map(m => (
                                      <DropdownMenuItem key={m.id} onSelect={() => setFilterMarca(m.id)} className={filterMarca === m.id ? 'font-semibold text-blue-600' : ''}>
                                        {m.nombre}
                                      </DropdownMenuItem>
                                    ))}
                                    <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-gray-400 uppercase border-t">Empresa emisora</div>
                                    <DropdownMenuItem onSelect={() => setFilterEmpresa('Todos')} className={filterEmpresa === 'Todos' ? 'font-semibold text-blue-600' : ''}>
                                      Todas
                                    </DropdownMenuItem>
                                    {BRANDINGS.map(b => (
                                      <DropdownMenuItem key={b.id} onSelect={() => setFilterEmpresa(b.id)} className={filterEmpresa === b.id ? 'font-semibold text-blue-600' : ''}>
                                        {b.nombre}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Descripción</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center gap-1">
                                <span>Fecha</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="inline-flex items-center rounded p-0.5 hover:bg-gray-200 transition-colors text-gray-400">
                                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterFechaOrden === 'asc' ? 'rotate-180' : ''}`} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-40">
                                    <DropdownMenuItem onSelect={() => setFilterFechaOrden('desc')} className={filterFechaOrden === 'desc' ? 'font-semibold text-blue-600' : ''}>
                                      Más reciente primero
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => setFilterFechaOrden('asc')} className={filterFechaOrden === 'asc' ? 'font-semibold text-blue-600' : ''}>
                                      Más antigua primero
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <div className="flex items-center gap-1">
                                <span>Estatus</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className={`inline-flex items-center rounded p-0.5 hover:bg-gray-200 transition-colors ${filterStatus !== 'Todos' ? 'text-blue-600' : 'text-gray-400'}`}>
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-40">
                                    {['Todos', 'Borrador', 'Enviada', 'Aprobada', 'Rechazada'].map(s => (
                                      <DropdownMenuItem key={s} onSelect={() => setFilterStatus(s)} className={filterStatus === s ? 'font-semibold text-blue-600' : ''}>
                                        {s === 'Todos' ? 'Todos los estatus' : s}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredCotizaciones.map((c, index) => (
                            <motion.tr
                                key={c.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                onClick={() => handleEdit(c)}
                                className="hover:bg-gray-50 transition-colors cursor-pointer"
                            >
                                <td className="px-6 py-4">
                                    <p className="font-mono text-sm text-blue-600">{c.folio}</p>
                                    {c.cotizacion_control && <p className="text-xs text-gray-500 font-mono">Control: {c.cotizacion_control}</p>}
                                </td>
                                <td className="px-6 py-4">
                                    {proyectosPorCotizacion[c.id] ? (
                                        <Link
                                            to={`${proyectosBase}/${proyectosPorCotizacion[c.id].id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                        >
                                            {proyectosPorCotizacion[c.id].folio}
                                        </Link>
                                    ) : (
                                        <span className="text-sm text-gray-400">—</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <p className="font-semibold text-sm text-gray-900">
                                    {(MARCAS_COMERCIALES.find(m => m.id === c.marca_comercial)?.nombre ?? c.marca_comercial ?? '—').toUpperCase()}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {BRANDINGS.find(b => b.id === c.branding)?.nombre ?? c.branding ?? '—'}
                                  </p>
                                </td>
                                <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">{c.cliente_nombre}</p>
                                <p className="text-sm text-gray-500">{c.descripcion}</p>
                                {c.usuario_cotizacion && (
                                    <div className="flex items-center mt-1 text-xs text-gray-500">
                                        <User className="w-3 h-3 mr-1.5" />
                                        <span>{c.usuario_cotizacion}</span>
                                    </div>
                                )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{formatDateTable(c.fecha)}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                {c.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                </td>
                                <td className="px-6 py-4"><EstatusBadge estatus={c.estatus} /></td>
                                <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                    {renderAccionesCotizacion(c)}
                                </div>
                                </td>
                            </motion.tr>
                            ))}
                        </tbody>
                        </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>
            </TabsContent>
            
            <TabsContent value="catalogo" className="mt-6">
                <CatalogoServicios />
            </TabsContent>
        </Tabs>
      </div>

      <CotizacionDialog
        open={dialogOpen}
        onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setInitialTemplate(null);
        }}
        cotizacion={selectedCotizacion}
        initialTemplate={initialTemplate}
        onSave={() => {
            fetchCotizaciones();
            setDialogOpen(false);
            setInitialTemplate(null);
        }}
      />
      
      <SeleccionarFormatoCotizacionDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        cotizacion={selectedCotizacion}
      />
      <CambiarClienteCotizacionDialog
        open={changeClientDialogOpen}
        onOpenChange={setChangeClientDialogOpen}
        cotizacion={cotizacionToChangeClient}
        onSuccess={async (cotizacionId, newClienteId, newClienteNombreExterno) => {
          const result = await updateQuoteClient(cotizacionId, newClienteId, newClienteNombreExterno);
          if (result.error) {
            toast({ variant: 'destructive', title: 'Error', description: result.error.message });
          } else {
            toast({ title: '✅ Cliente actualizado en cotización y proyecto' });
            fetchCotizaciones();
          }
          return result;
        }}
      />
      <ApproveQuoteModal
        open={approveQuoteModalOpen}
        onOpenChange={(open) => { setApproveQuoteModalOpen(open); if (!open) setQuoteToApprove(null); }}
        quote={quoteToApprove}
        onConfirmApproval={handleConfirmApproval}
      />

      {/* FASE 2: Modal "Proyecto Existente Detectado" — actualizar en lugar de duplicar */}
      <Dialog open={showUpdateModal} onOpenChange={(open) => { if (!open) { setShowUpdateModal(false); setPendingApprovalData(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Proyecto Existente Detectado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Cotización actualizada a <strong>{pendingApprovalData?.cotizacionResuelta?.folio ?? ''}</strong>. Tiene un proyecto relacionado. Se realizarán modificaciones en el proyecto.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => { setShowUpdateModal(false); setPendingApprovalData(null); }}
            >
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleAcceptUpdateExistingProject}
            >
              Aceptar y Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <HistorialVersionesModal
        open={historialOpen}
        onOpenChange={setHistorialOpen}
        cotizacion={cotizacionParaHistorial}
      />

      <Dialog open={mostrarCalculadoraBeta} onOpenChange={setMostrarCalculadoraBeta}>
        <DialogContent className="max-w-6xl w-[96vw] p-0">
          <DialogTitle className="sr-only">Calculadora de Partida</DialogTitle>
          <DialogDescription className="sr-only">Calcula los costos de producción</DialogDescription>
          <CalculadoraPartida onClose={() => setMostrarCalculadoraBeta(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Cotizaciones;