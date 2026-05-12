/**
 * Utilidades para líneas de pedidos_materiales_items (unidad catálogo, descripción impresión).
 */

/**
 * @param {Array<{id?: number|string, nombre?: string}>|null|undefined} catalogo
 * @param {string|null|undefined} nombreCompra
 * @returns {number|string|null}
 */
export function matchUnidadIdByNombre(catalogo, nombreCompra) {
  const n = (nombreCompra ?? '').toString().trim().toLowerCase();
  if (!n || !Array.isArray(catalogo)) return null;
  const row = catalogo.find((u) => (u.nombre ?? '').toString().trim().toLowerCase() === n);
  return row?.id != null ? row.id : null;
}

/**
 * @param {Array<{id?: number|string, nombre?: string}>|null|undefined} catalogo
 * @param {number|string|null|undefined} unidadId
 */
export function nombreUnidadPorId(catalogo, unidadId) {
  if (unidadId == null || unidadId === '' || !Array.isArray(catalogo)) return '';
  const row = catalogo.find((u) => String(u.id) === String(unidadId) || Number(u.id) === Number(unidadId));
  return (row?.nombre ?? '').toString().trim();
}

/**
 * Texto de unidad para UI / datos ya enriquecidos (sin fallback final N/A).
 */
export function displayUnidadPedidoItem(item) {
  const parts = [
    item?.catalogo_unidades?.nombre,
    item?.unidad,
    item?.materiales?.unidad_compra,
    item?.material?.unidad_compra,
  ];
  for (const x of parts) {
    const s = (x ?? '').toString().trim();
    if (s && s !== 'undefined' && s !== 'null') return s;
  }
  return '';
}

export function unidadImpresionPedidoItem(item) {
  const s = displayUnidadPedidoItem(item);
  return s || 'N/A';
}

/** descripcion + marca + modelo (activos), sin huecos. */
export function descripcionFinalActivo(item) {
  return [item?.descripcion, item?.marca, item?.modelo]
    .map((x) => (x != null ? String(x).trim() : ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * @param {object} item
 * @param {'material'|'activo'} tipoPedido
 */
export function descripcionImpresionPedidoItem(item, tipoPedido) {
  if (tipoPedido === 'activo') {
    const d = descripcionFinalActivo(item);
    return d || 'Sin descripción';
  }
  const mat = item?.materiales?.descripcion ?? item?.material?.descripcion;
  const raw = (item?.descripcion ?? mat ?? '').toString().trim();
  return raw || 'Sin descripción';
}
