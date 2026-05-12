
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle, Loader2, Trash2, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchPedidosMaterialesListCompat, fetchPedidoMaterialesByIdCompat } from '@/lib/supabasePedidosCompat';
import { format } from 'date-fns';
import { formatDateTable } from '@/lib/dateUtils';
import NuevoPedidoDialog from '@/components/pedidos/NuevoPedidoDialog';
import EstatusPedidoBadge from '@/components/pedidos/EstatusPedidoBadge';

const PedidosMateriales = ({ isEmbedded = false }) => {
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nuevoPedidoDialogOpen, setNuevoPedidoDialogOpen] = useState(false);
  const [pedidoGuardado, setPedidoGuardado] = useState(null);

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error, mode } = await fetchPedidosMaterialesListCompat(supabase, {
        order: { column: 'id', ascending: false },
      });
      if (mode === 'failed' || error) {
        console.error('[pedidos] fetchPedidos falló:', error?.message, error);
        toast({ variant: 'destructive', title: 'Error', description: error?.message ?? 'No se pudieron cargar los pedidos.' });
        setPedidos([]);
        return;
      }
      setPedidos(data ?? []);
    } catch (error) {
      console.error('[DEBUG pedidos_materiales] Error en fetchPedidos:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los pedidos.' });
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  const pedidoGuardadoId = pedidoGuardado?.id;
  useEffect(() => {
    if (pedidoGuardadoId == null || pedidos.length === 0) return;
    const updated = pedidos.find((p) => p.id === pedidoGuardadoId);
    if (updated) setPedidoGuardado(updated);
  }, [pedidos, pedidoGuardadoId]);

  const handleCreatePedido = useCallback(async ({ solicitante_id, tipo, asociacionId, observaciones_generales, items, estatus, prioridad, tipo_pedido }) => {
    try {
      const { data: lastPedido, error: folioError } = await supabase
      .from('pedidos_materiales')
      .select('folio')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
      
      if (folioError) throw folioError;

      const nextFolioNumber = lastPedido ? parseInt(String(lastPedido.folio).split('-')[1], 10) + 1 : 1;
    const newFolio = `PED-${String(nextFolioNumber).padStart(4, '0')}`;

    const pedidoData = {
      folio: newFolio,
      fecha: new Date().toISOString().split('T')[0],
      solicitante_id,
      estatus: estatus || 'Pendiente',
      prioridad: prioridad || 'Normal',
      tipo_pedido: tipo_pedido === 'activo' ? 'activo' : 'material',
      proyecto_id: tipo === 'proyecto' && asociacionId ? Number(asociacionId) : null,
      cuenta: tipo === 'cuenta' ? asociacionId : null,
      observaciones: observaciones_generales,
    };

      const { data: newPedido, error: pedidoError } = await supabase.from('pedidos_materiales').insert(pedidoData).select().single();
      if (pedidoError) throw pedidoError;

      // Insert Items
    // FIX: Use `material_id` property, not `id` (which is the row ID, null for new items)
    const tp = tipo_pedido === 'activo' ? 'activo' : 'material';
    const itemsToInsert = items.map(item => ({ 
        pedido_id: newPedido.id, 
        material_id: tp === 'material' ? item.material_id : null,
        categoria_id: tp === 'activo' ? item.categoria_id : null,
        unidad_id: item.unidad_id ?? null,
        descripcion: tp === 'activo' ? (item.descripcion ?? null) : (item.descripcion ?? null),
        marca: tp === 'activo' ? (item.marca ?? null) : null,
        modelo: tp === 'activo' ? (item.modelo ?? null) : null,
        requiere_mantenimiento: tp === 'activo' ? (item.requiere_mantenimiento ?? false) : null,
        requiere_responsiva: tp === 'activo' ? (item.requiere_responsiva ?? false) : null,
        cantidad: item.cantidad, 
        observaciones: item.observaciones,
        orden_compra_id: item.orden_compra_id ?? null,
        precio_unitario: item.precio_unitario ?? null
    }));

      const { error: itemsError } = await supabase.from('pedidos_materiales_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      toast({ title: '✅ Pedido Creado', description: `Se creó el pedido ${newFolio}.` });
      fetchPedidos();
      const { data: fullPedido, error: reloadErr, mode: reloadMode } = await fetchPedidoMaterialesByIdCompat(
        supabase,
        newPedido.id
      );
      if (reloadMode === 'failed' || reloadErr) {
        console.warn('[DEBUG pedidos_materiales] recarga tras crear:', reloadErr?.message);
        setPedidoGuardado(newPedido);
      } else {
        setPedidoGuardado(fullPedido ?? newPedido);
      }
      return { ...newPedido, items };
    } catch (error) {
      console.error('Error en handleCreatePedido:', error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message ?? 'No se pudo crear el pedido.' });
      return null;
    }
  }, [toast, fetchPedidos]);

  const handleUpdatePedido = useCallback(async (formData) => {
    const { solicitante_id, tipo, asociacionId, observaciones_generales, items, estatus, prioridad } = formData;
    const pedidoId = pedidoGuardado?.id;
    if (!pedidoId) return null;
    try {
      const { error: updateError } = await supabase.from('pedidos_materiales').update({
        solicitante_id,
        proyecto_id: tipo === 'proyecto' && asociacionId ? Number(asociacionId) : null,
        cuenta: tipo === 'cuenta' ? asociacionId : null,
        observaciones: observaciones_generales,
        estatus,
        prioridad: prioridad ?? 'Normal'
      }).eq('id', pedidoId);

      if (updateError) throw updateError;

      const currentItemIds = (items ?? []).filter((i) => i.id).map((i) => i.id);
      if (currentItemIds.length > 0) {
        const { error: delErr } = await supabase.from('pedidos_materiales_items').delete().eq('pedido_id', pedidoId).not('id', 'in', `(${currentItemIds.join(',')})`);
        if (delErr) throw delErr;
      } else if ((items ?? []).length === 0) {
        const { error: delErr } = await supabase.from('pedidos_materiales_items').delete().eq('pedido_id', pedidoId);
        if (delErr) throw delErr;
      }

      const tp = (pedidoGuardado?.tipo_pedido ?? 'material') === 'activo' ? 'activo' : 'material';
      const itemsToUpsert = (items ?? []).map((item) => ({
        id: item.id,
        pedido_id: pedidoId,
        material_id: tp === 'material' ? item.material_id : null,
        categoria_id: tp === 'activo' ? item.categoria_id : null,
        unidad_id: item.unidad_id ?? null,
        descripcion: item.descripcion ?? null,
        marca: tp === 'activo' ? (item.marca ?? null) : null,
        modelo: tp === 'activo' ? (item.modelo ?? null) : null,
        requiere_mantenimiento: tp === 'activo' ? (item.requiere_mantenimiento ?? false) : null,
        requiere_responsiva: tp === 'activo' ? (item.requiere_responsiva ?? false) : null,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        orden_compra_id: item.orden_compra_id ?? null,
        precio_unitario: item.precio_unitario ?? null
      }));

      const { error: upsertError } = await supabase.from('pedidos_materiales_items').upsert(itemsToUpsert);
      if (upsertError) throw upsertError;

      toast({ title: '✅ Pedido Actualizado', description: 'Los cambios han sido guardados.' });
      fetchPedidos();
      return { ...pedidoGuardado, ...formData };
    } catch (error) {
      console.error('Error en handleUpdatePedido:', error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message ?? 'No se pudo actualizar el pedido.' });
      return null;
    }
  }, [pedidoGuardado, toast, fetchPedidos]);

  const handleSavePedido = useCallback(async (formData) => {
    if (pedidoGuardado?.id) return handleUpdatePedido(formData);
    return handleCreatePedido(formData);
  }, [pedidoGuardado?.id, handleUpdatePedido, handleCreatePedido]);

  const handleDeletePedido = useCallback(async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.')) return;
    try {
      const { error: itemsError } = await supabase.from('pedidos_materiales_items').delete().eq('pedido_id', id);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from('pedidos_materiales').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Pedido eliminado', description: 'El pedido ha sido eliminado correctamente.' });
      if (pedidoGuardado?.id === id) setPedidoGuardado(null);
      fetchPedidos();
    } catch (error) {
      console.error('Error en handleDeletePedido:', error);
      toast({ variant: 'destructive', title: 'Error', description: error?.message ?? 'No se pudo eliminar el pedido.' });
    }
  }, [toast, fetchPedidos, pedidoGuardado?.id]);

  const handleOpenNewPedidoDialog = useCallback(() => {
    setPedidoGuardado(null);
    setNuevoPedidoDialogOpen(true);
  }, []);

  const handleViewPedido = useCallback((pedido) => {
    setPedidoGuardado(pedido ?? null);
    setNuevoPedidoDialogOpen(true);
  }, []);

  const genUniqueId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));

  const handleDuplicateOrder = useCallback((pedido) => {
    const rawItems = pedido.pedidos_materiales_items ?? pedido.items ?? [];
    const tp = pedido.tipo_pedido === 'activo' ? 'activo' : 'material';
    const clonedItems = rawItems.map((i) => ({
      id: undefined,
      uniqueId: genUniqueId(),
      material_id: tp === 'material' ? i.material_id : null,
      categoria_id: tp === 'activo' ? i.categoria_id : null,
      unidad_id: i.unidad_id ?? null,
      marca: tp === 'activo' ? (i.marca ?? null) : null,
      modelo: tp === 'activo' ? (i.modelo ?? null) : null,
      requiere_mantenimiento: tp === 'activo' ? (i.requiere_mantenimiento ?? false) : null,
      requiere_responsiva: tp === 'activo' ? (i.requiere_responsiva ?? false) : null,
      descripcion:
        tp === 'activo'
          ? (i.descripcion ?? 'Sin descripción')
          : (i.materiales?.descripcion ?? i.descripcion ?? 'Material'),
      cantidad: i.cantidad,
      unidad:
        (i.catalogo_unidades?.nombre ?? i.unidad ?? '').toString().trim() ||
        (i.materiales?.unidad_compra ?? '') ||
        '',
      observaciones: i.observaciones ?? '',
      orden_compra_id: null,
      precio_unitario: null,
      oc_folio: null,
      oc_estatus: null,
    }));
    setPedidoGuardado({
      id: undefined,
      folio: '',
      fecha: new Date().toISOString().split('T')[0],
      solicitante_id: pedido.solicitante_id,
      tipo_pedido: tp,
      proyecto_id: pedido.proyecto_id ?? null,
      cuenta: pedido.cuenta ?? null,
      observaciones: pedido.observaciones ?? '',
      estatus: 'Pendiente',
      prioridad: pedido.prioridad ?? 'Normal',
      proyecto: pedido.proyecto,
      solicitante: pedido.solicitante,
      pedidos_materiales_items: clonedItems,
    });
    setNuevoPedidoDialogOpen(true);
  }, []);

  const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const pedidosUrgentes = pedidos.filter((p) => {
    const prioridad = (p.prioridad ?? 'Normal').trim();
    const esUrgente = prioridad === 'Alta' || prioridad === 'Urgente';
    const estatus = (p.estatus ?? '').toLowerCase();
    const completado = ['entregado', 'completada', 'cancelada'].some((c) => estatus.includes(c));
    return esUrgente && !completado;
  }).length;
  const pedidosEstancados = pedidos.filter((p) => {
    const created = p.created_at ?? p.fecha;
    if (!created) return false;
    const estatus = (p.estatus ?? '').toLowerCase();
    const pendienteOC = estatus.includes('pendiente') && !estatus.includes('entrega');
    return created < cutoff48h && pendienteOC;
  }).length;
  const pendientesProcesar = pedidos.filter((p) => {
    if ((p.tipo_pedido ?? 'material') === 'activo') return false;
    const items = p.pedidos_materiales_items ?? [];
    const sinOC = items.length === 0 || items.some((i) => !i.orden_compra_id);
    return sinOC;
  }).length;

  const MainContent = () => (
    <div className="space-y-6">
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pedidos de Materiales</h2>
            <p className="text-gray-600 mt-1">Consulta el historial de solicitudes y su relación con las órdenes de compra.</p>
          </div>
        </div>
      )}
      <div className="flex flex-nowrap overflow-x-auto gap-4 pb-2 snap-x md:grid md:grid-cols-3 md:overflow-visible md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[220px] md:min-w-0 snap-center shrink-0 rounded-xl border bg-red-50 border-red-200 p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-red-800">Pedidos Urgentes</p>
          <p className="text-xl md:text-2xl font-bold text-red-900">{pedidosUrgentes}</p>
        </div>
        <div className="min-w-[220px] md:min-w-0 snap-center shrink-0 rounded-xl border bg-orange-50 border-orange-200 p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-orange-800">Pedidos Estancados</p>
          <p className="text-xl md:text-2xl font-bold text-orange-900">{pedidosEstancados}</p>
        </div>
        <div className="min-w-[220px] md:min-w-0 snap-center shrink-0 rounded-xl border bg-blue-50 border-blue-200 p-3 md:p-4">
          <p className="text-xs md:text-sm font-medium text-blue-800">Pendientes de Procesar</p>
          <p className="text-xl md:text-2xl font-bold text-blue-900">{pendientesProcesar}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleOpenNewPedidoDialog} className="gap-1.5 h-8 px-3 text-xs md:h-10 md:px-4 md:text-sm">
            <PlusCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> Nuevo Pedido
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
              {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                <table className="w-full min-w-[720px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio Pedido</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asociado a</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden de Compra</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {(pedidos ?? []).map((pedido) => (
                          <tr key={pedido?.id ?? pedido.folio} className="hover:bg-gray-50">
                              <td className="px-4 py-4 font-medium text-blue-600">{pedido?.folio ?? '-'}</td>
                              <td className="px-4 py-4 text-sm">
                                {(pedido?.tipo_pedido ?? 'material') === 'activo' ? (
                                  <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">Activo</span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Material</span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-sm text-gray-800">{pedido?.proyecto?.folio ?? (pedido?.cuenta != null ? `Cuenta: ${pedido.cuenta}` : 'N/A')}</td>
                              <td className="px-4 py-4 text-sm text-gray-600">{formatDateTable(pedido?.fecha)}</td>
                              <td className="px-4 py-4 text-sm text-gray-800">{pedido?.solicitante?.nombre_completo ?? 'N/A'}</td>
                              <td className="px-4 py-4 text-sm">{pedido?.oc_folio ? <span className="font-mono text-purple-700">{pedido.oc_folio}</span> : <span className="text-gray-400 text-xs">-</span>}</td>
                              <td className="px-4 py-4"><EstatusPedidoBadge estatus={pedido?.estatus} /></td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-0.5 md:gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8" onClick={() => handleViewPedido(pedido)} title="Ver / Editar">
                                    <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8" title="Pedir de nuevo" onClick={() => handleDuplicateOrder(pedido)}>
                                    <Copy className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeletePedido(pedido.id)} title="Eliminar">
                                    <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                  </Button>
                                </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              )}
              {pedidos.length === 0 && !loading && <p className="text-center py-10 text-gray-500">No hay pedidos registrados.</p>}
          </div>
      </div>
      
      <NuevoPedidoDialog 
        open={nuevoPedidoDialogOpen} 
        onOpenChange={setNuevoPedidoDialogOpen}
        onSave={handleSavePedido}
        pedidoGuardado={pedidoGuardado}
        onPedidoUpdated={fetchPedidos}
      />
    </div>
  );

  return isEmbedded ? <MainContent /> : (
    <>
      <Helmet><title>Pedidos de Materiales - IIHEMSA Peninsular</title></Helmet>
      <MainContent />
    </>
  );
};

export default PedidosMateriales;
