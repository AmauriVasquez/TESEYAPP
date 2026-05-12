import React, { useState, useEffect, useCallback, useMemo } from 'react';
// ... (mismos imports anteriores) ...
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Trash2, Loader2, MessageSquare, ToyBrick, Cuboid, Package, Building2, Printer, ShieldCheck, ChevronDown, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { cn } from '@/lib/utils';
import SeleccionarFormatoDialog from '@/components/pedidos/SeleccionarFormatoDialog';
import AutorizarPedidoDialog from '@/components/pedidos/AutorizarPedidoDialog';

const NuevoPedidoDialog = ({ open, onOpenChange, onSave, pedidoGuardado, proyecto: proyectoPrefijado, onPedidoUpdated }) => {
  const { toast } = useToast();
  const { user } = useAuth();

  // ... (mismos estados iniciales) ...
  const [solicitanteId, setSolicitanteId] = useState('');
  const [tipoAsociacion, setTipoAsociacion] = useState('proyecto');
  const [asociacionId, setAsociacionId] = useState('');
  const [observacionesGenerales, setObservacionesGenerales] = useState('');
  const [items, setItems] = useState([]);
  const [materialSeleccionado, setMaterialSeleccionado] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [preselectedFormat, setPreselectedFormat] = useState(null);

  // Status Management
  const [estatus, setEstatus] = useState('Pendiente');
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // State for format selection dialog
  const [showFormatSelection, setShowFormatSelection] = useState(false);
  const [currentPedidoData, setCurrentPedidoData] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [proyectosActivos, setProyectosActivos] = useState([]);
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [cuentasGasto] = useState(['Consumibles', 'Mantenimiento', 'Edificio', 'Activos', 'Herramienta']);
  const [categoriaMaterial, setCategoriaMaterial] = useState('Materiales');

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
  const isEditing = !!pedidoGuardado;

  // ... (fetchData se mantiene igual) ...
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [
        supabase.from('materiales').select('id, descripcion, unidad_compra, categoria'),
        supabase.from('usuarios').select('id, nombre_completo')
      ];
      if (!isProjectLocked) {
        promises.push(supabase.from('proyectos').select('id, folio, descripcion, cotizacion_folio').in('estatus', ['Por Iniciar', 'En Proceso', 'Detenido']));
      }

      const results = await Promise.all(promises);
      const materialesRes = results[0];
      const usersRes = results[1];
      const proyectosRes = !isProjectLocked ? results[2] : null;

      if (materialesRes.error) throw materialesRes.error;
      setCatalogoMateriales(materialesRes.data || []);

      if (usersRes.error) throw usersRes.error;
      setUsuarios(usersRes.data || []);

      if (!isProjectLocked) {
        if (proyectosRes.error) throw proyectosRes.error;
        setProyectosActivos(proyectosRes.data || []);
      } else {
        setProyectosActivos([proyectoPrefijado]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: 'destructive',
        title: 'Error de conexión',
        description: 'No se pudo cargar la información necesaria. Verifique su conexión o configuración.'
      });
    } finally {
      setLoading(false);
    }
  }, [toast, isProjectLocked, proyectoPrefijado]);

  // CORRECCIÓN PRINCIPAL AQUÍ:
  // Dependemos de `pedidoGuardado?.id` en lugar de todo el objeto `pedidoGuardado` para evitar reinicios por referencia.
  useEffect(() => {
    if (open) {
      fetchData();
      if (!pedidoGuardado) {
        // Reset form for new order
        setSolicitanteId(user?.id || '');
        setTipoAsociacion(isProjectLocked ? 'proyecto' : 'proyecto');
        setAsociacionId(isProjectLocked ? proyectoPrefijado.id.toString() : '');
        setItems([]);
        setMaterialSeleccionado('');
        setCantidad('');
        setObservaciones('');
        setObservacionesGenerales('');
        setEstatus('Pendiente');
        setCategoriaMaterial('Materiales');
        setCurrentPedidoData(null);
      } else {
        // Load existing order data
        setSolicitanteId(pedidoGuardado.solicitante_id || '');
        setTipoAsociacion(pedidoGuardado.proyecto_id ? 'proyecto' : 'cuenta');
        setAsociacionId(pedidoGuardado.proyecto_id ? pedidoGuardado.proyecto_id.toString() : pedidoGuardado.cuenta);
        setObservacionesGenerales(pedidoGuardado.observaciones || '');

        // Solo actualizamos estatus si no estamos en medio de una actualización
        if (!updatingStatus) {
          setEstatus(pedidoGuardado.estatus || 'Pendiente');
        }

        let loadedItems = [];
        // Priorizar la carga desde la estructura de DB si existe
        if (pedidoGuardado.pedidos_materiales_items) {
          loadedItems = pedidoGuardado.pedidos_materiales_items.map(i => ({
            id: i.id,
            uniqueId: i.id,
            material_id: i.material_id,
            descripcion: i.materiales?.descripcion || 'Material',
            cantidad: i.cantidad,
            unidad: i.materiales?.unidad_compra || '',
            observaciones: i.observaciones || '',
            oc_generada: i.oc_generada || '',
            estatus: i.estatus || 'Pendiente'
          }));
        } else if (pedidoGuardado.items) {
          // Fallback por si los datos vienen en otra estructura
          loadedItems = pedidoGuardado.items.map(i => ({
            id: i.id,
            uniqueId: i.id || Math.random().toString(36).substr(2, 9),
            material_id: i.material_id,
            descripcion: i.material?.descripcion || i.descripcion || 'Material',
            cantidad: i.cantidad,
            unidad: i.material?.unidad_compra || i.unidad || '',
            observaciones: i.observaciones || '',
            oc_generada: i.oc_generada || '',
            estatus: i.estatus || 'Pendiente'
          }));
        }
        setItems(loadedItems);
        setCurrentPedidoData({
          ...pedidoGuardado,
          items: loadedItems
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pedidoGuardado?.id]); // Solo recargar si cambia el ID del pedido o se abre el dialogo

  // ... (handleAddItem y handleRemoveItem se mantienen igual) ...
  const handleAddItem = () => {
    if (!materialSeleccionado || !cantidad || parseFloat(cantidad) <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un material y una cantidad válida.' });
      return;
    }
    const material = catalogoMateriales.find(m => m.id.toString() === materialSeleccionado);
    if (!material) return;

    const newItem = {
      uniqueId: Math.random().toString(36).substr(2, 9),
      id: null,
      material_id: material.id,
      descripcion: material.descripcion,
      cantidad: parseFloat(cantidad),
      unidad: material.unidad_compra,
      observaciones,
      oc_generada: '',
      estatus: 'Pendiente'
    };

    setItems(prevItems => [...prevItems, newItem]);
    setMaterialSeleccionado('');
    setCantidad('');
    setObservaciones('');
  };

  const handleRemoveItem = async (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // --- FUNCIÓN CORREGIDA Y MEJORADA ---
  const handleItemChange = async (index, field, value) => {
    // 1. Actualización optimista de la UI
    const updatedItems = [...items];
    const currentItem = { ...updatedItems[index], [field]: value };
    updatedItems[index] = currentItem;
    setItems(updatedItems);

    // 2. Si es edición y el item tiene ID, guardamos inmediatamente
    if (isEditing && currentItem.id) {
      try {
        const { error } = await supabase
          .from('pedidos_materiales_items')
          .update({ [field]: value })
          .eq('id', currentItem.id);

        if (error) throw error;

        // 3. Lógica automática: Si se cambia el estatus, verificar si TODO está entregado
        if (field === 'estatus') {
          // Verificar si todos los items (incluyendo el que acabamos de cambiar) están en 'Entregado'
          const allDelivered = updatedItems.every(item => item.estatus === 'Entregado');

          if (allDelivered && estatus !== 'Entregado') {
            // Actualizar estatus GENERAL del pedido
            const { error: mainError } = await supabase
              .from('pedidos_materiales')
              .update({ estatus: 'Entregado' })
              .eq('id', pedidoGuardado.id);

            if (mainError) throw mainError;

            // Actualizar estado local
            setEstatus('Entregado');

            toast({
              title: "¡Pedido Completado!",
              description: "Todos los materiales han sido entregados. El pedido se marcó como Entregado automáticamente.",
              className: "bg-green-100 border-green-200 text-green-900 font-medium"
            });

            // Notificar al padre para que refresque la lista de atrás
            if (onPedidoUpdated) onPedidoUpdated();
          } else {
            // Feedback sutil
            toast({
              description: "Estatus de item actualizado correctamente",
              className: "bg-gray-100 text-gray-700 border-gray-200",
              duration: 1500
            });
          }
        }

      } catch (error) {
        console.error("Error saving item change:", error);
        toast({
          variant: 'destructive',
          title: 'Error al guardar',
          description: 'No se pudo guardar el cambio en la base de datos.'
        });
        // Revertir cambio local en caso de error crítico (opcional)
      }
    }
  };

  // ... (Resto de funciones: handleItemBlur, handleSave, handleStatusChange, etc. se mantienen igual) ...
  const handleItemBlur = async (index, field, value) => {
    if (isEditing && items[index].id) {
      handleItemChange(index, field, value);
    }
  };

  const handleSave = async () => {
    // ... (lógica original de guardado) ...
    if (!solicitanteId) { toast({ variant: 'destructive', title: 'Error', description: 'Debes seleccionar un solicitante.' }); return; }
    if (!asociacionId) { toast({ variant: 'destructive', title: 'Error', description: 'Debes asociar el pedido a un proyecto o cuenta.' }); return; }
    if (items.length === 0) { toast({ variant: 'destructive', title: 'Error', description: 'Debes agregar al menos un material al pedido.' }); return; }

    setIsSaving(true);
    try {
      const savedPedido = await onSave({
        solicitante_id: solicitanteId,
        tipo: tipoAsociacion,
        asociacionId,
        observaciones_generales: observacionesGenerales,
        items: items.map(i => ({
          id: i.id,
          material_id: i.material_id,
          cantidad: i.cantidad,
          observaciones: i.observaciones,
          oc_generada: i.oc_generada,
          estatus: i.estatus
        })),
        estatus
      });

      const proyecto = tipoAsociacion === 'proyecto' ? (proyectosActivos.find(p => p.id.toString() === asociacionId) || proyectoPrefijado) : null;
      const solicitante = usuarios.find(u => u.id === solicitanteId);

      const dataForPreview = savedPedido || {
        folio: 'NUEVO (Guardado)',
        fecha: new Date(),
        proyecto,
        cuenta: tipoAsociacion === 'cuenta' ? asociacionId : null,
        solicitante,
        observaciones_generales: observacionesGenerales,
        items
      };

      setCurrentPedidoData(dataForPreview);
      setShowFormatSelection(true);

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Hubo un problema al guardar el pedido.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setEstatus(newStatus);
    if (isEditing && pedidoGuardado?.id) {
      setUpdatingStatus(true);
      try {
        const { error } = await supabase
          .from('pedidos_materiales')
          .update({ estatus: newStatus })
          .eq('id', pedidoGuardado.id);

        if (error) throw error;

        toast({ title: "Estatus Actualizado", description: `El pedido ha cambiado a ${newStatus}.` });
        setCurrentPedidoData(prev => ({ ...prev, estatus: newStatus }));
        if (onPedidoUpdated) await onPedidoUpdated();
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus.' });
        setEstatus(pedidoGuardado.estatus);
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
    const proyecto = tipoAsociacion === 'proyecto' ? (proyectosActivos.find(p => p.id.toString() === asociacionId) || proyectoPrefijado) : null;
    const solicitante = usuarios.find(u => u.id === solicitanteId);
    return {
      folio: pedidoGuardado?.folio || 'BORRADOR',
      fecha: pedidoGuardado?.fecha || new Date(),
      proyecto,
      cuenta: tipoAsociacion === 'cuenta' ? asociacionId : null,
      solicitante: solicitante || { nombre_completo: 'Usuario no encontrado' },
      observaciones_generales: observacionesGenerales,
      items,
      estatus
    };
  };

  const handlePrintTESEY = () => {
    setPreselectedFormat('TESEY');
    setShowFormatSelection(true);
  };

  const handleRequestIIHEMSA = () => {
    setPreselectedFormat('IIHEMSA');
    setShowFormatSelection(true);
  };

  const materialOptions = useMemo(() => {
    return catalogoMateriales.filter(m => m.categoria === categoriaMaterial).map(m => ({ value: m.id.toString(), label: m.descripcion }));
  }, [catalogoMateriales, categoriaMaterial]);

  // ... (El return del componente se mantiene igual, solo asegurando que la tabla renderice correctamente los selects) ...
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{pedidoGuardado ? `Detalle Pedido: ${pedidoGuardado.folio}` : 'Nuevo Pedido de Materiales'}</DialogTitle></DialogHeader>

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
                        value={estatus}
                        onValueChange={handleStatusChange}
                        disabled={!isEditing || updatingStatus}
                      >
                        <SelectTrigger id="estatus-select" className={cn(
                          "font-semibold",
                          estatus === 'Pendiente' && "text-yellow-600",
                          estatus === 'Autorizado' && "text-green-600",
                          estatus === 'Entregado' && "text-blue-600"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                  </div>

                  {estatus === 'Pendiente' && (
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
                  <Label htmlFor="solicitante-select">Solicitante</Label>
                  <Select value={solicitanteId} onValueChange={setSolicitanteId} disabled={isEditing}><SelectTrigger id="solicitante-select"><SelectValue placeholder="Seleccione un solicitante..." /></SelectTrigger><SelectContent>{usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre_completo}</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="space-y-4 md:col-span-2">
                  <h3 className="font-semibold text-gray-800 border-t pt-4">Asociar Pedido</h3>
                  <Tabs value={tipoAsociacion} onValueChange={v => { if (!isProjectLocked && !isEditing) { setTipoAsociacion(v); setAsociacionId(''); } }}>
                    <TabsList className={cn("grid w-full", isProjectLocked ? "grid-cols-1" : "grid-cols-2")}><TabsTrigger value="proyecto" disabled={isProjectLocked || isEditing}>Proyecto</TabsTrigger>{!isProjectLocked && <TabsTrigger value="cuenta" disabled={isEditing}>Cuenta</TabsTrigger>}</TabsList>
                    <div className="mt-4">
                      {tipoAsociacion === 'proyecto' && (
                        <>
                          <Label htmlFor="proyecto-select">Seleccionar Proyecto Activo</Label>
                          <Select value={asociacionId} onValueChange={setAsociacionId} disabled={isProjectLocked || isEditing}><SelectTrigger id="proyecto-select"><SelectValue placeholder="Elige un proyecto..." /></SelectTrigger><SelectContent>{proyectosActivos.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.folio} - {p.descripcion}</SelectItem>)}</SelectContent></Select>
                        </>
                      )}
                      {tipoAsociacion === 'cuenta' && !isProjectLocked && (
                        <>
                          <Label htmlFor="cuenta-select">Seleccionar Cuenta de Gasto</Label>
                          <Select value={asociacionId} onValueChange={setAsociacionId} disabled={isEditing}><SelectTrigger id="cuenta-select"><SelectValue placeholder="Elige una cuenta..." /></SelectTrigger><SelectContent>{cuentasGasto.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        </>
                      )}
                    </div>
                  </Tabs>
                </div>
                <div className="space-y-2 md:col-span-2"><h3 className="font-semibold text-gray-800 border-t pt-4">Observaciones Generales del Pedido</h3><Textarea placeholder="Añade aquí cualquier instrucción o comentario general sobre el pedido..." value={observacionesGenerales} onChange={e => setObservacionesGenerales(e.target.value)} disabled={isEditing} /></div>

                {/* Material Addition Section */}
                <div className="space-y-4 md:col-span-2 bg-gray-50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" /> Agregar Materiales
                  </h3>
                  <Tabs value={categoriaMaterial} onValueChange={(value) => { setCategoriaMaterial(value); setMaterialSeleccionado(''); }}>
                    <TabsList className="grid w-full grid-cols-4 h-auto py-1">
                      <TabsTrigger value="Materiales" className="gap-2 text-xs py-2"><Package className="w-3 h-3" />Materiales</TabsTrigger>
                      <TabsTrigger value="Consumibles" className="gap-2 text-xs py-2"><ToyBrick className="w-3 h-3" />Consumibles</TabsTrigger>
                      <TabsTrigger value="Activos" className="gap-2 text-xs py-2"><Cuboid className="w-3 h-3" />Activos</TabsTrigger>
                      <TabsTrigger value="Edificio" className="gap-2 text-xs py-2"><Building2 className="w-3 h-3" />Edificio</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-5">
                      <Label htmlFor="material-select" className="text-xs">Material</Label>
                      <Combobox options={materialOptions} value={materialSeleccionado} onChange={setMaterialSeleccionado} placeholder="Busca un material..." searchPlaceholder="Buscar material..." notFoundMessage="No se encontró el material." className="w-full" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="cantidad" className="text-xs">Cantidad</Label>
                      <Input id="cantidad" type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder="Ej. 10" />
                    </div>
                    <div className="sm:col-span-3">
                      <Label htmlFor="observaciones" className="text-xs">Observaciones</Label>
                      <Input id="observaciones" value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="sm:col-span-2">
                      <Button onClick={handleAddItem} className="w-full gap-2 bg-blue-600 hover:bg-blue-700" size="sm">
                        <PlusCircle className="w-4 h-4" /> Añadir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List with Editable Fields */}
              <div className="space-y-2 mt-4">
                <h3 className="font-semibold text-gray-800">Resumen del Pedido</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-gray-600">Material</th>
                        <th className="text-center px-2 py-3 font-medium text-gray-600 w-24">Cant.</th>
                        <th className="text-left px-2 py-3 font-medium text-gray-600 w-32">OC Generada</th>
                        <th className="text-left px-2 py-3 font-medium text-gray-600 w-36">Estatus Item</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.length > 0 ? items.map((item, index) => (
                        <tr key={item.uniqueId || index} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium">{item.descripcion}</div>
                            {item.observaciones && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <MessageSquare className="w-3 h-3" /> {item.observaciones}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-3 text-center">
                            <span className="font-mono font-medium">{item.cantidad}</span>
                            <span className="text-xs text-gray-500 ml-1">{item.unidad}</span>
                          </td>
                          <td className="px-2 py-3">
                            <div className="relative">
                              <FileText className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                              <Input
                                defaultValue={item.oc_generada || ''}
                                onBlur={(e) => handleItemBlur(index, 'oc_generada', e.target.value)}
                                className="h-8 pl-7 text-xs font-mono"
                                placeholder="OC-..."
                              />
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <Select
                              value={item.estatus || 'Pendiente'}
                              onValueChange={(val) => handleItemChange(index, 'estatus', val)}
                            >
                              <SelectTrigger className={cn(
                                "h-8 text-xs w-full",
                                item.estatus === 'Pendiente' && "text-yellow-600 border-yellow-200 bg-yellow-50",
                                item.estatus === 'En Proceso' && "text-blue-600 border-blue-200 bg-blue-50",
                                item.estatus === 'Entregado' && "text-green-600 border-green-200 bg-green-50"
                              )}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {itemStatusOptions.map(st => (
                                  <SelectItem key={st} value={st} className="text-xs">{st}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-400 hover:text-red-600"
                              onClick={() => handleRemoveItem(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="text-center text-sm text-gray-500 py-8">
                            Aún no has agregado materiales.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 pt-4 border-t gap-2">
            <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cerrar</Button></DialogClose>

            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={isSaving || items.length === 0 || loading} className="bg-green-600 hover:bg-green-700">
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                </Button>

                <div className="flex items-center ml-2">
                  <Button
                    onClick={handlePrintTESEY}
                    variant="secondary"
                    className="gap-2 rounded-r-none border-r border-gray-300"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" className="rounded-l-none px-2">
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

              <Button onClick={handleSave} disabled={isSaving || items.length === 0 || loading}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSaving ? 'Guardando...' : 'Guardar y Generar Formato'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
};

export default NuevoPedidoDialog;