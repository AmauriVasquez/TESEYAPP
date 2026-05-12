
import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Button } from '@/components/ui/button';
import { Eye, PlusCircle, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
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
    const { data, error } = await supabase
      .from('pedidos_materiales')
      .select(`
        *, 
        proyecto:proyecto_id(folio, descripcion, cotizacion_folio), 
        solicitante:solicitante_id(nombre_completo),
        pedidos_materiales_items(
            id,
            cantidad,
            observaciones,
            material_id,
            oc_generada,
            estatus,
            materiales(descripcion, unidad_compra)
        )
      `)
      .order('id', { ascending: false });
    
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los pedidos.' });
    } else {
      setPedidos(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // Sincronizar el pedido seleccionado cuando la lista de pedidos se actualice
  useEffect(() => {
    if (pedidoGuardado && pedidos.length > 0) {
      const pedidoActualizado = pedidos.find(p => p.id === pedidoGuardado.id);
      if (pedidoActualizado && JSON.stringify(pedidoActualizado) !== JSON.stringify(pedidoGuardado)) {
        setPedidoGuardado(pedidoActualizado);
      }
    }
  }, [pedidos, pedidoGuardado]);

  const handleSavePedido = async (formData) => {
    if (pedidoGuardado) {
        return handleUpdatePedido(formData);
    } else {
        return handleCreatePedido(formData);
    }
  };

  const handleCreatePedido = async ({ solicitante_id, tipo, asociacionId, observaciones_generales, items, estatus }) => {
    // Generate Folio
    const { data: lastPedido, error: folioError } = await supabase
      .from('pedidos_materiales')
      .select('folio')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (folioError) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio.' });
      return null;
    }

    const nextFolioNumber = lastPedido ? parseInt(lastPedido.folio.split('-')[1]) + 1 : 1;
    const newFolio = `PED-${String(nextFolioNumber).padStart(4, '0')}`;

    const pedidoData = {
      folio: newFolio,
      fecha: new Date().toISOString().split('T')[0],
      solicitante_id,
      estatus: estatus || 'Pendiente',
      proyecto_id: tipo === 'proyecto' ? asociacionId : null,
      cuenta: tipo === 'cuenta' ? asociacionId : null,
      observaciones: observaciones_generales,
    };

    // Insert Header
    const { data: newPedido, error: pedidoError } = await supabase.from('pedidos_materiales').insert(pedidoData).select().single();
    if (pedidoError) {
      toast({ variant: 'destructive', title: 'Error', description: pedidoError.message });
      return null;
    }

    // Insert Items
    // FIX: Use `material_id` property, not `id` (which is the row ID, null for new items)
    const itemsToInsert = items.map(item => ({ 
        pedido_id: newPedido.id, 
        material_id: item.material_id, 
        cantidad: item.cantidad, 
        observaciones: item.observaciones,
        oc_generada: item.oc_generada,
        estatus: item.estatus || 'Pendiente'
    }));

    const { error: itemsError } = await supabase.from('pedidos_materiales_items').insert(itemsToInsert);
    if (itemsError) {
      console.error("Error inserting items:", itemsError);
      toast({ variant: 'destructive', title: 'Error guardando partidas', description: itemsError.message });
      return null;
    }

    toast({ title: '✅ Pedido Creado', description: `Se creó el pedido ${newFolio}.` });
    setPedidoGuardado(newPedido);
    fetchPedidos();
    
    return {
        ...newPedido,
        items: items 
    };
  };

  const handleUpdatePedido = async (formData) => {
    const { solicitante_id, tipo, asociacionId, observaciones_generales, items, estatus } = formData;

    // 1. Update Header
    const { error: updateError } = await supabase.from('pedidos_materiales').update({
        solicitante_id,
        proyecto_id: tipo === 'proyecto' ? asociacionId : null,
        cuenta: tipo === 'cuenta' ? asociacionId : null,
        observaciones: observaciones_generales,
        estatus
    }).eq('id', pedidoGuardado.id);

    if (updateError) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el pedido.' });
        return null;
    }

    // 2. Handle Items (Delete missing, Upsert current)
    
    // Get IDs of items currently in the form
    const currentItemIds = items.filter(i => i.id).map(i => i.id);

    // Delete items that are no longer in the form
    // Note: This assumes items with NO ID are new and will be inserted.
    if (currentItemIds.length > 0) {
        // Delete items belonging to this pedido that are NOT in the current list
        await supabase.from('pedidos_materiales_items')
            .delete()
            .eq('pedido_id', pedidoGuardado.id)
            .not('id', 'in', `(${currentItemIds.join(',')})`);
    } else {
        // If no existing IDs are present, it means user deleted all previous items or replaced them.
        // CAREFUL: If user just added new ones without IDs, we might want to clear old ones?
        // For safety, if currentItemIds is empty but we are updating, we might need to query first or just delete all if logic allows.
        // Let's assume simple strategy: if we have items, we upsert. If we deleted everything in UI, we delete everything in DB.
        if (items.length === 0) {
             await supabase.from('pedidos_materiales_items').delete().eq('pedido_id', pedidoGuardado.id);
        }
    }

    // Upsert items (Update existing, Insert new)
    const itemsToUpsert = items.map(item => ({
        id: item.id, // If null/undefined, Supabase treats as insert (if column is identity)
        pedido_id: pedidoGuardado.id,
        material_id: item.material_id,
        cantidad: item.cantidad,
        observaciones: item.observaciones,
        oc_generada: item.oc_generada,
        estatus: item.estatus || 'Pendiente'
    }));

    const { error: upsertError } = await supabase.from('pedidos_materiales_items').upsert(itemsToUpsert);
    
    if (upsertError) {
        console.error(upsertError);
        toast({ variant: 'destructive', title: 'Error', description: 'Error al actualizar las partidas.' });
        return null;
    }

    toast({ title: '✅ Pedido Actualizado', description: 'Los cambios han sido guardados.' });
    fetchPedidos();
    return { ...pedidoGuardado, ...formData };
  };

  const handleDeletePedido = async (id) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este pedido? Esta acción no se puede deshacer.')) {
      return;
    }

    const { error: itemsError } = await supabase
      .from('pedidos_materiales_items')
      .delete()
      .eq('pedido_id', id);

    if (itemsError) {
      console.error('Error deleting items:', itemsError);
      toast({ variant: 'destructive', title: 'Error', description: 'Error al eliminar las partidas del pedido.' });
      return;
    }

    const { error } = await supabase
      .from('pedidos_materiales')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting pedido:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el pedido.' });
    } else {
      toast({ title: 'Pedido eliminado', description: 'El pedido ha sido eliminado correctamente.' });
      if (pedidoGuardado && pedidoGuardado.id === id) {
        setPedidoGuardado(null);
      }
      fetchPedidos();
    }
  };

  const handleOpenNewPedidoDialog = () => {
    setPedidoGuardado(null);
    setNuevoPedidoDialogOpen(true);
  };

  const handleViewPedido = (pedido) => {
      setPedidoGuardado(pedido);
      setNuevoPedidoDialogOpen(true);
  };

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
      <div className="flex justify-end">
        <Button onClick={handleOpenNewPedidoDialog} className="gap-2">
            <PlusCircle className="w-4 h-4" /> Nuevo Pedido
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
              {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio Pedido</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asociado a</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitante</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orden de Compra</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                      {pedidos.map(pedido => (
                          <tr key={pedido.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 font-medium text-blue-600">{pedido.folio}</td>
                              <td className="px-4 py-4 text-sm text-gray-800">{pedido.proyecto?.folio || `Cuenta: ${pedido.cuenta}`}</td>
                              <td className="px-4 py-4 text-sm text-gray-600">{format(new Date(pedido.fecha + 'T00:00:00'), 'dd/MMM/yyyy')}</td>
                              <td className="px-4 py-4 text-sm text-gray-800">{pedido.solicitante?.nombre_completo || 'N/A'}</td>
                              <td className="px-4 py-4 text-sm">{pedido.oc_folio ? <span className="font-mono text-purple-700">{pedido.oc_folio}</span> : <span className="text-gray-400 text-xs">-</span>}</td>
                              <td className="px-4 py-4"><EstatusPedidoBadge estatus={pedido.estatus} /></td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => handleViewPedido(pedido)}>
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50" 
                                    onClick={() => handleDeletePedido(pedido.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
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
      <Helmet><title>Pedidos de Materiales - Sistema TESEY</title></Helmet>
      <MainContent />
    </>
  );
};

export default PedidosMateriales;
