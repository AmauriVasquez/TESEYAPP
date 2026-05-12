import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { ArrowLeft, Send, FileDown, Mail, PackagePlus, Pencil, AlertCircle, CheckCircle, Upload, Trash2, ShoppingCart, Loader2, File as FileIcon, Download, Image as ImageIcon, Check, User, CalendarDays, Truck, DollarSign, Edit, Save, X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { EstatusBadge, estatusOptions, faseOptions } from '@/config/proyectosConfig.jsx';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import RegistrarAprobacionDialog from '@/components/proyectos/RegistrarAprobacionDialog';
import RegistrarEntregaDialog from '@/components/proyectos/RegistrarEntregaDialog';
import RegistrarPagoDialog from '@/components/proyectos/RegistrarPagoDialog';
import AsignarResponsableDialog from '@/components/proyectos/AsignarResponsableDialog';
import NuevoPedidoDialog from '@/components/pedidos/NuevoPedidoDialog';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const prioridadOptions = [
    { value: 'Alta', label: 'Alta' },
    { value: 'Media', label: 'Media' },
    { value: 'Baja', label: 'Baja' },
];

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
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [proyecto, setProyecto] = useState(null);
  const [comentario, setComentario] = useState('');
  const [bitacora, setBitacora] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [aprobaciones, setAprobaciones] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [pagos, setPagos] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [pedidoDialogOpen, setPedidoDialogOpen] = useState(false);
  const [pedidoGuardado, setPedidoGuardado] = useState(null);

  const [addAprobacionDialogOpen, setAddAprobacionDialogOpen] = useState(false);
  const [addEntregaDialogOpen, setAddEntregaDialogOpen] = useState(false);
  const [addPagoDialogOpen, setAddPagoDialogOpen] = useState(false);
  const [asignarResponsableOpen, setAsignarResponsableOpen] = useState(false);
  const [isEditingPriority, setIsEditingPriority] = useState(false);
  const [newPriority, setNewPriority] = useState('');
  const [imagenBitacora, setImagenBitacora] = useState(null);

  const bitacoraFileInputRef = useRef(null);
  const archivosProyectoInputRef = useRef(null);
  
  const isTerminadoOEntregado = proyecto?.estatus === 'Terminado' || proyecto?.estatus === 'Entregado';

  const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9-_\.]/g, '_');
  };

  const fetchProyectoData = useCallback(async (isUpdate = false) => {
    if(!isUpdate) setLoading(true);
    try {
        const { data: proyectoData, error: proyectoError } = await supabase.from('proyectos').select('*, cliente:cliente_id(nombre), responsable:responsable_id(nombre_completo), cotizacion:cotizacion_id(total)').eq('id', id).single();
        if (proyectoError) throw proyectoError;

        const { data: bitacoraRawData, error: bitacoraError } = await supabase.from('proyecto_bitacora').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (bitacoraError) throw bitacoraError;
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

        const { data: entregasData, error: entregasError } = await supabase.from('proyecto_entregas').select('*').eq('proyecto_id', id).order('created_at', { ascending: false });
        if (entregasError) throw entregasError;
        
        const { data: pagosData, error: pagosError } = await supabase.from('proyecto_pagos').select('*').eq('proyecto_id', id).order('fecha_pago', { ascending: false });
        if (pagosError) throw pagosError;
        
        const allFaseOptions = [...faseOptions, { nombre: 'Terminado', avance: 100 }];
        const faseActual = allFaseOptions.find(f => f.nombre === proyectoData.fase) || { avance: 0 };
        setProyecto({
            ...proyectoData,
            cliente: proyectoData.cliente?.nombre || proyectoData.cliente_nombre_externo,
            responsable: proyectoData.responsable?.nombre_completo,
            avance: faseActual.avance,
            costo_total: proyectoData.cotizacion?.total || 0,
        });
        setNewPriority(proyectoData.prioridad);
        setBitacora(bitacoraData);
        setArchivos(archivosData);
        setMateriales(materialesData);
        setAprobaciones(aprobacionesData);
        setEntregas(entregasData);
        setPagos(pagosData);

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el proyecto.' });
      console.error('Error fetching project data:', error);
      navigate('/proyectos');
    } finally {
      if(!isUpdate) setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchProyectoData();
  }, [fetchProyectoData]);

  const updateFaseYAvance = async (nuevaFaseNombre) => {
    const allFaseOptions = [...faseOptions, { nombre: 'Terminado', avance: 100 }];
    const nuevaFase = allFaseOptions.find(f => f.nombre === nuevaFaseNombre);
    if (!nuevaFase) return;

    let updates = { fase: nuevaFase.nombre };
    
    if (nuevaFase.nombre === 'Terminado') {
        updates.estatus = 'Terminado';
    } else if (nuevaFase.nombre === 'Planeación') {
        updates.estatus = 'Por Iniciar';
    } else if (proyecto.estatus !== 'Detenido' && proyecto.estatus !== 'Cancelado') {
        updates.estatus = 'En Proceso';
    }

    const { error } = await supabase.from('proyectos').update(updates).eq('id', id);
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar la fase.' });
    } else {
        toast({ title: '✅ Fase Actualizada', description: `El proyecto avanzó a: ${nuevaFase.nombre}` });
        fetchProyectoData(true);
    }
  };

  const handleDateChange = async (date, field) => {
    if (!date) return;
    const formattedDate = format(date, 'yyyy-MM-dd');
    const { error } = await supabase.from('proyectos').update({ [field]: formattedDate }).eq('id', id);

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: `No se pudo actualizar la ${field === 'fecha_fin' ? 'fecha de fin' : 'fecha de inicio'}.` });
    } else {
        toast({ title: '✅ Fecha Actualizada'});
        fetchProyectoData(true);
    }
  };
  
  const handleAddComentario = async () => {
    if (isTerminadoOEntregado) return toast({ title: 'Proyecto terminado', description: 'No se pueden añadir más comentarios.' });
    if (!comentario.trim() && !imagenBitacora) return;
    setIsSubmitting(true);
    let imageUrl = null;
    if (imagenBitacora) {
        const sanitizedFilename = sanitizeFilename(imagenBitacora.name);
        const filePath = `bitacora/${id}/${Date.now()}_${sanitizedFilename}`;
        const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, imagenBitacora);
        if (uploadError) {
            toast({ variant: 'destructive', title: 'Error de Carga', description: uploadError.message });
            setIsSubmitting(false);
            return;
        }
        imageUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(filePath).data.publicUrl;
    }
    const { error } = await supabase.from('proyecto_bitacora').insert({ proyecto_id: id, usuario_id: user.id, comentario: comentario.trim(), imagen_url: imageUrl });
    setIsSubmitting(false);
    if (error) toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el comentario.' });
    else {
      setComentario('');
      setImagenBitacora(null);
      if (bitacoraFileInputRef.current) bitacoraFileInputRef.current.value = "";
      fetchProyectoData(true);
    }
  };
  
  const handleBitacoraImageSelect = (e) => {
      if (e.target.files && e.target.files[0]) setImagenBitacora(e.target.files[0]);
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
  
  const handleCreatePedido = async ({ solicitante_id, tipo, asociacionId, observaciones_generales, items }) => {
    const { data: lastPedido, error: folioError } = await supabase.from('pedidos_materiales').select('folio').order('id', { ascending: false }).limit(1).single();
    if (folioError && folioError.code !== 'PGRST116') {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio.' });
      return;
    }

    const nextFolioNumber = lastPedido ? parseInt(lastPedido.folio.split('-')[1]) + 1 : 1;
    const newFolio = `PED-${String(nextFolioNumber).padStart(4, '0')}`;

    const pedidoData = { folio: newFolio, fecha: new Date().toISOString().split('T')[0], solicitante_id, estatus: 'Pendiente', proyecto_id: asociacionId, observaciones: observaciones_generales };

    const { data: newPedido, error: pedidoError } = await supabase.from('pedidos_materiales').insert(pedidoData).select().single();
    if (pedidoError) {
      toast({ variant: 'destructive', title: 'Error', description: pedidoError.message });
      return;
    }

    const itemsToInsert = items.map(item => ({ pedido_id: newPedido.id, material_id: item.id, cantidad: item.cantidad, observaciones: item.observaciones }));
    const { error: itemsError } = await supabase.from('pedidos_materiales_items').insert(itemsToInsert);
    if (itemsError) {
      toast({ variant: 'destructive', title: 'Error guardando partidas', description: itemsError.message });
      return;
    }

    toast({ title: '✅ Pedido Creado', description: `Se creó el pedido ${newFolio}.` });
    setPedidoGuardado(newPedido);
    
    if(proyecto.fase === 'Planeación') {
        await updateFaseYAvance('Solicitud de Materiales');
    } else {
        fetchProyectoData(true); // Re-fetch all data to be safe
    }
  };

  const handleOpenPedidoDialog = () => {
    setPedidoGuardado(null);
    setPedidoDialogOpen(true);
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
  const saldoPendiente = useMemo(() => (proyecto?.costo_total || 0) - totalPagado, [proyecto, totalPagado]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>;
  if (!proyecto) return null;
  
  const puedeMarcarTerminado = proyecto.fase === 'Revisión' && proyecto.estatus !== 'Terminado' && proyecto.estatus !== 'Entregado';
  const puedeRegistrarEntrega = proyecto.estatus === 'Terminado' && proyecto.fase === 'Terminado';
  const allFaseOptions = [...faseOptions, { nombre: 'Terminado', avance: 100 }];
  const currentFaseIndex = allFaseOptions.findIndex(f => f.nombre === proyecto.fase);

  return (
    <>
      <Helmet><title>{`Proyecto ${proyecto.folio} - Sistema TESEY`}</title></Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <Button variant="outline" onClick={() => navigate('/proyectos')} className="gap-2 self-start"><ArrowLeft className="w-4 h-4" /> Volver</Button>
          <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-center">
             {puedeMarcarTerminado && <Button onClick={() => updateFaseYAvance('Terminado')} className="gap-2 flex-1 sm:flex-none bg-green-600 hover:bg-green-700">Marcar como Terminado</Button>}
             {puedeRegistrarEntrega && <Button onClick={() => setAddEntregaDialogOpen(true)} className="gap-2 flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700"><Truck className="w-4 h-4" />Registrar Entrega</Button>}
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
                        <p className="text-blue-600 font-mono">{proyecto.folio}</p>
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
                            <h3 className="text-sm font-medium text-gray-500">Fase actual:</h3>
                            <Select value={proyecto.fase} onValueChange={updateFaseYAvance} disabled={isTerminadoOEntregado}>
                                <SelectTrigger className="h-8 w-auto border-dashed">
                                    <SelectValue/>
                                </SelectTrigger>
                                <SelectContent>
                                    {faseOptions.map(option => (
                                        <SelectItem key={option.nombre} value={option.nombre}>{option.nombre}</SelectItem>
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
            
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <h2 className="text-xl font-bold mb-4">Bitácora de Avances</h2>
              {!isTerminadoOEntregado && (
                <div className="relative mb-4">
                  <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Añadir un nuevo avance o comentario..." className="w-full border rounded-lg p-3 pr-28" rows="3" disabled={isTerminadoOEntregado}></textarea>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => bitacoraFileInputRef.current?.click()} disabled={isTerminadoOEntregado}>
                      <ImageIcon className={`w-5 h-5 ${imagenBitacora ? 'text-blue-600' : ''}`}/>
                    </Button>
                    <input type="file" ref={bitacoraFileInputRef} className="hidden" accept="image/*" onChange={handleBitacoraImageSelect} />
                    <Button size="icon" onClick={handleAddComentario} disabled={isSubmitting || isTerminadoOEntregado}>
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5"/>}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-2">
                {bitacora.length > 0 ? bitacora.map(b => (
                  <div key={b.id} className="flex gap-3 text-sm">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-gray-600 uppercase">{b.usuario?.nombre_completo?.charAt(0) || '?'}</div>
                    <div>
                      <p><span className="font-semibold">{b.usuario?.nombre_completo}</span> <span className="text-xs text-gray-500">{format(new Date(b.created_at), 'Pp', { locale: es })}</span></p>
                      {b.comentario && <p className="text-gray-700">{b.comentario}</p>}
                      {b.imagen_url && <a href={b.imagen_url} target="_blank" rel="noopener noreferrer"><img src={b.imagen_url} alt="Avance" className="mt-2 rounded-lg max-w-xs cursor-pointer"/></a>}
                    </div>
                  </div>
                )) : <div className="text-center py-6 text-gray-500">No hay entradas en la bitácora.</div>}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Pagos</h2>
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

                {pagos.length > 0 ? (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-2">
                    {pagos.map(p => (
                        <div key={p.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex justify-between items-start">
                            <div>
                            <p className="font-semibold text-gray-800">${parseFloat(p.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-gray-500">{format(parseISO(p.fecha_pago), 'dd/MMM/yyyy')} - {p.metodo_pago}</p>
                            </div>
                            <div className="flex items-center gap-2">
                            {p.url_cfdi && <Button asChild variant="ghost" size="icon" className="h-7 w-7"><a href={p.url_cfdi} target="_blank" rel="noreferrer"><FileIcon className="w-4 h-4"/></a></Button>}
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Edit className="w-4 h-4"/></Button>
                            </div>
                        </div>
                        {p.comentarios && <p className="text-xs text-gray-600 mt-1 italic">"{p.comentarios}"</p>}
                        </div>
                    ))}
                    </div>
                ) : (<div className="text-center py-6 text-gray-500"><DollarSign className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay pagos registrados.</div>)}
                
                <div className="border-t mt-4 pt-4 flex justify-end">
                    <Button size="sm" className="gap-2" onClick={() => setAddPagoDialogOpen(true)}><DollarSign className="w-4 h-4"/> Registrar Pago</Button>
                </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Aprobación del Cliente</h3>
                    {aprobaciones.length > 0 ? (<div className="space-y-3">{aprobaciones.map(ap => (<div key={ap.id} className="text-sm p-3 bg-green-50 rounded-lg"><p className="font-semibold text-green-800">Aprobado por {ap.usuario?.nombre_completo || 'Usuario'}</p><p className="text-xs text-gray-500">{format(new Date(ap.created_at), 'Pp', { locale: es })}</p>{ap.comentario && <p className="mt-1 text-gray-700">{ap.comentario}</p>}<a href={ap.url_documento} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium flex items-center gap-1 mt-1">Ver Documento <Download className="w-3 h-3"/></a></div>))}</div>) : <div className="text-center py-6 text-gray-500"><Pencil className="mx-auto w-8 h-8 mb-2 text-gray-400" />Aún no hay registros de aprobación.</div>}
                    <Button size="sm" className="w-full gap-2 mt-4" onClick={() => setAddAprobacionDialogOpen(true)} disabled={isTerminadoOEntregado}><Pencil className="w-4 h-4"/> Registrar Aprobación</Button>
                </div>
                
                {proyecto.estatus === 'Entregado' && entregas.length > 0 && (
                     <div className="bg-white p-6 rounded-xl border shadow-sm">
                        <h3 className="font-bold text-lg mb-3">Registro de Entrega</h3>
                        {entregas.map(e => (
                             <div key={e.id} className="text-sm space-y-2">
                                 <p><span className="font-semibold">Recibido por:</span> {e.recibido_por}</p>
                                 <p><span className="font-semibold">Fecha:</span> {format(parseISO(e.fecha_entrega), 'Pp', { locale: es })}</p>
                                 {e.comentarios && <p><span className="font-semibold">Comentarios:</span> {e.comentarios}</p>}
                                 <div className="flex gap-4 mt-2">
                                     <a href={e.url_firma} target="_blank" rel="noreferrer" className="flex-1"><img src={e.url_firma} alt="Firma" className="border rounded-md"/></a>
                                     {e.url_evidencia && <a href={e.url_evidencia} target="_blank" rel="noreferrer" className="text-blue-600 font-medium hover:underline text-center">Ver Evidencia</a>}
                                 </div>
                             </div>
                        ))}
                    </div>
                )}
                
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <h3 className="font-bold text-lg mb-3">Archivos del Proyecto</h3>
                    {archivos.length > 0 ? (<div className="space-y-2 max-h-60 overflow-y-auto pr-2">{archivos.map(file => (<div key={file.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 group"><div className="flex items-center gap-3"><FileIcon className="w-5 h-5 text-blue-500" /><span className="text-sm font-medium text-gray-800">{file.nombre_archivo}</span></div><div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><Button asChild variant="ghost" size="icon" className="h-7 w-7"><a href={file.url_archivo} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a></Button>{!isTerminadoOEntregado && <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDeleteFile(file.id, file.url_archivo)}><Trash2 className="w-4 h-4" /></Button>}</div></div>))}</div>) : <div className="text-center py-6 text-gray-500"><FileIcon className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay archivos adjuntos.</div>}
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => archivosProyectoInputRef.current?.click()} disabled={isUploading || isTerminadoOEntregado}>{isUploading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}{isUploading ? 'Subiendo...' : 'Adjuntar Archivo'}</Button>
                    <input type="file" ref={archivosProyectoInputRef} className="hidden" onChange={handleFileUpload} disabled={isTerminadoOEntregado}/>
                </div>
                
                <div className="bg-white p-6 rounded-xl border shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2"><h3 className="font-bold text-lg">Materiales</h3><MaterialStatusIndicator materiales={materiales.map(m => ({ ...m.material, cant: m.cantidad_requerida, stock: m.material.existencias }))} /></div>
                     {materiales.length > 0 ? (<div className="space-y-2 max-h-60 overflow-y-auto pr-2">{materiales.map(m => ( <div key={m.id} className="p-2 bg-gray-50 rounded-lg text-sm"><p className="font-medium">{m.material.descripcion}</p><p>Requerido: <span className="font-semibold">{m.cantidad_requerida} {m.material.unidad_compra}</span></p>{m.comentario && <p className="text-xs text-gray-500 italic">"{m.comentario}"</p>}</div> ))}</div>) : <div className="text-center py-6 text-gray-500"><PackagePlus className="mx-auto w-8 h-8 mb-2 text-gray-400" />No hay materiales asignados.</div>}
                    <Button variant="outline" className="w-full mt-4 gap-2" onClick={handleOpenPedidoDialog} disabled={isTerminadoOEntregado}><ShoppingCart className="w-4 h-4"/> Pedir Materiales</Button>
                </div>
          </motion.div>
        </div>
      </div>
      
      {proyecto && <NuevoPedidoDialog open={pedidoDialogOpen} onOpenChange={setPedidoDialogOpen} onSave={handleCreatePedido} pedidoGuardado={pedidoGuardado} proyecto={proyecto}/>}
      {proyecto && <RegistrarAprobacionDialog open={addAprobacionDialogOpen} onOpenChange={setAddAprobacionDialogOpen} proyecto={proyecto} onSave={() => { fetchProyectoData(true); setAddAprobacionDialogOpen(false); }} disabled={isTerminadoOEntregado} />}
      {proyecto && <RegistrarEntregaDialog open={addEntregaDialogOpen} onOpenChange={setAddEntregaDialogOpen} proyecto={proyecto} onSave={() => { fetchProyectoData(true); setAddEntregaDialogOpen(false); }} />}
      {proyecto && <RegistrarPagoDialog open={addPagoDialogOpen} onOpenChange={setAddPagoDialogOpen} proyectoId={proyecto.id} onSave={() => { fetchProyectoData(true); setAddPagoDialogOpen(false); }} />}
      <AsignarResponsableDialog open={asignarResponsableOpen} onOpenChange={setAsignarResponsableOpen} onSave={handleSaveResponsable} />
    </>
  );
};

export default ProyectoDetalle;