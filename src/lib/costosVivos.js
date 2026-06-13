/**
 * Acceso defensivo a las funciones/tablas nuevas del módulo de Control de
 * Costos (panel de costos vivos, recálculo de costos vigentes y configuración
 * de precios). Si la migración aún no se aplicó, estas funciones/tablas no
 * existen; las funciones aquí degradan de forma silenciosa (devuelven vacío /
 * no-op) sin romper el build ni el runtime básico.
 */

import { supabase } from '@/lib/customSupabaseClient';
import { isMissingObjectError } from '@/lib/comprasExtras';

/**
 * Lista el panel de costos vivos (uno por material) con costo último,
 * promedio, más alto y vigente. Devuelve [] si la función no existe aún.
 */
export async function fetchPanelCostos() {
  try {
    const { data, error } = await supabase.rpc('get_panel_costos');
    if (error) {
      if (!isMissingObjectError(error)) console.error('[costosVivos] panel fetch:', error);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[costosVivos] panel fetch (catch):', err);
    return [];
  }
}

/**
 * Devuelve la configuración de precios activa (vigente_hasta IS NULL), o null
 * si no hay una configuración activa o si la tabla aún no existe.
 */
export async function fetchConfigPrecios() {
  try {
    const { data, error } = await supabase
      .from('config_precios')
      .select('*')
      .is('vigente_hasta', null)
      .maybeSingle();
    if (error) {
      if (!isMissingObjectError(error)) console.error('[costosVivos] config fetch:', error);
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error('[costosVivos] config fetch (catch):', err);
    return null;
  }
}

/**
 * Recalcula el costo vigente de un material. Devuelve { ok, costo }.
 * ok=false y costo=null si la función no existe o hay error.
 */
export async function recalcularCostoMaterial(materialId) {
  try {
    const { data, error } = await supabase.rpc('recalcular_costo_material', {
      p_material_id: materialId,
    });
    if (error) {
      if (!isMissingObjectError(error)) console.error('[costosVivos] recalcular material:', error);
      return { ok: false, costo: null };
    }
    return { ok: true, costo: data ?? null };
  } catch (err) {
    console.error('[costosVivos] recalcular material (catch):', err);
    return { ok: false, costo: null };
  }
}

/**
 * Recalcula los costos vigentes de todos los materiales. Devuelve
 * { ok, actualizados }. ok=false y actualizados=0 si la función no existe o
 * hay error.
 */
export async function recalcularTodosLosCostos() {
  try {
    const { data, error } = await supabase.rpc('recalcular_costos_vigentes');
    if (error) {
      if (!isMissingObjectError(error)) console.error('[costosVivos] recalcular todos:', error);
      return { ok: false, actualizados: 0 };
    }
    return { ok: true, actualizados: data ?? 0 };
  } catch (err) {
    console.error('[costosVivos] recalcular todos (catch):', err);
    return { ok: false, actualizados: 0 };
  }
}

/**
 * Guarda una nueva versión de la configuración de precios: cierra la fila
 * activa actual (vigente_hasta = ahora) e inserta una nueva fila activa,
 * heredando los valores previos no especificados en `nuevaConfig`. Devuelve
 * { ok }. ok=false si la tabla no existe o hay error.
 */
export async function guardarConfigPrecios(nuevaConfig) {
  try {
    const previa = await fetchConfigPrecios();

    const { error: cerrarError } = await supabase
      .from('config_precios')
      .update({ vigente_hasta: new Date().toISOString() })
      .is('vigente_hasta', null);
    if (cerrarError) {
      if (!isMissingObjectError(cerrarError)) console.error('[costosVivos] config cerrar:', cerrarError);
      return { ok: false };
    }

    const previaSinMeta = { ...(previa ?? {}) };
    delete previaSinMeta.id;
    delete previaSinMeta.vigente_desde;
    delete previaSinMeta.vigente_hasta;
    delete previaSinMeta.created_at;
    const merged = { ...previaSinMeta, ...nuevaConfig };

    const { error: insertError } = await supabase.from('config_precios').insert({ ...merged });
    if (insertError) {
      if (!isMissingObjectError(insertError)) console.error('[costosVivos] config insertar:', insertError);
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    console.error('[costosVivos] config guardar (catch):', err);
    return { ok: false };
  }
}
