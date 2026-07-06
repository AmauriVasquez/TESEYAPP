import { supabase } from '@/lib/customSupabaseClient';
import { mapEntregaItemRow } from '@/components/EntregaModal';

// Arma la cotización + { items, cliente, vendedor } con la MISMA forma que
// SeleccionarFormatoCotizacionDialog, para alimentar FormatoCotizacionTESEY.
async function fetchCotizacionCompleta(cotizacionId) {
  if (!cotizacionId) return null;

  const { data: cotizacion, error: quoteError } = await supabase
    .from('cotizaciones')
    .select('*')
    .eq('id', cotizacionId)
    .single();
  if (quoteError) throw quoteError;
  if (!cotizacion) return null;

  const { data: itemsData, error: itemsError } = await supabase
    .from('cotizaciones_items')
    .select('*')
    .eq('cotizacion_id', cotizacion.id);
  if (itemsError) throw itemsError;

  let clienteData = cotizacion.cliente;
  if (!clienteData && cotizacion.cliente_id) {
    const { data: client, error: clientError } = await supabase
      .from('clientes')
      .select('nombre')
      .eq('id', cotizacion.cliente_id)
      .single();
    if (!clientError) clienteData = client;
  }

  let vendedorData = null;
  if (cotizacion.usuario_cotizacion) {
    const { data: vendor, error: vendorError } = await supabase
      .from('usuarios')
      .select('nombre_completo, telefono, correo')
      .eq('nombre_completo', cotizacion.usuario_cotizacion)
      .maybeSingle();
    if (!vendorError && vendor) vendedorData = vendor;
    else {
      const { data: vendorLike } = await supabase
        .from('usuarios')
        .select('nombre_completo, telefono, correo')
        .ilike('nombre_completo', `%${cotizacion.usuario_cotizacion}%`)
        .limit(1)
        .maybeSingle();
      if (vendorLike) vendedorData = vendorLike;
    }
  }

  return { ...cotizacion, cliente: clienteData, items: itemsData || [], vendedor: vendedorData };
}

export async function getDatosReporteEntrega({ proyectoId, cotizacionId }) {
  const cotizacion = await fetchCotizacionCompleta(cotizacionId);

  // Entregas del proyecto, orden cronológico (fecha asc, fallback created_at).
  const { data: entregasRaw, error: entregasError } = await supabase
    .from('entregas')
    .select('id, fecha, recibe_nombre, comentarios, foto_url, firma_url, created_at')
    .eq('proyecto_id', proyectoId)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });
  if (entregasError) throw entregasError;

  const entregasBase = entregasRaw || [];
  const sinEntregas = entregasBase.length === 0;

  // descripcion/unidad por partida (reuso de items ya traídos, o query propia).
  let itemsById = new Map(
    (cotizacion?.items || []).map((it) => [String(it.id), it])
  );
  if (itemsById.size === 0 && cotizacionId) {
    const { data: ci, error: ciError } = await supabase
      .from('cotizaciones_items')
      .select('id, descripcion, unidad')
      .eq('cotizacion_id', cotizacionId);
    if (ciError) throw ciError;
    itemsById = new Map((ci || []).map((it) => [String(it.id), it]));
  }

  // Todos los renglones de todas las entregas en un solo query.
  let itemsPorEntrega = new Map();
  if (!sinEntregas) {
    const entregaIds = entregasBase.map((e) => e.id);
    const { data: eItems, error: eItemsError } = await supabase
      .from('entregas_items')
      .select('entrega_id, cotizacion_item_id, cantidad_entregada')
      .in('entrega_id', entregaIds);
    if (eItemsError) throw eItemsError;

    for (const row of eItems || []) {
      const partida = itemsById.get(String(row.cotizacion_item_id));
      const lista = itemsPorEntrega.get(row.entrega_id) || [];
      lista.push({
        descripcion: partida?.descripcion ?? '—',
        unidad: partida?.unidad ?? '',
        cantidad_entregada: Number(row.cantidad_entregada),
      });
      itemsPorEntrega.set(row.entrega_id, lista);
    }
  }

  const entregas = entregasBase.map((e) => ({
    id: e.id,
    fecha: e.fecha ?? e.created_at,
    recibe_nombre: e.recibe_nombre,
    comentarios: e.comentarios,
    foto_url: e.foto_url,
    firma_url: e.firma_url,
    items: itemsPorEntrega.get(e.id) || [],
  }));

  // Reconciliación por partida desde la RPC, normalizada como en EntregaModal.
  let partidas = [];
  if (cotizacionId) {
    const { data: recRaw, error: recError } = await supabase.rpc('get_items_con_pendiente', {
      cotizacion_id_input: cotizacionId,
    });
    if (recError) throw recError;
    partidas = (Array.isArray(recRaw) ? recRaw : []).map(mapEntregaItemRow).map((r) => ({
      descripcion: r.descripcion,
      total: r.total,
      entregado: r.entregado,
      pendiente: r.pendiente,
    }));
  }

  const partidasTotales = partidas.length;
  const partidasCompletas = partidas.filter((p) => Number(p.pendiente) <= 0).length;
  const hayPendiente = partidas.some((p) => Number(p.pendiente) > 0);

  return {
    cotizacion,
    entregas,
    reconciliacion: { partidas, partidasTotales, partidasCompletas, hayPendiente },
    sinEntregas,
  };
}
