import { supabase } from '@/lib/customSupabaseClient';

// Columnas de materiales relevantes para el control de existencias.
const INVENTARIO_COLS = `
  id, clave, descripcion, categoria, familia,
  unidad_compra, unidad_uso, factor_conversion,
  costo_compra, costo_unitario,
  existencias, stock_min, stock_max
`;

/** Trae el catálogo con existencias para la vista de inventario. */
export async function fetchInventario() {
  const { data, error } = await supabase
    .from('materiales')
    .select(INVENTARIO_COLS)
    .order('descripcion', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Historial (kardex) de un material, más reciente primero. */
export async function fetchKardex(materialId) {
  const { data, error } = await supabase
    .from('inventario_movimientos')
    .select('id, tipo, cantidad, existencia_antes, existencia_despues, motivo, referencia, observaciones, created_at')
    .eq('material_id', materialId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

/**
 * Registra un movimiento. Para 'entrada'/'salida' `cantidad` es la magnitud (>0);
 * para 'ajuste' `cantidad` es el conteo físico (la existencia real). El servidor
 * recalcula el delta y aplica el cambio a existencias de forma atómica.
 */
export async function registrarMovimiento({
  material_id,
  tipo,
  cantidad,
  motivo = null,
  referencia = null,
  proyecto_id = null,
  observaciones = null,
  permitir_negativo = false,
}) {
  const { data, error } = await supabase.rpc('registrar_movimiento_inventario', {
    p_material_id: material_id,
    p_tipo: tipo,
    p_cantidad: cantidad,
    p_motivo: motivo,
    p_referencia: referencia,
    p_proyecto_id: proyecto_id,
    p_observaciones: observaciones,
    p_permitir_negativo: permitir_negativo,
  });
  if (error) throw error;
  return data;
}

/**
 * Cantidad sugerida de compra para reponer hasta el máximo, convertida de
 * unidad_uso a unidad_compra y redondeada hacia arriba. factor<=0/NULL ⇒ 1.
 */
export function cantidadRestockSugerida(material) {
  const max = Number(material.stock_max) || 0;
  const ex = Number(material.existencias) || 0;
  const faltanUso = Math.max(max - ex, 0);
  const factor = Number(material.factor_conversion) > 0 ? Number(material.factor_conversion) : 1;
  return Math.ceil(faltanUso / factor);
}

/** ¿El material está en mínimos? (existencias <= stock_min, con mínimo definido). */
export function estaEnMinimos(material) {
  const min = Number(material.stock_min) || 0;
  if (min <= 0) return false;
  return (Number(material.existencias) || 0) <= min;
}

/**
 * Crea un pedido de re-stock con las partidas seleccionadas.
 * items: [{ material_id, cantidad (en unidad_compra), observaciones? }]
 */
export async function crearPedidoRestock(items, observaciones = null) {
  const { data, error } = await supabase.rpc('crear_pedido_restock', {
    p_items: items,
    p_observaciones: observaciones,
  });
  if (error) throw error;
  return data;
}
