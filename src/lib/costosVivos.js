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

const CONFIG_DEFAULTS = {
  regla_costo: 'ultimo',
  regla_costo_n: 3,
  indirectos_pct: 20,
  utilidad_pct: 30,
  iva_pct: 16,
  margen_objetivo_pct: 30,
  margen_minimo_pct: 15,
};
const REGLAS_COSTO_VALIDAS = ['ultimo', 'promedio', 'promedio_ponderado_n', 'mas_alto'];

/**
 * Construye el payload de configuración usando SOLO los campos de negocio
 * (whitelist), coercionando numéricos y descartando vacíos/inválidos. Así nunca
 * llegan al INSERT columnas de metadatos (id, created_at, vigencia) ni cadenas
 * vacías en columnas numéricas. El orden de prioridad por campo es:
 * nuevaConfig → previa → default.
 */
function construirConfigPayload(nuevaConfig, previa) {
  const fuente = { ...(previa ?? {}), ...(nuevaConfig ?? {}) };
  const numero = (valor, fallback) => {
    const n = Number(valor);
    return valor === '' || valor == null || Number.isNaN(n) ? fallback : n;
  };
  const reglaRaw = fuente.regla_costo;
  const regla_costo = REGLAS_COSTO_VALIDAS.includes(reglaRaw) ? reglaRaw : CONFIG_DEFAULTS.regla_costo;
  const reglaN = Math.trunc(numero(fuente.regla_costo_n, CONFIG_DEFAULTS.regla_costo_n));
  return {
    regla_costo,
    regla_costo_n: reglaN >= 1 ? reglaN : 1,
    indirectos_pct: numero(fuente.indirectos_pct, CONFIG_DEFAULTS.indirectos_pct),
    utilidad_pct: numero(fuente.utilidad_pct, CONFIG_DEFAULTS.utilidad_pct),
    iva_pct: numero(fuente.iva_pct, CONFIG_DEFAULTS.iva_pct),
    margen_objetivo_pct: numero(fuente.margen_objetivo_pct, CONFIG_DEFAULTS.margen_objetivo_pct),
    margen_minimo_pct: numero(fuente.margen_minimo_pct, CONFIG_DEFAULTS.margen_minimo_pct),
  };
}

/**
 * Guarda una nueva versión de la configuración de precios: cierra la fila
 * activa actual (vigente_hasta = ahora) e inserta una nueva fila activa,
 * heredando los valores previos no especificados en `nuevaConfig`. Solo se
 * insertan campos de negocio (nunca id/vigencia/created_at), por lo que el
 * estado de la página puede pasarse tal cual. Devuelve { ok }; ok=false si la
 * tabla no existe o hay error.
 */
export async function guardarConfigPrecios(nuevaConfig) {
  try {
    const previa = await fetchConfigPrecios();
    const payload = construirConfigPayload(nuevaConfig, previa);

    const { error: cerrarError } = await supabase
      .from('config_precios')
      .update({ vigente_hasta: new Date().toISOString() })
      .is('vigente_hasta', null);
    if (cerrarError) {
      if (!isMissingObjectError(cerrarError)) console.error('[costosVivos] config cerrar:', cerrarError);
      return { ok: false };
    }

    const { error: insertError } = await supabase.from('config_precios').insert(payload);
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
