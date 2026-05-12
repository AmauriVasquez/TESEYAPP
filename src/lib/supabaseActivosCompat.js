/**
 * Lectura de activos sin perder filas por embed de categoría.
 * Esquema simplificado: solo columnas que existen en `activos` + relación opcional a categorias_activos.
 */

export const ACTIVOS_LIST_SELECT_WITH_CATEGORIA = `
  id,
  nombre,
  categoria_id,
  estado,
  fecha_adquisicion,
  costo_compra,
  eliminado,
  categoria:categoria_id(id, nombre)
`;

export const ACTIVOS_LIST_SELECT_NO_EMBED = `
  id,
  nombre,
  categoria_id,
  estado,
  fecha_adquisicion,
  costo_compra,
  eliminado
`;

/** Detalle: columnas usadas por la pantalla de detalle (sin * para evitar 400 por columnas eliminadas). */
export const ACTIVO_DETALLE_SELECT_WITH_CATEGORIA = `
  id,
  nombre,
  descripcion,
  categoria_id,
  estado,
  fecha_adquisicion,
  costo_compra,
  marca,
  modelo,
  numero_serie,
  ubicacion_id,
  requiere_mantenimiento,
  requiere_responsiva,
  estado_configuracion,
  eliminado,
  categoria:categoria_id(id, nombre),
  ubicacion:ubicacion_id(id, nombre)
`;

export const ACTIVO_DETALLE_SELECT_NO_CATEG_EMBED = `
  id,
  nombre,
  descripcion,
  categoria_id,
  estado,
  fecha_adquisicion,
  costo_compra,
  marca,
  modelo,
  numero_serie,
  ubicacion_id,
  requiere_mantenimiento,
  requiere_responsiva,
  estado_configuracion,
  eliminado,
  ubicacion:ubicacion_id(id, nombre)
`;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ onlyVisible?: boolean }} [opts]
 */
export async function fetchActivosListCompat(supabase, opts = {}) {
  const onlyVisible = opts.onlyVisible !== false;
  const run = async (sel, label) => {
    let q = supabase.from('activos').select(sel.trim()).order('id', { ascending: false });
    if (onlyVisible) q = q.eq('eliminado', false);
    const res = await q;
    console.log('[DEBUG activos]', label, {
      ok: !res.error,
      count: Array.isArray(res.data) ? res.data.length : null,
      error: res.error?.message,
      code: res.error?.code,
    });
    return res;
  };

  let { data, error } = await run(ACTIVOS_LIST_SELECT_WITH_CATEGORIA, 'with_categoria_embed');
  if (!error) {
    return { data: data ?? [], error: null, mode: 'embed' };
  }

  console.warn('[DEBUG activos] fallback sin embed categoría:', error?.message);
  ({ data, error } = await run(ACTIVOS_LIST_SELECT_NO_EMBED, 'no_categoria_embed'));
  if (!error) {
    const raw = data ?? [];
    const catIds = [...new Set(raw.map((a) => a.categoria_id).filter(Boolean))];
    let catMap = {};
    if (catIds.length > 0) {
      const { data: cats, error: catErr } = await supabase
        .from('categorias_activos')
        .select('id, nombre')
        .in('id', catIds);
      console.log('[DEBUG activos] categorias_activos lookup', {
        ok: !catErr,
        requested: catIds.length,
        returned: Array.isArray(cats) ? cats.length : 0,
        error: catErr?.message,
      });
      if (!catErr && Array.isArray(cats)) {
        catMap = Object.fromEntries(cats.map((c) => [c.id, c]));
      }
    }
    const rows = raw.map((a) => ({
      ...a,
      categoria: a.categoria_id
        ? catMap[a.categoria_id] ?? { id: a.categoria_id, nombre: 'Sin categoría' }
        : null,
    }));
    return { data: rows, error: null, mode: 'no_embed_lookup' };
  }

  return { data: [], error, mode: 'failed' };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function fetchActivoByIdCompat(supabase, id) {
  const run = async (sel, label) => {
    const res = await supabase.from('activos').select(sel.trim()).eq('id', id).maybeSingle();
    console.log('[DEBUG activos by id]', label, {
      id,
      ok: !res.error,
      error: res.error?.message,
      code: res.error?.code,
    });
    return res;
  };

  let { data, error } = await run(ACTIVO_DETALLE_SELECT_WITH_CATEGORIA, 'with_categoria');
  if (!error) return { data, error: null, mode: 'embed' };

  console.warn('[DEBUG activos by id] fallback sin embed categoría:', error?.message);
  ({ data, error } = await run(ACTIVO_DETALLE_SELECT_NO_CATEG_EMBED, 'no_categoria_embed'));
  if (!error && data) {
    let categoria = null;
    if (data.categoria_id) {
      const { data: cat, error: catErr } = await supabase
        .from('categorias_activos')
        .select('id, nombre')
        .eq('id', data.categoria_id)
        .maybeSingle();
      console.log('[DEBUG activos by id] categorias_activos lookup', {
        ok: !catErr,
        error: catErr?.message,
      });
      categoria = catErr ? { id: data.categoria_id, nombre: 'Sin categoría' } : cat ?? { id: data.categoria_id, nombre: 'Sin categoría' };
    }
    return {
      data: { ...data, categoria },
      error: null,
      mode: 'no_embed_lookup',
    };
  }

  return { data: null, error, mode: 'failed' };
}
