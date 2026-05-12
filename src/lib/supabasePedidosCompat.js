/**
 * Consultas a pedidos_materiales + pedidos_materiales_items con fallback
 * si la BD aún no tiene columnas opcionales (evita 400 de PostgREST).
 * Categorías: embed tipo LEFT JOIN vía FK categoria_id + lookup para COALESCE / filas sin categoría.
 */

const PEDIDO_ROOT = `
  *,
  proyecto:proyecto_id(folio, descripcion, cotizacion_folio),
  solicitante:solicitante_id(nombre_completo)
`;

/** Relación opcional categorías (equivalente a LEFT JOIN; no filtra por categoria_id). */
const ITEM_CATEG_EMBED = `
    categoria:categoria_id(id, nombre)`;

/** unidad_id + catálogo (LEFT JOIN vía FK). */
const ITEM_UNIDAD_COLS = `
    unidad_id,
    catalogo_unidades(id, nombre)`;

/** Incluye columnas de líneas tipo activo + OC + categoría del ítem. */
export const PEDIDOS_ITEMS_SELECT_FULL = `
  pedidos_materiales_items(
    id,
    cantidad,
    descripcion,
    observaciones,
    material_id,
    categoria_id,${ITEM_CATEG_EMBED},${ITEM_UNIDAD_COLS},
    marca,
    modelo,
    requiere_mantenimiento,
    requiere_responsiva,
    orden_compra_id,
    precio_unitario,
    materiales(descripcion, unidad_compra),
    ordenes_compra(folio_oc, estatus)
  )
`;

/** Sin columnas opcionales de activo en ítem + categoría. */
export const PEDIDOS_ITEMS_SELECT_LEGACY_ACTIVO = `
  pedidos_materiales_items(
    id,
    cantidad,
    descripcion,
    observaciones,
    material_id,
    categoria_id,${ITEM_CATEG_EMBED},${ITEM_UNIDAD_COLS},
    orden_compra_id,
    precio_unitario,
    materiales(descripcion, unidad_compra),
    ordenes_compra(folio_oc, estatus)
  )
`;

/** Mínimo + categoria_id + categoría embebida (sin marca/modelo/requiere_*). */
export const PEDIDOS_ITEMS_SELECT_LEGACY_MIN = `
  pedidos_materiales_items(
    id,
    cantidad,
    descripcion,
    observaciones,
    material_id,
    categoria_id,${ITEM_CATEG_EMBED},${ITEM_UNIDAD_COLS},
    orden_compra_id,
    precio_unitario,
    materiales(descripcion, unidad_compra),
    ordenes_compra(folio_oc, estatus)
  )
`;

/** Sin embed de categoría (si el embed falla por cache/FK). */
export const PEDIDOS_ITEMS_SELECT_NO_CATEG_EMBED = `
  pedidos_materiales_items(
    id,
    cantidad,
    descripcion,
    observaciones,
    material_id,
    categoria_id,${ITEM_UNIDAD_COLS},
    marca,
    modelo,
    requiere_mantenimiento,
    requiere_responsiva,
    orden_compra_id,
    precio_unitario,
    materiales(descripcion, unidad_compra),
    ordenes_compra(folio_oc, estatus)
  )
`;

export const PEDIDOS_ITEMS_SELECT_NO_CATEG_LEGACY = `
  pedidos_materiales_items(
    id,
    cantidad,
    descripcion,
    observaciones,
    material_id,
    categoria_id,${ITEM_UNIDAD_COLS},
    orden_compra_id,
    precio_unitario,
    materiales(descripcion, unidad_compra),
    ordenes_compra(folio_oc, estatus)
  )
`;

export const PEDIDOS_ITEMS_SELECT_NO_CATEG_MIN = `
  pedidos_materiales_items(
    id,
    cantidad,
    descripcion,
    observaciones,
    material_id,
    categoria_id,${ITEM_UNIDAD_COLS},
    orden_compra_id,
    precio_unitario,
    materiales(descripcion, unidad_compra),
    ordenes_compra(folio_oc, estatus)
  )
`;

function buildSelect(itemsFragment) {
  return `${PEDIDO_ROOT.trim()},
${itemsFragment.trim()}`;
}

/**
 * Lookup batch a categorias_activos + COALESCE nombre en cada ítem (categoria_id NULL → "Sin categoría").
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {unknown[]|null|undefined} pedidos
 */
export async function enrichPedidosMaterialesItemsCategoria(supabase, pedidos) {
  if (!Array.isArray(pedidos) || pedidos.length === 0) return pedidos ?? [];

  const ids = new Set();
  for (const p of pedidos) {
    for (const it of p?.pedidos_materiales_items ?? []) {
      const cid = it?.categoria_id;
      if (cid != null && cid !== '') ids.add(cid);
    }
  }
  const idArr = [...ids];
  let map = {};
  if (idArr.length > 0) {
    const { data, error } = await supabase.from('categorias_activos').select('id, nombre').in('id', idArr);
    if (error) {
      console.error('[pedidos] categorias_activos lookup (items):', error.message, error);
    } else if (Array.isArray(data)) {
      for (const c of data) {
        map[String(c.id)] = c;
        map[Number(c.id)] = c;
      }
    }
  }

  const mapItem = (it) => {
    const cid = it?.categoria_id;
    const fromEmbed = it?.categoria?.nombre ?? it?.categorias_activos?.nombre;
    const row = cid != null && cid !== '' ? map[String(cid)] ?? map[Number(cid)] : null;
    const fromMap = row?.nombre;
    const nombre = fromEmbed ?? fromMap ?? 'Sin categoría';
    return {
      ...it,
      categoria: { id: cid ?? null, nombre },
    };
  };

  return pedidos.map((p) => ({
    ...p,
    pedidos_materiales_items: (p.pedidos_materiales_items ?? []).map(mapItem),
  }));
}

/**
 * Normaliza `unidad` (texto) desde embed catalogo_unidades o lookup por unidad_id; compat con materiales.unidad_compra.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {unknown[]|null|undefined} pedidos
 */
export async function enrichPedidosMaterialesItemsUnidad(supabase, pedidos) {
  if (!Array.isArray(pedidos) || pedidos.length === 0) return pedidos ?? [];

  const ids = new Set();
  for (const p of pedidos) {
    for (const it of p?.pedidos_materiales_items ?? []) {
      const uid = it?.unidad_id;
      if (uid != null && uid !== '') ids.add(uid);
    }
  }
  const idArr = [...ids];
  let map = {};
  if (idArr.length > 0) {
    const { data, error } = await supabase.from('catalogo_unidades').select('id, nombre').in('id', idArr);
    if (error) {
      console.error('[pedidos] catalogo_unidades lookup (items):', error.message, error);
    } else if (Array.isArray(data)) {
      for (const u of data) {
        map[String(u.id)] = u;
        map[Number(u.id)] = u;
      }
    }
  }

  const mapItem = (it) => {
    const embedName = it?.catalogo_unidades?.nombre;
    const uid = it?.unidad_id;
    const row = uid != null && uid !== '' ? map[String(uid)] ?? map[Number(uid)] : null;
    const fromMap = row?.nombre;
    const mat = it?.materiales?.unidad_compra;
    const raw = (embedName ?? fromMap ?? (it?.unidad ?? mat ?? '')).toString().trim();
    return {
      ...it,
      unidad: raw,
    };
  };

  return pedidos.map((p) => ({
    ...p,
    pedidos_materiales_items: (p.pedidos_materiales_items ?? []).map(mapItem),
  }));
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ order?: { column: string, ascending?: boolean }, eq?: { column: string, value: unknown } }} [opts]
 */
export async function fetchPedidosMaterialesListCompat(supabase, opts = {}) {
  const order = opts.order ?? { column: 'id', ascending: false };
  const eq = opts.eq;

  const run = async (itemsSel, label) => {
    let q = supabase.from('pedidos_materiales').select(buildSelect(itemsSel));
    if (eq) q = q.eq(eq.column, eq.value);
    q = q.order(order.column, { ascending: order.ascending !== false });
    const res = await q;
    console.log('[DEBUG pedidos_materiales]', label, {
      ok: !res.error,
      count: Array.isArray(res.data) ? res.data.length : null,
      error: res.error?.message,
      code: res.error?.code,
    });
    return res;
  };

  const tryChain = async (selectors) => {
    let last = { data: null, error: new Error('no selectors') };
    for (const { sel, label } of selectors) {
      last = await run(sel, label);
      if (!last.error) return last;
      console.warn(`[pedidos_materiales] fallback ${label}:`, last.error?.message);
    }
    return last;
  };

  let { data, error } = await tryChain([
    { sel: PEDIDOS_ITEMS_SELECT_FULL, label: 'full' },
    { sel: PEDIDOS_ITEMS_SELECT_LEGACY_ACTIVO, label: 'legacy_activo' },
    { sel: PEDIDOS_ITEMS_SELECT_LEGACY_MIN, label: 'legacy_min' },
    { sel: PEDIDOS_ITEMS_SELECT_NO_CATEG_EMBED, label: 'no_categ_embed_full' },
    { sel: PEDIDOS_ITEMS_SELECT_NO_CATEG_LEGACY, label: 'no_categ_embed_legacy' },
    { sel: PEDIDOS_ITEMS_SELECT_NO_CATEG_MIN, label: 'no_categ_embed_min' },
  ]);

  if (error) {
    console.error('[pedidos_materiales] todas las variantes de select fallaron:', error?.message, error);
    return { data: [], error, mode: 'failed' };
  }

  let enriched = await enrichPedidosMaterialesItemsCategoria(supabase, data ?? []);
  enriched = await enrichPedidosMaterialesItemsUnidad(supabase, enriched);
  console.log('pedidos:', enriched);
  return { data: enriched, error: null, mode: 'ok' };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number|string} id
 */
export async function fetchPedidoMaterialesByIdCompat(supabase, id) {
  const run = async (itemsSel, label) => {
    const res = await supabase
      .from('pedidos_materiales')
      .select(buildSelect(itemsSel))
      .eq('id', id)
      .single();
    console.log('[DEBUG pedidos_materiales by id]', label, {
      id,
      ok: !res.error,
      error: res.error?.message,
      code: res.error?.code,
    });
    return res;
  };

  const tryChain = async (selectors) => {
    let last = { data: null, error: new Error('no selectors') };
    for (const { sel, label } of selectors) {
      last = await run(sel, label);
      if (!last.error) return last;
      console.warn(`[pedidos_materiales by id] fallback ${label}:`, last.error?.message);
    }
    return last;
  };

  let { data, error } = await tryChain([
    { sel: PEDIDOS_ITEMS_SELECT_FULL, label: 'full' },
    { sel: PEDIDOS_ITEMS_SELECT_LEGACY_ACTIVO, label: 'legacy_activo' },
    { sel: PEDIDOS_ITEMS_SELECT_LEGACY_MIN, label: 'legacy_min' },
    { sel: PEDIDOS_ITEMS_SELECT_NO_CATEG_EMBED, label: 'no_categ_embed_full' },
    { sel: PEDIDOS_ITEMS_SELECT_NO_CATEG_LEGACY, label: 'no_categ_embed_legacy' },
    { sel: PEDIDOS_ITEMS_SELECT_NO_CATEG_MIN, label: 'no_categ_embed_min' },
  ]);

  if (error) {
    console.error('[pedidos_materiales by id] todas las variantes fallaron:', error?.message, error);
    return { data: null, error, mode: 'failed' };
  }

  let arr = await enrichPedidosMaterialesItemsCategoria(supabase, data ? [data] : []);
  arr = await enrichPedidosMaterialesItemsUnidad(supabase, arr);
  const one = arr[0] ?? null;
  console.log('pedidos:', one ? [one] : []);
  return { data: one, error: null, mode: 'ok' };
}
