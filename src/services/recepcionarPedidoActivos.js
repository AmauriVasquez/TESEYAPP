/**
 * Recepción de pedido tipo "activo": genera filas en activos + pedido_activos (RPC idempotente).
 */
export async function recepcionarPedidoActivosSiAplica(supabase, { pedidoId, nuevoEstatus, tipoPedido }) {
  if (nuevoEstatus !== 'Entregado' || (tipoPedido ?? 'material') !== 'activo') {
    return { ok: true, skipped: true };
  }

  const { data, error } = await supabase.rpc('recepcionar_pedido_activos', {
    p_pedido_id: pedidoId,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  const row = data;
  if (row && typeof row === 'object' && row.ok === false) {
    return { ok: false, message: row.error || 'No se pudo recepcionar el pedido de activos.' };
  }

  // Frontend safety-net: asegurar que el nombre base del activo use la descripción capturada en el ítem.
  // Esto mantiene compatibilidad incluso si la función SQL de recepción no fue actualizada.
  try {
    const { data: links, error: linksError } = await supabase
      .from('pedido_activos')
      .select('activo_id, pedido_item_id')
      .eq('pedido_id', pedidoId);
    if (linksError) throw linksError;

    const itemIds = [...new Set((links ?? []).map((l) => l.pedido_item_id).filter(Boolean))];
    if (itemIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('pedidos_materiales_items')
        .select('id, descripcion')
        .in('id', itemIds);
      if (itemsError) throw itemsError;

      const descMap = Object.fromEntries(
        (items ?? [])
          .map((i) => [i.id, String(i.descripcion ?? '').trim()])
          .filter(([, d]) => d.length > 0)
      );

      const updates = (links ?? [])
        .map((l) => ({ activo_id: l.activo_id, descripcion: descMap[l.pedido_item_id] }))
        .filter((u) => u.activo_id && u.descripcion);

      await Promise.all(
        updates.map((u) =>
          supabase.from('activos').update({ nombre: u.descripcion }).eq('id', u.activo_id)
        )
      );
    }
  } catch (syncErr) {
    console.error('[recepcionarPedidoActivos] No se pudo sincronizar nombre desde descripcion:', syncErr);
  }

  return { ok: true, result: row };
}
