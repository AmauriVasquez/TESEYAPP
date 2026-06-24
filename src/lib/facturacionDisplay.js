// src/lib/facturacionDisplay.js
const EMPRESA_LABEL = { tesey: 'Tesey', iihemsa_peninsular: 'IIHEMSA Peninsular', iihemsa: 'IIHEMSA Peninsular' };
const MARCA_LABEL = { tesey: 'TESEY', kutra: 'KUTRA', arkeo: 'ARKEO' };

export function empresaLabel(branding) {
  return EMPRESA_LABEL[branding] ?? (branding ? String(branding) : '—');
}
export function marcaLabel(marca) {
  return MARCA_LABEL[marca] ?? (marca ? String(marca) : '—');
}

/**
 * Estatus de facturación de un ingreso. Orden: facturado → descartado → pendiente → sin IVA.
 * ingreso: { requiere_cfdi, factura_descartada, factura_numero }
 */
export function estatusFactura(ingreso) {
  if (ingreso?.factura_numero) return { key: 'facturado', label: `Facturado · ${ingreso.factura_numero}`, tone: 'green' };
  if (ingreso?.requiere_cfdi && ingreso?.factura_descartada) return { key: 'descartado', label: 'No se facturará', tone: 'gray' };
  if (ingreso?.requiere_cfdi) return { key: 'pendiente', label: 'Facturación pendiente', tone: 'amber' };
  return { key: 'sin_iva', label: '—', tone: 'muted' };
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Desglose DERIVADO del pago (no se almacena). Total = monto; con IVA: subtotal = total/1.16. */
export function desglosePago(monto, aplicaIva) {
  const total = round2(monto || 0);
  if (!aplicaIva) return { subtotal: total, iva: 0, total };
  const subtotal = round2(total / 1.16);
  return { subtotal, iva: round2(total - subtotal), total };
}
