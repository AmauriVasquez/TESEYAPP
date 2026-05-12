/**
 * Lógica de recepción de materiales sobre ordenes_compra_items y estado_entrega de la OC.
 */

export const ESTADO_ENTREGA_OC = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Entrega Parcial',
  COMPLETA: 'Entrega Completa',
};

/** Normaliza valor guardado en BD (nuevo o legado) para clases de badge. */
export function entregaBadgeKeyFromDb(raw) {
  const s = (raw ?? '').toString().toLowerCase();
  if (s.includes('completa')) return 'completa';
  if (s.includes('parcial')) return 'parcial';
  return 'pendiente';
}

/** Etiqueta legible para mostrar en UI. */
export function entregaLabelFromKey(key) {
  if (key === 'completa') return ESTADO_ENTREGA_OC.COMPLETA;
  if (key === 'parcial') return ESTADO_ENTREGA_OC.PARCIAL;
  return ESTADO_ENTREGA_OC.PENDIENTE;
}

/**
 * @param {{ cantidad?: number|string|null, cantidad_recibida?: number|string|null }[]} items
 * @returns {string} ESTADO_ENTREGA_OC value
 */
export function computeEstadoEntregaFromItems(items) {
  if (!items?.length) return ESTADO_ENTREGA_OC.PENDIENTE;
  let algunaRecepcion = false;
  let todasCompletas = true;
  for (const it of items) {
    const ped = Number(it.cantidad) || 0;
    const rec = Number(it.cantidad_recibida) || 0;
    if (rec > 0) algunaRecepcion = true;
    if (ped <= 0 || rec < ped) todasCompletas = false;
  }
  if (todasCompletas) return ESTADO_ENTREGA_OC.COMPLETA;
  if (algunaRecepcion) return ESTADO_ENTREGA_OC.PARCIAL;
  return ESTADO_ENTREGA_OC.PENDIENTE;
}

/**
 * Recalcula y persiste ordenes_compra.estado_entrega.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|number} ordenCompraId
 */
export async function recalcularEstadoEntregaOc(supabase, ordenCompraId) {
  const { data: items, error } = await supabase
    .from('ordenes_compra_items')
    .select('cantidad, cantidad_recibida')
    .eq('orden_compra_id', ordenCompraId);
  if (error) throw error;
  const estado = computeEstadoEntregaFromItems(items ?? []);
  const { error: upErr } = await supabase.from('ordenes_compra').update({ estado_entrega: estado }).eq('id', ordenCompraId);
  if (upErr) throw upErr;
  return estado;
}

/**
 * Sincroniza cantidad_recibida en pedidos_materiales_items al acumular recepción en OC.
 */
async function syncPedidoItemRecibida(supabase, pedidoItemId, cantidadAAgregar) {
  if (pedidoItemId == null || cantidadAAgregar <= 0) return;
  const { data: pmi, error: fe } = await supabase
    .from('pedidos_materiales_items')
    .select('id, cantidad, cantidad_recibida')
    .eq('id', pedidoItemId)
    .single();
  if (fe || !pmi) return;
  const pPed = Number(pmi.cantidad) || 0;
  const pRec = Number(pmi.cantidad_recibida) || 0;
  const pNuevo = Math.min(pPed, pRec + cantidadAAgregar);
  await supabase.from('pedidos_materiales_items').update({ cantidad_recibida: pNuevo }).eq('id', pedidoItemId);
}

/**
 * Recepción parcial: suma a cantidad_recibida sin exceder cantidad pedida.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|number} itemId - ordenes_compra_items.id
 * @param {number|string} cantidadAAgregar
 */
export async function recibirItemOc(supabase, itemId, cantidadAAgregar) {
  const add = Number(cantidadAAgregar);
  if (!Number.isFinite(add) || add <= 0) {
    return { ok: false, error: new Error('La cantidad a recibir debe ser mayor a cero.') };
  }

  const { data: row, error: fe } = await supabase
    .from('ordenes_compra_items')
    .select('id, orden_compra_id, cantidad, cantidad_recibida, pedido_item_id')
    .eq('id', itemId)
    .single();
  if (fe || !row) {
    return { ok: false, error: fe ?? new Error('Ítem de OC no encontrado.') };
  }

  const ped = Number(row.cantidad) || 0;
  const rec = Number(row.cantidad_recibida) || 0;
  const pendiente = Math.max(0, ped - rec);
  const aplicar = Math.min(add, pendiente);
  if (aplicar <= 0) {
    return { ok: false, error: new Error('No hay cantidad pendiente por recibir en esta partida.') };
  }

  const nuevoRec = rec + aplicar;
  const { error: ue } = await supabase.from('ordenes_compra_items').update({ cantidad_recibida: nuevoRec }).eq('id', itemId);
  if (ue) return { ok: false, error: ue };

  await syncPedidoItemRecibida(supabase, row.pedido_item_id, aplicar);
  await recalcularEstadoEntregaOc(supabase, row.orden_compra_id);

  return { ok: true, cantidad_recibida: nuevoRec, aplicada: aplicar };
}

/**
 * Marca todas las partidas como recibidas al 100 %.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string|number} ordenCompraId
 */
export async function recibirOcCompleta(supabase, ordenCompraId) {
  const { data: items, error } = await supabase
    .from('ordenes_compra_items')
    .select('id, cantidad, cantidad_recibida, pedido_item_id')
    .eq('orden_compra_id', ordenCompraId);
  if (error) throw error;
  if (!items?.length) {
    throw new Error('La orden de compra no tiene partidas.');
  }

  for (const it of items) {
    const ped = Number(it.cantidad) || 0;
    const rec = Number(it.cantidad_recibida) || 0;
    const delta = Math.max(0, ped - rec);
    const { error: upErr } = await supabase.from('ordenes_compra_items').update({ cantidad_recibida: ped }).eq('id', it.id);
    if (upErr) throw upErr;
    if (delta > 0) {
      await syncPedidoItemRecibida(supabase, it.pedido_item_id, delta);
    }
  }

  await recalcularEstadoEntregaOc(supabase, ordenCompraId);
  return { ok: true };
}
