/**
 * Acceso defensivo a las tablas/funciones nuevas del módulo de Compras
 * (alias de material por proveedor, historial/versionado de OC y costos por
 * material). Si la migración aún no se aplicó, estas tablas/funciones no existen;
 * las funciones aquí degradan de forma silenciosa (devuelven vacío / no-op) sin
 * romper el build ni el runtime básico.
 */

import { supabase } from '@/lib/customSupabaseClient';

/** PostgREST: tabla/función/columna inexistente o no en el schema cache. */
function isMissingObjectError(error) {
  if (!error) return false;
  const code = String(error.code ?? '');
  // 42P01 undefined_table, 42883 undefined_function, PGRST205 tabla no en cache,
  // PGRST202 función no en cache, 42703 undefined_column.
  if (['42P01', '42883', '42703', 'PGRST205', 'PGRST202', 'PGRST204'].includes(code)) return true;
  const msg = String(error.message ?? '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('could not find') ||
    msg.includes('schema cache') ||
    msg.includes('no existe')
  );
}

/**
 * Devuelve los alias (material+proveedor) para un proveedor dado, como
 * Map<material_id(string), {nombre_proveedor, clave_proveedor}>.
 * Si la tabla no existe aún, devuelve un Map vacío.
 */
export async function fetchAliasPorProveedor(proveedorId) {
  const empty = new Map();
  if (!proveedorId) return empty;
  try {
    const { data, error } = await supabase
      .from('material_proveedor_alias')
      .select('material_id, nombre_proveedor, clave_proveedor')
      .eq('proveedor_id', proveedorId);
    if (error) {
      if (!isMissingObjectError(error)) console.error('[comprasExtras] alias fetch:', error);
      return empty;
    }
    const map = new Map();
    for (const row of data ?? []) {
      map.set(String(row.material_id), {
        nombre_proveedor: row.nombre_proveedor ?? '',
        clave_proveedor: row.clave_proveedor ?? '',
      });
    }
    return map;
  } catch (err) {
    console.error('[comprasExtras] alias fetch (catch):', err);
    return empty;
  }
}

/**
 * Inserta/actualiza el alias de un material para un proveedor.
 * No-op silencioso si falta la tabla. Devuelve { ok }.
 */
export async function upsertAlias({ materialId, proveedorId, nombreProveedor, claveProveedor }) {
  if (!materialId || !proveedorId) return { ok: false };
  const nombre = (nombreProveedor ?? '').toString().trim();
  const clave = (claveProveedor ?? '').toString().trim();
  if (!nombre && !clave) return { ok: false };
  try {
    const { error } = await supabase
      .from('material_proveedor_alias')
      .upsert(
        {
          material_id: materialId,
          proveedor_id: proveedorId,
          nombre_proveedor: nombre || null,
          clave_proveedor: clave || null,
        },
        { onConflict: 'material_id,proveedor_id' }
      );
    if (error) {
      if (!isMissingObjectError(error)) console.error('[comprasExtras] alias upsert:', error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[comprasExtras] alias upsert (catch):', err);
    return { ok: false };
  }
}

/**
 * Registra una entrada de historial al editar una OC. No-op silencioso si falta
 * la tabla. Devuelve { ok }.
 */
export async function registrarHistorialOC({ ocId, version, razon, cambios, snapshot, usuarioId, usuarioNombre }) {
  if (!ocId || !razon) return { ok: false };
  try {
    const { error } = await supabase.from('ordenes_compra_historial').insert({
      oc_id: ocId,
      version: version ?? 1,
      razon: String(razon).trim(),
      cambios: cambios ?? null,
      snapshot: snapshot ?? null,
      usuario_id: usuarioId ?? null,
      usuario_nombre: usuarioNombre ?? null,
    });
    if (error) {
      if (!isMissingObjectError(error)) console.error('[comprasExtras] historial insert:', error);
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    console.error('[comprasExtras] historial insert (catch):', err);
    return { ok: false };
  }
}

/** Lista el historial de una OC (más reciente primero). Vacío si falta la tabla. */
export async function fetchHistorialOC(ocId) {
  if (!ocId) return [];
  try {
    const { data, error } = await supabase
      .from('ordenes_compra_historial')
      .select('id, version, razon, cambios, usuario_nombre, created_at')
      .eq('oc_id', ocId)
      .order('version', { ascending: false });
    if (error) {
      if (!isMissingObjectError(error)) console.error('[comprasExtras] historial fetch:', error);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('[comprasExtras] historial fetch (catch):', err);
    return [];
  }
}

export { isMissingObjectError };
