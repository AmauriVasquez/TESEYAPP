import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useProyectosPathPrefix } from '@/hooks/useProyectosPathPrefix';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, FileDown, Mail, PackagePlus, Pencil, AlertCircle, CheckCircle, Upload, Trash2, ShoppingCart, Loader2, File as FileIcon, Download, Image as ImageIcon, Check, User, CalendarDays, Truck, DollarSign, Edit, Save, X, Star, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { EstatusBadge, estatusWorkflowOptions, faseOptions } from '@/config/proyectosConfig.jsx';
import { ESTATUS_WORKFLOW } from '@/config/projectConstants';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { notifyBitacoraUpdate, notifyStatusChange, notifyProjectFinishedOrDelivered } from '@/services/TelegramService';
import RegistrarAprobacionDialog from '@/components/proyectos/RegistrarAprobacionDialog';
import EntregaModal, { mapEntregaItemRow } from '@/components/EntregaModal';
import EntregaHistorial from '@/components/EntregaHistorial';
import { useEntregaItems } from '@/hooks/useEntregaItems';
import RegistrarPagoDialog from '@/components/proyectos/RegistrarPagoDialog';
import RegistrarFacturaDialog from '@/components/finanzas/RegistrarFacturaDialog';
import AsignarResponsableDialog from '@/components/proyectos/AsignarResponsableDialog';
import ProjectDatesModal from '@/components/proyectos/ProjectDatesModal';
import ComprobanteIngreso from '@/components/finanzas/ComprobanteIngreso';
import NuevoPedidoDialog from '@/components/pedidos/NuevoPedidoDialog';
import SeleccionarFormatoCotizacionDialog from '@/components/cotizaciones/SeleccionarFormatoCotizacionDialog';
import { renderToStaticMarkup } from 'react-dom/server';
import FormatoCotizacionTESEY from '@/components/formatos/FormatoCotizacionTESEY';
import FormatoReporteEntrega from '@/components/formatos/FormatoReporteEntrega';
import { getDatosReporteEntrega } from '@/lib/reporteEntregaData';
import { imprimirDocumentoCombinado } from '@/lib/printCombined';
import { getMarcaColores } from '@/lib/brandingConfig';
import { cn } from '@/lib/utils';
import { uploadBitacoraImage } from '@/lib/bitacoraUpload';
import { format, parseISO } from 'date-fns';
import { formatDateTable } from '@/lib/dateUtils';
import { syncProyectoEvento, eliminarEvento } from '@/lib/calendarApi';
import { fetchPedidoMaterialesByIdCompat } from '@/lib/supabasePedidosCompat';
import { unidadImpresionPedidoItem, descripcionImpresionPedidoItem } from '@/lib/pedidoMaterialesItemHelpers';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const prioridadOptions = [
    { value: 'Alta', label: 'Alta' },
    { value: 'Media', label: 'Media' },
    { value: 'Baja', label: 'Baja' },
];

const BITACORA_TIPO_BADGE = {
  general: 'bg-gray-100 text-gray-700',
  entrega: 'bg-green-100 text-green-700',
  incidencia: 'bg-red-100 text-red-700',
};

function bitacoraTipoNormalizado(tipo) {
  if (tipo === 'entrega' || tipo === 'incidencia') return tipo;
  return 'general';
}

function bitacoraTipoEtiqueta(tipo) {
  const t = bitacoraTipoNormalizado(tipo);
  if (t === 'entrega') return 'Entrega';
  if (t === 'incidencia') return 'Incidencia';
  return 'Comentario';
}

const MaterialStatusIndicator = ({ materiales }) => {
    const materialesFaltantes = useMemo(() => 
        materiales && materiales.some(m => m.cant > m.stock),
        [materiales]
    );

    if (!materiales || materiales.length === 0) {
        return <span className="flex items-center gap-1.5 text-sm text-gray-500 font-medium"><CheckCircle className="w-4 h-4 text-gray-400" />Sin Materiales</span>;
    }

    if (materialesFaltantes) {
        return (
            <span className="flex items-center gap-1.5 text-sm text-red-600 font-medium">
                <AlertCircle className="w-4 h-4" />
                Materiales Faltantes
            </span>
        );
    }

    return (
        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <CheckCircle className="w-4 h-4" />
            Materiales en Stock
        </span>
    );
};

const ProyectoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const proyectosListPath = useProyectosPathPrefix();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [proyecto, setProyecto] = useState(null);
  const [comentario, setComentario] = useState('');
  const [bitacora, setBitacora] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [aprobaciones, setAprobaciones] = useState([]);
  const [entregaHistorialNonce, setEntregaHistorialNonce] = useState(0);
  const [pagos, setPagos] = useState([]);
  const [gastosProyecto, setGastosProyecto] = useState([]);
  const [pedidosProyecto, setPedidosProyecto] = useState([]);
  
  const [bitacoraLoading, setBitacoraLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false);
  const [pedidoGuardado, setPedidoGuardado] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [previewOrderLoading, setPreviewOrderLoading] = useState(false);

  const [addAprobacionDialogOpen, setAddAprobacionDialogOpen] = useState(false);
  const [addEntregaDialogOpen, setAddEntregaDialogOpen] = useState(false);
  const [addPagoDialogOpen, setAddPagoDialogOpen] = useState(false);
  const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
  const [pagoEnEdicion, setPagoEnEdicion] = useState(null);

  // Deep-link al control financiero: navegar con state.scrollToPagos hace scroll
  // a la tarjeta "Control Financiero" una vez cargado el proyecto.
  useEffect(() => {
    if (loading || !location.state?.scrollToPagos) return;
    const raf = requestAnimationFrame(() => {
      document.getElementById('seccion-pagos')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    // Limpiar el state para que no vuelva a hacer scroll al re-render
    navigate(location.pathname, { replace: true, state: {} });
    return () => cancelAnimationFrame(raf);
  }, [loading, location.state, location.pathname, navigate]);
  const [comprobantePago, setComprobantePago] = useState(null);
  const [asignarResponsableOpen, setAsignarResponsableOpen] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [newPriority, setNewPriority] = useState('');
  const [bitacoraFile, setBitacoraFile] = useState(null);
  const [bitacoraPreview, setBitacoraPreview] = useState(null);
  const [bitacoraTipo, setBitacoraTipo] = useState('general');
  const [bitacoraFiltro, setBitacoraFiltro] = useState('todos');
  const [bitacoraEntregaId, setBitacoraEntregaId] = useState('');
  const [entregasBitacora, setEntregasBitacora] = useState([]);
  const [datesModalOpen, setDatesModalOpen] = useState(false);
  const [pendingNuevoEstatus, setPendingNuevoEstatus] = useState(null);
  const [pendingConfirmEstatus, setPendingConfirmEstatus] = useState(null);
  const [datesModalSubmitting, setDatesModalSubmitting] = useState(false);
  const [showQuotePreview, setShowQuotePreview] = useState(false);
  const [imprimiendoReporte, setImprimiendoReporte] = useState(false);

  const bitacoraFileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (bitacoraPreview) URL.revokeObjectURL(bitacoraPreview);
    };
  }, [bitacoraPreview]);
  const archivosProyectoInputRef = useRef(null);
  
  const isTerminadoOEntregado = proyecto?.estatus === 'Terminado' || proyecto?.estatus === 'Entregado';

  /** Cierre lógico de entregas (estatus o campo `estado` persistente en `proyectos`). */
  const entregasTotalesCerradas = useMemo(
    () => proyecto?.estatus === 'Entregado' || proyecto?.estado === 'entregado',
    [proyecto?.estatus, proyecto?.estado]
  );

  useEffect(() => {
    if (entregasTotalesCerradas) setAddEntregaDialogOpen(false);
  }, [entregasTotalesCerradas]);

  /** Genera un solo PDF: cotización + anexo de reporte de entrega consolidado. */
  const handleImprimirCotizacionEntrega = useCallback(async () => {
    if (imprimiendoReporte) return;
    const cotizacionId = proyecto?.cotizacion_id;
    if (!cotizacionId) {
      toast({ variant: 'destructive', title: 'Sin cotización', description: 'El proyecto no tiene cotización vinculada.' });
      return;
    }
    setImprimiendoReporte(true);
    try {
      const datos = await getDatosReporteEntrega({ proyectoId: id, cotizacionId });
      if (datos.sinEntregas) {
        toast({ variant: 'destructive', title: 'Sin entregas', description: 'Este proyecto no tiene entregas registradas en el sistema actual.' });
        return;
      }
      const marca = datos.cotizacion?.marca_comercial || datos.cotizacion?.branding || 'tesey';
      const extraerRoot = (markup, selector) => {
        const doc = new DOMParser().parseFromString(markup, 'text/html');
        return doc.querySelector(selector)?.outerHTML ?? markup;
      };
      const cotHTML = extraerRoot(
        renderToStaticMarkup(<FormatoCotizacionTESEY cotizacionData={datos.cotizacion} hidePrintButton />),
        '.print-doc-root'
      );
      const repHTML = extraerRoot(
        renderToStaticMarkup(<FormatoReporteEntrega datos={datos} />),
        '.report-entrega-root'
      );
      const ok = await imprimirDocumentoCombinado({
        bloquesHTML: [cotHTML, repHTML],
        titulo: `Cotización y entrega ${datos.cotizacion?.folio || ''}`.trim(),
        cssVars: getMarcaColores(marca),
      });
      if (ok === false) {
        toast({ variant: 'destructive', title: 'Popup bloqueado', description: 'Permite ventanas emergentes para generar el PDF.' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo generar el reporte.' });
    } finally {
      setImprimiendoReporte(false);
    }
  }, [imprimiendoReporte, proyecto?.cotizacion_id, id, toast]);

  const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
  };

  const fetchProyectoData = useCallback(async (isUpdate = false) => {
    if(!isUpdate) setLoading(true);
    try {
        const { data: proyectoData, error: proyectoError } = await supabase.from('proyectos').select('*, cliente:cliente_id(nombre), responsable:responsable_id(nombre_completo), cotizacion:cotizacion_id(total, branding)').eq('id', id).single();
        if (proyectoError) throw proyectoError;

        const { data: bitacoraRawData, error: bitacoraError } = await supabase.from('proyecto_bitacora').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (bitacoraError) throw bitacoraError;

        const { data: entregasBitData } = await supabase
          .from('entregas')
          .select('id, fecha, recibe_nombre')
          .eq('proyecto_id', id)
          .order('fecha', { ascending: false });
        setEntregasBitacora(entregasBitData || []);
        const bitacoraUserIds = [...new Set(bitacoraRawData.map(b => b.usuario_id))].filter(Boolean);

        const { data: aprobacionesRawData, error: aprobacionesError } = await supabase.from('proyecto_aprobaciones').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (aprobacionesError) throw aprobacionesError;
        const aprobacionesUserIds = [...new Set(aprobacionesRawData.map(a => a.usuario_id))].filter(Boolean);
        
        const allUserIds = [...new Set([...bitacoraUserIds, ...aprobacionesUserIds])];
        let usersMap = {};
        if (allUserIds.length > 0) {
            const { data: usersData, error: usersError } = await supabase.from('usuarios').select('id, nombre_completo').in('id', allUserIds);
            if (usersError) throw usersError;
            usersMap = usersData.reduce((acc, u) => ({ ...acc, [u.id]: u.nombre_completo }), {});
        }

        const bitacoraData = bitacoraRawData.map(b => ({ ...b, usuario: { nombre_completo: usersMap[b.usuario_id] || 'Usuario desconocido' } }));
        const aprobacionesData = aprobacionesRawData.map(a => ({...a, usuario: { nombre_completo: usersMap[a.usuario_id] || 'Usuario desconocido' }}));

        const { data: archivosData, error: archivosError } = await supabase.from('proyecto_archivos').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (archivosError) throw archivosError;

        const { data: materialesData, error: materialesError } = await supabase.from('proyecto_materiales').select('*, material:material_id(*)').eq('proyecto_id', id);
        if (materialesError) throw materialesError;

        const { data: pagosData, error: pagosError } = await supabase.from('proyecto_pagos').select('*').eq('proyecto_id', id).order('fecha_pago', { ascending: false });
        if (pagosError) throw pagosError;

        const { data: gastosData } = await supabase.from('finanzas_gastos').select('*').eq('proyecto_id', id).order('fecha', { ascending: false });
        setGastosProyecto(gastosData || []);

        const { data: pedidosData, error: pedidosError } = await supabase
          .from('pedidos_materiales')
          .select('id, folio, fecha, estatus')
          .eq('proyecto_id', id)
          .order('id', { ascending: false });
        if (!pedidosError) setPedidosProyecto(pedidosData || []);
        
        const stepAvance = ESTATUS_WORKFLOW.find(s => s.nombre === proyectoData.estatus);
        const avance = stepAvance?.avance != null ? stepAvance.avance : 0;
        setProyecto({
            ...proyectoData,
            cliente: proyectoData.cliente?.nombre || proyectoData.cliente_nombre_externo,
            responsable: proyectoData.responsable?.nombre_completo,
            avance,
            costo_total: proyectoData.cotizacion?.total || 0,
        });
        setNewPriority(proyectoData.prioridad);
        setBitacora(bitacoraData);
        setArchivos(archivosData);
        setMateriales(materialesData);
        setAprobaciones(aprobacionesData);
        setPagos(pagosData);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el proyecto.' });
      console.error('Error fetching project data:', error);
      navigate(proyectosListPath);
    } finally {
      if(!isUpdate) setLoading(false);
    }
  }, [id, navigate, proyectosListPath, toast]);

  useEffect(() => {
    fetchProyectoData();
  }, [fetchProyectoData]);

  const { items: entregaItemsRpc, loading: entregaItemsLoading, refetch: refetchEntregaItems } = useEntregaItems(
    proyecto?.cotizacion_id ?? null
  );

  const entregaCompleto = useMemo(() => {
    const cid = proyecto?.cotizacion_id;
    if (!cid) return true;
    const rows = (entregaItemsRpc ?? []).map(mapEntregaItemRow);
    if (rows.length === 0) return true;
    return rows.every((r) => Number(r.pendiente) <= 0);
  }, [proyecto?.cotizacion_id, entregaItemsRpc]);

  const bitacoraFiltrada = useMemo(() => {
    if (bitacoraFiltro === 'todos') return bitacora;
    return bitacora.filter((i) => bitacoraTipoNormalizado(i.tipo) === bitacoraFiltro);
  }, [bitacora, bitacoraFiltro]);

  const requestEstatusChange = (nuevoEstatus) => {
    if (!nuevoEstatus || nuevoEstatus === proyecto?.estatus) return;
    setPendingConfirmEstatus(nuevoEstatus);
  };

  const updateEstatus = async (nuevoEstatus) => {
    if (proyecto?.estatus === 'Por Iniciar' && nuevoEstatus !== 'Por Iniciar') {
      setPendingNuevoEstatus(nuevoEstatus);
      setDatesModalOpen(true);
      return;
    }
    await applyEstatusUpdate(nuevoEstatus, null);
  };

  const applyEstatusUpdate = async (nuevoEstatus, fechasPayload) => {
    const estatusAnterior = proyecto?.estatus;
    const stepAvance = ESTATUS_WORKFLOW.find(s => s.nombre === nuevoEstatus);
    const esTerminadoOEntregado = nuevoEstatus === 'Terminado' || nuevoEstatus === 'Entregado';

    if (esTerminadoOEntregado && proyecto?.google_calendar_event_id) {
      try {
        await eliminarEvento(proyecto.google_calendar_event_id);
      } catch (err) {
        console.error('⚠️ No se pudo eliminar el evento de Google Calendar:', err);
      }
    }

    const baseUpdates = {
      estatus: nuevoEstatus,
      ...(stepAvance?.avance != null && { avance: stepAvance.avance }),
      ...(esTerminadoOEntregado && { google_calendar_event_id: null }),
    };

    // Flujo con modal de fechas: primero Calendar, luego un solo update en Supabase
    if (fechasPayload) {
      const fecha_inicio = fechasPayload.fecha_inicio;
      const fecha_fin = fechasPayload.fecha_fin;

      // 1. Preparación del payload para el backend de Calendar (google_calendar_event_id es clave para actualizar evento existente)
      const proyectoParaCalendar = {
        id: proyecto?.id,
        folio: proyecto?.folio,
        descripcion: proyecto?.descripcion || proyecto?.cliente_nombre_externo || proyecto?.cliente || 'Sin descripción',
        fecha_inicio,
        fecha_fin,
        google_calendar_event_id: proyecto?.google_calendar_event_id ?? null,
      };

      toast({ title: 'Sincronizando con Google Calendar...', description: 'Guardando estatus y fechas.' });

      let googleEventId = null;
      try {
        googleEventId = await syncProyectoEvento(proyectoParaCalendar);
      } catch (err) {
        console.error('🔥 [FRONTEND] Falló la sincronización con el calendario:', err);
        toast({
          variant: 'destructive',
          title: 'Calendario',
          description: err?.message ? `Error del calendario: ${err.message}` : 'Se guardará el proyecto pero falló la sincronización con el calendario.',
        });
      }

      // 2. Actualización unificada en Supabase (estatus + fechas + ID de Google; guardar ID si el backend lo devolvió — evento nuevo o actualizado)
      const updates = {
        ...baseUpdates,
        fecha_inicio,
        fecha_fin,
        ...(googleEventId != null && googleEventId !== '' && { google_calendar_event_id: googleEventId }),
      };
      const { error } = await supabase.from('proyectos').update(updates).eq('id', id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus ni las fechas.' });
        setDatesModalSubmitting(false);
        return;
      }

      setDatesModalOpen(false);
      setPendingNuevoEstatus(null);
      setDatesModalSubmitting(false);
      if (googleEventId) {
        toast({ title: '✅ Proyecto calendarizado', description: 'Estatus y fechas guardados. Sincronizado con Google Calendar.' });
      } else {
        toast({ title: '✅ Estatus Actualizado', description: 'Estatus y fechas guardados. No se pudo sincronizar con el calendario.' });
      }
    } else {
      // Sin modal: solo actualización de estatus en Supabase
      const { error } = await supabase.from('proyectos').update(baseUpdates).eq('id', id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus.' });
        return;
      }
      toast({ title: '✅ Estatus Actualizado', description: `El proyecto está en: ${nuevoEstatus}` });
    }

    const responsable = user?.user_metadata?.nombre_completo || user?.user_metadata?.full_name || user?.email || 'Usuario';
    if (nuevoEstatus !== estatusAnterior) {
      if (nuevoEstatus === 'Terminado' || nuevoEstatus === 'Entregado') {
        notifyProjectFinishedOrDelivered({
          folio: proyecto.folio,
          cliente_nombre: proyecto.cliente || proyecto.cliente_nombre_externo,
          estatus: nuevoEstatus,
        });
      } else {
        notifyStatusChange({
          folio: proyecto.folio,
          descripcion: proyecto.descripcion || 'Sin descripción',
          nuevoEstatus,
          responsable,
        });
      }
    }
    fetchProyectoData(true);
  };

  const handleDatesModalConfirm = async (fechasPayload) => {
    if (!pendingNuevoEstatus) return;
    setDatesModalSubmitting(true);
    await applyEstatusUpdate(pendingNuevoEstatus, fechasPayload);
  };

  const handleDateChange = async (date, field) => {
    if (!date) return;
    const formattedDate = format(date, 'yyyy-MM-dd');
    const fecha_inicio = field === 'fecha_inicio' ? formattedDate : (proyecto?.fecha_inicio?.split?.('T')[0] || formattedDate);
    const fecha_fin = field === 'fecha_fin' ? formattedDate : (proyecto?.fecha_fin?.split?.('T')[0] || formattedDate);

    const payloadCalendar = {
      id: proyecto?.id,
      folio: proyecto?.folio,
      descripcion: proyecto?.descripcion || proyecto?.cliente_nombre_externo || proyecto?.cliente || 'Sin descripción',
      fecha_inicio,
      fecha_fin,
      google_calendar_event_id: proyecto?.google_calendar_event_id ?? null,
    };
    let googleEventId = null;
    try {
      googleEventId = await syncProyectoEvento(payloadCalendar);
    } catch (_) {
      // Silencioso: se guarda la fecha en Supabase aunque falle el calendario
    }

    const updates = { [field]: formattedDate, ...(googleEventId != null && googleEventId !== '' && { google_calendar_event_id: googleEventId }) };
    const { error } = await supabase.from('proyectos').update(updates).eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: `No se pudo actualizar la ${field === 'fecha_fin' ? 'fecha de fin' : 'fecha de inicio'}.` });
    } else {
      toast({ title: '✅ Fecha Actualizada' });
      fetchProyectoData(true);
    }
  };
  
  const resetBitacoraForm = () => {
    if (bitacoraPreview) URL.revokeObjectURL(bitacoraPreview);
    setComentario('');
    setBitacoraFile(null);
    setBitacoraPreview(null);
    setBitacoraTipo('general');
    setBitacoraEntregaId('');
    if (bitacoraFileInputRef.current) bitacoraFileInputRef.current.value = '';
  };

  const handleBitacoraFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Archivo no válido', description: 'Selecciona una imagen.' });
      return;
    }
    if (bitacoraPreview) URL.revokeObjectURL(bitacoraPreview);
    setBitacoraFile(f);
    setBitacoraPreview(URL.createObjectURL(f));
  };

  const handleAddComentarioBitacora = async () => {
    if (isTerminadoOEntregado) {
      toast({ title: 'Proyecto terminado', description: 'No se pueden añadir más comentarios.' });
      return;
    }
    if (!comentario.trim() && !bitacoraFile) {
      toast({ variant: 'destructive', title: 'Contenido vacío', description: 'Agrega un comentario o una imagen.' });
      return;
    }
    if (bitacoraFile && !bitacoraPreview) {
      toast({ variant: 'destructive', title: 'Imagen', description: 'Vuelve a seleccionar la imagen.' });
      return;
    }
    if (bitacoraLoading) return;

    setBitacoraLoading(true);
    try {
      let imageUrl = null;
      if (bitacoraFile) {
        imageUrl = await uploadBitacoraImage(bitacoraFile, id, sanitizeFilename);
      }

      const entregaIdParsed = bitacoraEntregaId ? Number(bitacoraEntregaId) : null;
      const payload = {
        proyecto_id: id,
        usuario_id: user.id,
        comentario: comentario.trim() || null,
        imagen_url: imageUrl,
        tipo: bitacoraTipo,
        entrega_id:
          bitacoraTipo === 'entrega' && entregaIdParsed && !Number.isNaN(entregaIdParsed) ? entregaIdParsed : null,
      };

      const { error } = await supabase.from('proyecto_bitacora').insert(payload);
      if (error) throw error;

      if (comentario.trim()) {
        notifyBitacoraUpdate({
          proyectoNombre: proyecto?.descripcion || 'Sin nombre',
          comentario: comentario.trim(),
          folio: proyecto?.folio,
        });
      }

      resetBitacoraForm();
      toast({ title: 'Registro guardado', description: 'La bitácora se actualizó.' });
      fetchProyectoData(true);
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: err?.message ?? 'No se pudo guardar en la bitácora.',
      });
    } finally {
      setBitacoraLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden subir más archivos.' });
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const sanitizedFilename = sanitizeFilename(file.name);
    const filePath = `${id}/${Date.now()}_${sanitizedFilename}`;
    const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, file);
    if (uploadError) {
      toast({ variant: 'destructive', title: 'Error de carga', description: uploadError.message });
      setIsUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('proyecto_archivos').getPublicUrl(filePath);
    const { error: dbError } = await supabase.from('proyecto_archivos').insert({ proyecto_id: id, nombre_archivo: file.name, url_archivo: publicUrl, tipo_archivo: file.type, tamano_archivo: file.size });
    setIsUploading(false);
    if (dbError) toast({ variant: 'destructive', title: 'Error', description: dbError.message });
    else {
      toast({ title: 'Archivo subido correctamente' });
      fetchProyectoData(true);
    }
  };

  const handleDeleteFile = async (fileId, fileUrl) => {
    if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden eliminar archivos.' });
    const path = decodeURIComponent(fileUrl.split('/proyecto_archivos/')[1]);
    const { error: storageError } = await supabase.storage.from('proyecto_archivos').remove([path]);
    if (storageError) { toast({ variant: 'destructive', title: 'Error', description: storageError.message }); return; }
    const { error: dbError } = await supabase.from('proyecto_archivos').delete().eq('id', fileId);
    if (dbError) toast({ variant: 'destructive', title: 'Error', description: dbError.message });
    else { toast({ title: '🗑️ Archivo eliminado' }); fetchProyectoData(true); }
  };
  
  const handleCreatePedido = async ({
    solicitante_id,
    tipo,
    asociacionId,
    observaciones_generales,
    items,
    tipo_pedido,
    estatus,
    prioridad,
  }) => {
    const { data: lastPedido, error: folioError } = await supabase.from('pedidos_materiales').select('folio').order('id', { ascending: false }).limit(1).single();
    if (folioError && folioError.code !== 'PGRST116') {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio.' });
      return;
    }

    const nextFolioNumber = lastPedido ? parseInt(lastPedido.folio.split('-')[1]) + 1 : 1;
    const newFolio = `PED-${String(nextFolioNumber).padStart(4, '0')}`;

    const proyectoIdNum = proyecto?.id != null ? Number(proyecto.id) : (asociacionId ? Number(asociacionId) : null);
    const pedidoData = {
      folio: newFolio,
      fecha: new Date().toISOString().split('T')[0],
      solicitante_id,
      estatus: estatus || 'Pendiente',
      prioridad: prioridad || 'Normal',
      tipo_pedido: tipo_pedido === 'activo' ? 'activo' : 'material',
      proyecto_id: proyectoIdNum,
      observaciones: observaciones_generales,
    };

    const { data: newPedido, error: pedidoError } = await supabase.from('pedidos_materiales').insert(pedidoData).select().single();
    if (pedidoError) {
      toast({ variant: 'destructive', title: 'Error al guardar pedido', description: pedidoError.message });
      return;
    }

    const tp = tipo_pedido === 'activo' ? 'activo' : 'material';
    const itemsToInsert = items.map((item) => ({
      pedido_id: newPedido.id,
      material_id: tp === 'material' ? (item.material_id ?? item.id) : null,
      categoria_id: tp === 'activo' ? item.categoria_id : null,
      unidad_id: item.unidad_id ?? null,
      descripcion: item.descripcion ?? null,
      marca: tp === 'activo' ? (item.marca ?? null) : null,
      modelo: tp === 'activo' ? (item.modelo ?? null) : null,
      requiere_mantenimiento: tp === 'activo' ? (item.requiere_mantenimiento ?? false) : null,
      requiere_responsiva: tp === 'activo' ? (item.requiere_responsiva ?? false) : null,
      cantidad: item.cantidad,
      observaciones: item.observaciones || null,
      orden_compra_id: item.orden_compra_id ?? null,
      precio_unitario: item.precio_unitario ?? null,
    }));
    const { error: itemsError } = await supabase.from('pedidos_materiales_items').insert(itemsToInsert);
    if (itemsError) {
      toast({ variant: 'destructive', title: 'Error guardando partidas', description: itemsError.message });
      return;
    }

    toast({ title: '✅ Pedido Creado', description: `Se creó el pedido ${newFolio}.` });
    setPedidoGuardado(newPedido);
    setPedidoDialogOpen(false);
    if (proyecto.estatus === 'Planeación') {
        await updateEstatus('Solicitud de Materiales');
    }
    await fetchProyectoData(true);
  };

  const handleOpenPedidoDialog = () => {
    setPedidoGuardado(null);
    setPedidoDialogOpen(true);
  };

  const handleOpenPreview = async (pedido) => {
    setPreviewOrderLoading(true);
    setSelectedOrder(null);
    try {
      const { data, error, mode } = await fetchPedidoMaterialesByIdCompat(supabase, pedido.id);
      if (mode === 'failed' || error) {
        console.error('[DEBUG pedidos_materiales] preview pedido:', error?.message, error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error?.message ?? 'No se pudo cargar el detalle del pedido.',
        });
        return;
      }
      setSelectedOrder(data);
    } catch (err) {
      console.error('[DEBUG pedidos_materiales] preview excepción:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el detalle del pedido.' });
    } finally {
      setPreviewOrderLoading(false);
    }
  };

  const handleSaveResponsable = async (responsableId) => {
    const { error } = await supabase.from('proyectos').update({ responsable_id: responsableId }).eq('id', id);
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo asignar el responsable.' });
    } else {
        toast({ title: '✅ Responsable Asignado' });
        fetchProyectoData(true);
    }
    setAsignarResponsableOpen(false);
  };

  const handleSavePriority = async () => {
    if (!newPriority) {
        toast({ variant: 'destructive', title: 'Prioridad Inválida' });
        return;
    }
    const { error } = await supabase.from('proyectos').update({ prioridad: newPriority }).eq('id', id);
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la prioridad.' });
    } else {
        toast({ title: '✅ Prioridad Actualizada' });
        fetchProyectoData(true);
    }
    setIsEditingPriority(false);
  };
  
  const totalPagado = useMemo(() => pagos.reduce((sum, p) => sum + parseFloat(p.monto), 0), [pagos]);
  const saldoPendiente = useMemo(() => (proyecto?.costo_total || 0) - totalPagado, [proyecto?.costo_total, totalPagado]);

  const puedeMarcarTerminado =
    proyecto?.estatus === 'Revisión' && proyecto?.estatus !== 'Terminado' && proyecto?.estatus !== 'Entregado';
  const puedeRegistrarEntrega = proyecto?.estatus === 'Terminado';
  const rawFaseIndex = proyecto ? faseOptions.findIndex((f) => f.nombre === proyecto.estatus) : -1;
  const currentFaseIndex =
    proyecto?.estatus === 'Terminado' || proyecto?.estatus === 'Entregado'
      ? faseOptions.length
      : rawFaseIndex >= 0
        ? rawFaseIndex
        : 0;

  return (
    <>
      <Helmet>
        <title>{proyecto ? `Proyecto ${proyecto.folio} - IIHEMSA Peninsular` : 'Proyecto - IIHEMSA Peninsular'}</title>
      </Helmet>
      <div className="relative space-y-6 min-h-[50vh]">
        {loading && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-sm"
            aria-busy="true"
          >
            <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
          </div>
        )}
        {!loading && !proyecto && (
          <div className="flex min-h-[40vh] items-center justify-center text-gray-600">
            No se encontró el proyecto.
          </div>
        )}
        {proyecto && (
          <>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button variant="outline" onClick={() => navigate(proyectosListPath)} className="gap-2 self-start"><ArrowLeft className="w-4 h-4" /> Volver</Button>
          <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-center">
             {puedeMarcarTerminado && <Button onClick={() => requestEstatusChange('Terminado')} className="gap-2 flex-1 sm:flex-none bg-green-600 hover:bg-green-700">Marcar como Terminado</Button>}
             {puedeRegistrarEntrega && (
               <Button
                 onClick={() => setAddEntregaDialogOpen(true)}
                 disabled={
                   entregasTotalesCerradas ||
                   entregaCompleto ||
                   entregaItemsLoading ||
                   !proyecto?.cotizacion_id
                 }
                 className="gap-2 flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700"
               >
                 <Truck className="w-4 h-4" />
                 Registrar Entrega
               </Button>
             )}
            <Button variant="outline" onClick={() => toast({ title: '🚧 Función en desarrollo' })} className="gap-2 flex-1 sm:flex-none"><Mail className="w-4 h-4"/> Enviar</Button>
            <Button onClick={() => toast({ title: '🚧 Función en desarrollo' })} className="gap-2 flex-1 sm:flex-none"><FileDown className="w-4 h-4"/> Exportar</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{proyecto.descripcion}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-blue-600 font-mono">{proyecto.folio}</p>
                            {(proyecto.cotizacion_folio || proyecto.cotizacion_id) && (
                                <button
                                    type="button"
                                    onClick={() => setShowQuotePreview(true)}
                                    className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                    title="Ver cotización de referencia"
                                >
                                    <FileText className="w-3.5 h-3.5 shrink-0" />
                                    {proyecto.cotizacion_folio || `Cotización #${proyecto.cotizacion_id}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400"/>
                        <span className="font-medium">{proyecto.responsable || 'No asignado'}</span>
                        {!isTerminadoOEntregado && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setAsignarResponsableOpen(true)}>
                                <Edit className="w-3 h-3" />
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-gray-400"/>
                        {isEditingPriority ? (
                            <div className="flex items-center gap-1">
                                <Select value={newPriority} onValueChange={setNewPriority}>
                                    <SelectTrigger className="h-8 w-[100px]">
                                        <SelectValue placeholder="Prioridad" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {prioridadOptions.map(option => (
                                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSavePriority}><Save className="w-4 h-4 text-green-600"/></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditingPriority(false)}><X className="w-4 h-4 text-red-600"/></Button>
                            </div>
                        ) : (
                            <>
                                <span className="font-medium">Prioridad: {proyecto.prioridad}</span>
                                {!isTerminadoOEntregado && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditingPriority(true)}>
                                        <Edit className="w-3 h-3" />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                     <Popover>
                        <PopoverTrigger asChild disabled={isTerminadoOEntregado}><div className="flex items-center gap-2 cursor-pointer"><CalendarDays className="w-4 h-4 text-gray-400"/><span className="font-medium hover:text-blue-600">Fin: {proyecto.fecha_fin ? format(parseISO(proyecto.fecha_fin), 'dd/MMM/yyyy') : 'N/A'}</span></div></PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={proyecto.fecha_fin ? parseISO(proyecto.fecha_fin) : null} onSelect={(date) => handleDateChange(date, 'fecha_fin')} initialFocus disabled={isTerminadoOEntregado}/></PopoverContent>
                    </Popover>
                 </div>
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                         <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-gray-500">Estatus:</h3>
                            <EstatusBadge estatus={proyecto.estatus} />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-gray-500">Estatus del Proyecto:</h3>
                            <Select value={proyecto.estatus} onValueChange={requestEstatusChange} disabled={isTerminadoOEntregado}>
                                <SelectTrigger className="h-8 w-auto border-dashed">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    {estatusWorkflowOptions.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Progress value={proyecto.avance} />
                </div>
                <div className="mt-6">
                    <h3 className="text-md font-semibold mb-3">Fases del Proyecto</h3>
                    <div className="flex items-center justify-between">
                        {faseOptions.map((fase, index) => {
                            const isCompleted = currentFaseIndex > index;
                            const isCurrent = currentFaseIndex === index && !isTerminadoOEntregado;
                            
                            return (
                                <div key={fase.nombre} className="flex-1 text-center group">
                                    <div className="relative">
                                      <div className={cn("w-6 h-6 rounded-full mx-auto transition-all", isCompleted || isCurrent ? "bg-blue-600" : "bg-gray-300", isCurrent && "ring-4 ring-blue-200")}>
                                        {isCompleted && <Check className="w-4 h-4 text-white m-auto pt-0.5"/>}
                                      </div>
                                      {index < faseOptions.length - 1 && (
                                        <div className={cn("absolute top-1/2 left-1/2 w-full h-0.5 -translate-y-1/2", isCompleted ? "bg-blue-600" : "bg-gray-300")}></div>
                                      )}
                                    </div>
                                    <p className={cn("text-xs mt-2", isCurrent ? "font-bold text-blue-700" : "text-gray-500")}>
                                      {fase.nombre}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <h2 className="text-xl font-bold">Bitácora de Avances</h2>
                <div className="flex flex-col gap-1 sm:min-w-[200px]">
                  <label htmlFor="bitacora-filtro" className="text-xs font-medium text-gray-500">
                    Filtrar
                  </label>
                  <select
                    id="bitacora-filtro"
                    value={bitacoraFiltro}
                    onChange={(e) => setBitacoraFiltro(e.target.value)}
                    className="h-11 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                  >
                    <option value="todos">Todos</option>
                    <option value="general">Comentarios</option>
                    <option value="entrega">Entregas</option>
                    <option value="incidencia">Incidencias</option>
                  </select>
                </div>
              </div>

              {!isTerminadoOEntregado && (
                <div className="mb-6 space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor="bitacora-tipo" className="text-sm font-medium text-gray-700">
                        Tipo de registro
                      </label>
                      <select
                        id="bitacora-tipo"
                        value={bitacoraTipo}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBitacoraTipo(v);
                          if (v !== 'entrega') setBitacoraEntregaId('');
                        }}
                        className="h-12 w-full rounded-lg border border-input bg-white px-3 text-base shadow-sm"
                      >
                        <option value="general">Comentario</option>
                        <option value="entrega">Entrega</option>
                        <option value="incidencia">Incidencia</option>
                      </select>
                    </div>
                    {bitacoraTipo === 'entrega' && entregasBitacora.length > 0 ? (
                      <div className="space-y-1">
                        <label htmlFor="bitacora-entrega" className="text-sm font-medium text-gray-700">
                          Vincular a entrega (opcional)
                        </label>
                        <select
                          id="bitacora-entrega"
                          value={bitacoraEntregaId}
                          onChange={(e) => setBitacoraEntregaId(e.target.value)}
                          className="h-12 w-full rounded-lg border border-input bg-white px-3 text-base shadow-sm"
                        >
                          <option value="">Sin vincular</option>
                          {entregasBitacora.map((en) => (
                            <option key={en.id} value={String(en.id)}>
                              #{en.id} · {en.recibe_nombre ?? '—'} ·{' '}
                              {en.fecha ? format(parseISO(String(en.fecha).split('T')[0]), 'dd/MM/yyyy', { locale: es }) : '—'}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>

                  <textarea
                    value={comentario}
                    onChange={(e) => setComentario(e.target.value)}
                    placeholder="Describe el avance, la entrega en sitio o la incidencia…"
                    className="min-h-[100px] w-full rounded-lg border border-input bg-white p-3 text-base shadow-sm"
                    rows={4}
                    disabled={isTerminadoOEntregado}
                  />

                  <div>
                    <label className="mb-2 flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-base font-medium text-gray-700 active:bg-gray-50 sm:justify-start">
                      <ImageIcon className="h-5 w-5 shrink-0 text-blue-600" />
                      <span>Foto desde cámara o galería</span>
                      <input
                        ref={bitacoraFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={handleBitacoraFileChange}
                      />
                    </label>
                    {bitacoraPreview ? (
                      <div className="relative mt-2 overflow-hidden rounded-lg border bg-white">
                        <img src={bitacoraPreview} alt="Vista previa" className="max-h-64 w-full object-cover" />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="absolute right-2 top-2"
                          onClick={() => {
                            if (bitacoraPreview) URL.revokeObjectURL(bitacoraPreview);
                            setBitacoraFile(null);
                            setBitacoraPreview(null);
                            if (bitacoraFileInputRef.current) bitacoraFileInputRef.current.value = '';
                          }}
                        >
                          Quitar imagen
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    className="h-12 w-full gap-2 text-base sm:w-auto sm:min-w-[200px]"
                    disabled={bitacoraLoading || isTerminadoOEntregado}
                    onClick={handleAddComentarioBitacora}
                  >
                    {bitacoraLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    {bitacoraLoading ? 'Guardando…' : 'Publicar en bitácora'}
                  </Button>
                </div>
              )}

              <div className="relative mt-2 space-y-3 max-h-[min(28rem,70vh)] overflow-y-auto pr-1">
                {bitacora.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No hay entradas en la bitácora.</p>
                ) : bitacoraFiltrada.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">No hay registros con este filtro.</p>
                ) : (
                  <ul className="space-y-3">
                    {bitacoraFiltrada.map((b) => {
                      const t = bitacoraTipoNormalizado(b.tipo);
                      const entregaVinculada =
                        b.entrega_id != null
                          ? entregasBitacora.find((en) => en.id === b.entrega_id)
                          : null;
                      return (
                        <li
                          key={b.id}
                          className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={cn(
                                  'rounded-md px-2 py-1 text-xs font-medium capitalize',
                                  BITACORA_TIPO_BADGE[t] ?? BITACORA_TIPO_BADGE.general
                                )}
                              >
                                {bitacoraTipoEtiqueta(b.tipo)}
                              </span>
                              <span className="text-xs text-gray-500">
                                {b.usuario?.nombre_completo ?? 'Usuario'}
                              </span>
                            </div>
                            <time className="text-xs text-gray-400" dateTime={b.created_at}>
                              {format(new Date(b.created_at), 'Pp', { locale: es })}
                            </time>
                          </div>
                          {entregaVinculada ? (
                            <p className="mb-2 text-xs text-gray-500">
                              Entrega #{b.entrega_id}
                              {entregaVinculada.recibe_nombre
                                ? ` · ${entregaVinculada.recibe_nombre}`
                                : ''}
                              {entregaVinculada.fecha
                                ? ` · ${format(parseISO(String(entregaVinculada.fecha).split('T')[0]), 'dd/MM/yyyy', { locale: es })}`
                                : ''}
                            </p>
                          ) : b.entrega_id ? (
                            <p className="mb-2 text-xs text-gray-500">Entrega #{b.entrega_id}</p>
                          ) : null}
                          {b.comentario ? (
                            <p className="whitespace-pre-wrap text-sm text-gray-800">{b.comentario}</p>
                          ) : null}
                          {b.imagen_url ? (
                            <a
                              href={b.imagen_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 block overflow-hidden rounded-lg"
                            >
                              <img
                                src={b.imagen_url}
                                alt="Adjunto bitácora"
                                className="max-h-64 w-full object-cover"
                              />
                            </a>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div id="seccion-pagos" className="scroll-mt-20 bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Control Financiero</h2>
                    {saldoPendiente <= 0 ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">PAGADO</Badge>
                    ) : (
                        <Badge variant="destructive" className="bg-yellow-100 text-yellow-800 border-yellow-200">PAGO PENDIENTE</Badge>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-center">
                    <div className="p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500">Costo Total</p>
                        <p className="font-bold text-lg text-gray-800">${(proyecto.costo_total || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-700">Total Pagado</p>
                        <p className="font-bold text-lg text-green-800">${totalPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                        <p className="text-xs text-red-700">Saldo Pendiente</p>
                        <p className="font-bold text-lg text-red-800">${saldoPendiente.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                    </div>
                </div>
                <div className="flex justify-end mb-4 gap-2">
                    <Button size="sm" className="gap-2" onClick={() => { setPagoEnEdicion(null); setAddPagoDialogOpen(true); }}><DollarSign className="w-4 h-4"/> Registrar Pago</Button>
                    {proyecto?.requiere_cfdi && (
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => setFacturaDialogOpen(true)}><FileText className="w-4 h-4"/> Registrar Factura</Button>
                    )}
                </div>
                <Tabs defaultValue="ingresos" className="space-y-2">
                    <TabsList>
                        <TabsTrigger value="ingresos">Ingresos</TabsTrigger>
                        <TabsTrigger value="gastos">Gastos</TabsTrigger>
                    </TabsList>
                    <TabsContent value="ingresos" className="space-y-2">
                        <div className="overflow-x-auto rounded border border-gray-100 max-h-72 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Proyecto</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead className="w-[100px] text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pagos.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-gray-500">No hay ingresos registrados.</TableCell></TableRow>
                                    ) : pagos.map(p => (
                                        <TableRow key={p.id}>
                                            <TableCell className="whitespace-nowrap">{formatDateTable(p.fecha_pago)}</TableCell>
                                            <TableCell>{proyecto.cliente || '—'}</TableCell>
                                            <TableCell className="max-w-[180px] truncate">{proyecto.descripcion || proyecto.folio}</TableCell>
                                            <TableCell className="text-right font-medium text-green-700">${parseFloat(p.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {p.url_cfdi && <Button asChild variant="ghost" size="icon" className="h-7 w-7"><a href={p.url_cfdi} target="_blank" rel="noreferrer"><FileIcon className="w-4 h-4"/></a></Button>}
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setComprobantePago(p)} title="Comprobante"><FileText className="w-4 h-4"/></Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPagoEnEdicion(p); setAddPagoDialogOpen(true); }} title="Editar"><Edit className="w-4 h-4"/></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                    <TabsContent value="gastos" className="space-y-2">
                        <div className="overflow-x-auto rounded border border-gray-100 max-h-72 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Proveedor</TableHead>
                                        <TableHead>Concepto</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gastosProyecto.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center py-6 text-gray-500">No hay gastos registrados.</TableCell></TableRow>
                                    ) : gastosProyecto.map(g => (
                                        <TableRow key={g.id}>
                                            <TableCell className="whitespace-nowrap">{formatDateTable(g.fecha)}</TableCell>
                                            <TableCell>{g.proveedor || '—'}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">{g.descripcion || g.categoria || '—'}</TableCell>
                                            <TableCell className="text-right font-medium text-red-700">${Number(g.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Aprobación del Cliente</h3>
                    {aprobaciones.length > 0 ? (<div className="space-y-3">{aprobaciones.map(ap => (<div key={ap.id} className="text-sm p-3 bg-green-50 rounded-lg"><p className="font-semibold text-green-800">Aprobado por {ap.usuario?.nombre_completo || 'Usuario'}</p><p className="text-xs text-gray-500">{format(new Date(ap.created_at), 'Pp', { locale: es })}</p>{ap.comentario && <p className="mt-1 text-gray-700">{ap.comentario}</p>}<a href={ap.url_documento} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium flex items-center gap-1 mt-1">Ver Documento <Download className="w-3 h-3"/></a></div>))}</div>) : <div className="text-center py-6 text-gray-500"><Pencil className="mx-auto w-8 h-8 mb-2 text-gray-400" />Aún no hay registros de aprobación.</div>}
                    <Button size="sm" className="w-full gap-2 mt-4" onClick={() => setAddAprobacionDialogOpen(true)} disabled={isTerminadoOEntregado}><Pencil className="w-4 h-4"/> Registrar Aprobación</Button>
                </div>
                {(proyecto.estatus === 'Terminado' ||
                  proyecto.estatus === 'Entregado' ||
                  proyecto.estado === 'parcial') && (
                  <EntregaHistorial
                    proyectoId={id}
                    reloadNonce={entregaHistorialNonce}
                    puedeCancelarEntrega
                    onEntregaCancelled={() => {
                      fetchProyectoData(true);
                      refetchEntregaItems();
                      setEntregaHistorialNonce((n) => n + 1);
                    }}
                  />
                )}
                {proyecto?.cotizacion_id &&
                  (proyecto.estatus === 'Terminado' ||
                    proyecto.estatus === 'Entregado' ||
                    proyecto.estado === 'parcial') && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={handleImprimirCotizacionEntrega}
                      disabled={imprimiendoReporte}
                      title="Genera un PDF con la cotización y el reporte de entrega para enviar al cliente"
                    >
                      {imprimiendoReporte ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                      Cotización + Reporte de entrega (PDF)
                    </Button>
                  )}
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Archivos del Proyecto</h3>
                    {archivos.length > 0 ? (<div className="space-y-2 max-h-60 overflow-y-auto pr-2">{archivos.map(file => (<div key={file.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 group"><div className="flex items-center gap-3"><FileIcon className="w-5 h-5 text-blue-500" /><span className="text-sm font-medium text-gray-800">{file.nombre_archivo}</span></div><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button asChild variant="ghost" size="icon" className="h-7 w-7"><a href={file.url_archivo} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a></Button>{!isTerminadoOEntregado && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteFile(file.id, file.url_archivo)}><Trash2 className="w-4 h-4" /></Button>}</div></div>))}</div>) : <div className="text-center py-6 text-gray-500"><FileIcon className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay archivos adjuntos.</div>}
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => archivosProyectoInputRef.current?.click()} disabled={isUploading || isTerminadoOEntregado}>{isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}{isUploading ? 'Subiendo...' : 'Adjuntar Archivo'}</Button>
                    <input type="file" ref={archivosProyectoInputRef} className="hidden" onChange={handleFileUpload} disabled={isTerminadoOEntregado}/>
                </div>
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                      <h3 className="font-bold text-lg">Materiales</h3>
                      {/* TODO: Reactivar o ajustar esta lógica de 'Sin Materiales' en el futuro si se requiere validación por proyecto. */}
                      {/* <MaterialStatusIndicator materiales={materiales.map(m => ({ ...m.material, cant: m.cantidad_requerida, stock: m.material.existencias }))} /> */}
                    </div>
                     {materiales.length > 0 ? (<div className="space-y-2 max-h-60 overflow-y-auto pr-2">{materiales.map(m => ( <div key={m.id} className="p-2 bg-gray-50 rounded-lg text-sm"><p className="font-medium">{m.material.descripcion}</p><p>Requerido: <span className="font-semibold">{m.cantidad_requerida} {m.material.unidad_compra}</span></p>{m.comentario && <p className="text-xs text-gray-500 italic">"{m.comentario}"</p>}</div> ))}</div>) : null}
                    {pedidosProyecto.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Folio</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Fecha</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Estatus</th>
                              <th className="px-3 py-2 text-right font-semibold text-gray-700 w-12">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {pedidosProyecto.map((p) => (
                              <tr key={p.id} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-medium text-blue-600">{p.folio}</td>
                                <td className="px-3 py-2 text-gray-600">{formatDateTable(p.fecha)}</td>
                                <td className="px-3 py-2"><Badge variant="secondary" className="text-xs">{p.estatus}</Badge></td>
                                <td className="px-3 py-2 text-right">
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenPreview(p)} disabled={previewOrderLoading} title="Ver detalle del pedido">
                                    <Eye className="w-4 h-4 text-gray-600" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : materiales.length === 0 ? (
                      <div className="text-center py-6 text-gray-500"><PackagePlus className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay materiales asignados.</div>
                    ) : null}
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={handleOpenPedidoDialog} disabled={isTerminadoOEntregado}><ShoppingCart className="w-4 h-4"/> Pedir Materiales</Button>
                </div>
          </motion.div>
        </div>
      </div>
          </>
        )}
      </div>
      
      <NuevoPedidoDialog open={pedidoDialogOpen} onOpenChange={setPedidoDialogOpen} onSave={handleCreatePedido} pedidoGuardado={pedidoGuardado} proyecto={proyecto ?? null} />
      {proyecto && <RegistrarAprobacionDialog open={addAprobacionDialogOpen} onOpenChange={setAddAprobacionDialogOpen} proyecto={proyecto} onSave={() => { fetchProyectoData(true); setAddAprobacionDialogOpen(false); }} disabled={isTerminadoOEntregado} />}
      <EntregaModal
        open={addEntregaDialogOpen}
        onOpenChange={setAddEntregaDialogOpen}
        proyectoId={id}
        cotizacionId={proyecto?.cotizacion_id ?? null}
        proyectoFolio={proyecto?.folio}
        clienteNombre={proyecto?.cliente ?? proyecto?.cliente_nombre_externo}
        items={entregaItemsRpc}
        itemsLoading={entregaItemsLoading}
        onItemsRefetch={refetchEntregaItems}
        entregasBloqueadas={entregasTotalesCerradas}
        onSuccess={() => {
          fetchProyectoData(true);
          refetchEntregaItems();
          setEntregaHistorialNonce((n) => n + 1);
        }}
      />
      {proyecto && <RegistrarPagoDialog open={addPagoDialogOpen} onOpenChange={(open) => { setAddPagoDialogOpen(open); if (!open) setPagoEnEdicion(null); }} proyectoId={proyecto.id} proyecto={proyecto} pago={pagoEnEdicion} onSave={() => { fetchProyectoData(true); setAddPagoDialogOpen(false); setPagoEnEdicion(null); }} />}
      {proyecto && (
        <RegistrarFacturaDialog
          open={facturaDialogOpen}
          onOpenChange={setFacturaDialogOpen}
          proyecto={proyecto}
          onSaved={() => { setFacturaDialogOpen(false); fetchProyectoData(true); }}
        />
      )}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <p><span className="font-semibold text-gray-600">Folio:</span> <span className="font-medium">{selectedOrder.folio}</span></p>
                <p><span className="font-semibold text-gray-600">Fecha:</span> {formatDateTable(selectedOrder.fecha)}</p>
                <p><span className="font-semibold text-gray-600">Estatus:</span> <Badge variant="secondary" className="text-xs">{selectedOrder.estatus}</Badge></p>
                {selectedOrder.solicitante && <p className="col-span-2"><span className="font-semibold text-gray-600">Solicitante:</span> {selectedOrder.solicitante.nombre_completo}</p>}
                {selectedOrder.observaciones && <p className="col-span-2"><span className="font-semibold text-gray-600">Observaciones:</span> {selectedOrder.observaciones}</p>}
              </div>
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Artículos pedidos</h4>
                <div className="overflow-x-auto rounded border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Cantidad</th>
                        <th className="px-3 py-2 text-left font-semibold">Unidad</th>
                        <th className="px-3 py-2 text-left font-semibold">Descripción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selectedOrder.pedidos_materiales_items || []).map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.cantidad}</td>
                          <td className="px-3 py-2">{unidadImpresionPedidoItem(item)}</td>
                          <td className="px-3 py-2">
                            {descripcionImpresionPedidoItem(item, selectedOrder.tipo_pedido ?? 'material')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {proyecto && comprobantePago && (
        <Dialog open={!!comprobantePago} onOpenChange={(open) => !open && setComprobantePago(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ComprobanteIngreso
              proyecto={proyecto}
              pago={comprobantePago}
              totalPagado={totalPagado}
              onAfterPrint={() => setComprobantePago(null)}
            />
          </DialogContent>
        </Dialog>
      )}
      <AsignarResponsableDialog open={asignarResponsableOpen} onOpenChange={setAsignarResponsableOpen} onSave={handleSaveResponsable} />
      {proyecto && (
        <ProjectDatesModal
          open={datesModalOpen}
          onOpenChange={(open) => { setDatesModalOpen(open); if (!open) setPendingNuevoEstatus(null); }}
          nuevoEstatus={pendingNuevoEstatus}
          proyecto={proyecto}
          onConfirm={handleDatesModalConfirm}
          isSubmitting={datesModalSubmitting}
        />
      )}
      {proyecto && (
        <AlertDialog
          open={pendingConfirmEstatus != null}
          onOpenChange={(o) => { if (!o) setPendingConfirmEstatus(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar cambio de estatus</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Cambiar el estatus de "{proyecto?.estatus}" a "{pendingConfirmEstatus}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setPendingConfirmEstatus(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  const v = pendingConfirmEstatus;
                  setPendingConfirmEstatus(null);
                  updateEstatus(v);
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {proyecto?.cotizacion_id && (
        <SeleccionarFormatoCotizacionDialog
          open={showQuotePreview}
          onOpenChange={setShowQuotePreview}
          cotizacionId={proyecto.cotizacion_id}
          cotizacion={null}
          modoProyecto={true}
          onEditar={(cotizacion) => {
            setShowQuotePreview(false);
            navigate('/cotizaciones', { state: { openCotizacionId: cotizacion?.id } });
          }}
          onCrearNuevaVersion={(cotizacion) => {
            setShowQuotePreview(false);
            navigate('/cotizaciones', { state: { openCotizacionId: cotizacion?.id, action: 'crearNuevaVersion' } });
          }}
          onDuplicarPlantilla={(cotizacion) => {
            setShowQuotePreview(false);
            navigate('/cotizaciones', { state: { openCotizacionId: cotizacion?.id, action: 'duplicarPlantilla' } });
          }}
        />
      )}
    </>
  );
};

export default ProyectoDetalle;