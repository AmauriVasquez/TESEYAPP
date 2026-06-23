// src/config/cuentasPago.js
// Cuentas de pago reales del negocio (provistas por el usuario, 2026-06-23).
// La facturabilidad y la entidad viven SOLO aquí; nunca se guardan como etiqueta
// en la base de datos (decisión de diseño: no crear evidencia de "no fiscal").
// entidad: 'tesey' | 'ipe' | 'ambas' | null  ('ambas' = sirve a cualquier entidad).
export const CUENTAS_PAGO = [
  { value: 'bbva_7340',      label: 'BBVA ··7340',      entidad: 'ipe',   facturable: true  },
  { value: 'santander_1971', label: 'SANTANDER ··1971', entidad: 'tesey', facturable: true  },
  { value: 'banregio_0017',  label: 'BANREGIO ··0017',  entidad: 'ambas', facturable: false },
  { value: 'efectivo',       label: 'Efectivo',         entidad: 'ambas', facturable: true  },
];

// Valores históricos en texto libre (solo para mostrar/migrar; facturable: null = desconocido).
export const CUENTAS_HISTORICAS = [
  { value: 'Transferencia',             label: 'Transferencia (histórica)', entidad: null, facturable: null },
  { value: 'Efectivo',                  label: 'Efectivo (histórico)',      entidad: null, facturable: true },
  { value: 'Tarjeta de Crédito/Débito', label: 'Tarjeta (histórica)',       entidad: null, facturable: null },
];

export function getCuenta(value) {
  return (
    CUENTAS_PAGO.find((c) => c.value === value) ||
    CUENTAS_HISTORICAS.find((c) => c.value === value) ||
    null
  );
}

export function getCuentaLabel(value) {
  return getCuenta(value)?.label ?? (value || '—');
}

// Mapea el branding de la cotización a la entidad fiscal de las cuentas.
export function brandingToEntidad(branding) {
  if (branding === 'tesey') return 'tesey';
  if (branding === 'iihemsa_peninsular' || branding === 'iihemsa') return 'ipe';
  return null;
}

/**
 * Reglas como AVISOS (nunca bloquean). Devuelve { nivel, mensaje }.
 * nivel: 'ok' | 'aviso'. mensaje: string | null.
 * Una cuenta con entidad 'ambas' sirve a cualquier branding (no dispara aviso de entidad).
 */
export function validarCobro({ requiereCfdi, cuentaValue, branding }) {
  const cuenta = getCuenta(cuentaValue);
  if (!cuenta) return { nivel: 'ok', mensaje: null };
  const entidadEsperada = brandingToEntidad(branding);
  const entidadEspecifica = cuenta.entidad && cuenta.entidad !== 'ambas';

  if (requiereCfdi && cuenta.facturable === false) {
    return { nivel: 'aviso', mensaje: 'Este cobro entró a una cuenta que no factura; no podrás emitir CFDI desde aquí.' };
  }
  if (requiereCfdi && entidadEspecifica && entidadEsperada && cuenta.entidad !== entidadEsperada) {
    return { nivel: 'aviso', mensaje: 'La cuenta es de otra entidad que la empresa emisora.' };
  }
  if (!requiereCfdi && cuenta.facturable === true && entidadEspecifica) {
    return { nivel: 'aviso', mensaje: 'Depósito en cuenta facturable de un trabajo marcado sin factura.' };
  }
  return { nivel: 'ok', mensaje: null };
}
