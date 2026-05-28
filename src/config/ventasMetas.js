// src/config/ventasMetas.js

/** Punto de equilibrio mensual (PE) en MXN */
export const PE_MENSUAL = 250_000;

/** Meta anual 2026 (Ene–Dic) */
export const META_ANUAL_2026 = 2_300_000;

/** Meta anual 2027 (12 meses) */
export const META_ANUAL_2027 = 5_100_000;

/**
 * Metas mensuales 2026 y 2027.
 * tipo: 'real' = datos históricos reales, 'proyectado' = plan agresivo
 * meta_ingresos: objetivo de ingresos (MXN)
 * vs_pe: % sobre el punto de equilibrio
 */
export const METAS_VENTAS = [
  // ── 2026 · Datos Reales ──────────────────────────────────
  { mes: 1,  anio: 2026, label: 'Ene 26', meta_ingresos: 23_558,  vs_pe:   9, tipo: 'real' },
  { mes: 2,  anio: 2026, label: 'Feb 26', meta_ingresos: 87_348,  vs_pe:  35, tipo: 'real' },
  { mes: 3,  anio: 2026, label: 'Mar 26', meta_ingresos: 143_682, vs_pe:  57, tipo: 'real' },
  { mes: 4,  anio: 2026, label: 'Abr 26', meta_ingresos: 32_145,  vs_pe:  13, tipo: 'real' },
  { mes: 5,  anio: 2026, label: 'May 26', meta_ingresos: 120_480, vs_pe:  48, tipo: 'real' },
  // ── 2026 · Plan Agresivo ─────────────────────────────────
  { mes: 6,  anio: 2026, label: 'Jun 26', meta_ingresos: 160_000, vs_pe:  64, tipo: 'proyectado' },
  { mes: 7,  anio: 2026, label: 'Jul 26', meta_ingresos: 200_000, vs_pe:  80, tipo: 'proyectado' },
  { mes: 8,  anio: 2026, label: 'Ago 26', meta_ingresos: 230_000, vs_pe:  92, tipo: 'proyectado' },
  { mes: 9,  anio: 2026, label: 'Sep 26', meta_ingresos: 265_000, vs_pe: 106, tipo: 'proyectado' },
  { mes: 10, anio: 2026, label: 'Oct 26', meta_ingresos: 300_000, vs_pe: 120, tipo: 'proyectado' },
  { mes: 11, anio: 2026, label: 'Nov 26', meta_ingresos: 335_000, vs_pe: 134, tipo: 'proyectado' },
  { mes: 12, anio: 2026, label: 'Dic 26', meta_ingresos: 403_000, vs_pe: 161, tipo: 'proyectado' },
  // ── 2027 · Proyección Motor en Marcha ─────────────────────
  { mes: 1,  anio: 2027, label: 'Ene 27', meta_ingresos: 390_000, vs_pe: 156, tipo: 'proyectado' },
  { mes: 2,  anio: 2027, label: 'Feb 27', meta_ingresos: 420_000, vs_pe: 168, tipo: 'proyectado' },
  { mes: 3,  anio: 2027, label: 'Mar 27', meta_ingresos: 460_000, vs_pe: 184, tipo: 'proyectado' },
  { mes: 4,  anio: 2027, label: 'Abr 27', meta_ingresos: 500_000, vs_pe: 200, tipo: 'proyectado' },
  { mes: 5,  anio: 2027, label: 'May 27', meta_ingresos: 540_000, vs_pe: 216, tipo: 'proyectado' },
];

/** Devuelve la entrada de meta para el mes/año indicado, o null. */
export function getMetaMes(mes, anio) {
  return METAS_VENTAS.find((m) => m.mes === mes && m.anio === anio) ?? null;
}

/** Formatea MXN de forma compacta: $23.6K, $160K, $1.2M */
export function fmtMXN(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);
}

/** Formatea MXN completo para displays grandes */
export function fmtMXNFull(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
}
