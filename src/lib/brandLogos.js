/**
 * Logos servidos desde /public (Vite los expone en la raíz del sitio).
 * Rutas efectivas: /brand-*.png|svg (no usar /assets/ salvo que exista public/assets).
 */
export const BRAND_CONFIG = {
  TESEY: {
    logo: '/brand-tesey-logo.png',
    alt: 'TESEY',
  },
  IIHEMSA: {
    logo: '/brand-iihemsa-logo.svg',
    alt: 'IIHEMSA',
  },
  IIHEMSA_PENINSULAR: {
    logo: '/brand-iihemsa-peninsular-logo.svg',
    alt: 'IIHEMSA Peninsular',
  },
};

/** Valores del selector y slugs históricos → clave canónica (orden: igualdad exacta, sin includes). */
const SLUG_TO_CANONICAL = {
  tesey: 'TESEY',
  iihemsa: 'IIHEMSA',
  iihemsa_peninsular: 'IIHEMSA_PENINSULAR',
};

/**
 * @param {string|undefined|null} marca
 * @returns {'TESEY'|'IIHEMSA'|'IIHEMSA_PENINSULAR'}
 */
export function resolveBrandKey(marca) {
  if (marca === undefined || marca === null) return 'IIHEMSA';
  const raw = String(marca).trim();
  if (!raw) return 'IIHEMSA';

  const slug = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (SLUG_TO_CANONICAL[slug]) return SLUG_TO_CANONICAL[slug];

  const normalized = raw.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (BRAND_CONFIG[normalized]) return normalized;

  console.warn('Marca no encontrada:', marca);
  return 'TESEY';
}

/**
 * @param {string|undefined|null} marca
 * @returns {{ key: 'TESEY'|'IIHEMSA'|'IIHEMSA_PENINSULAR', logoSrc: string, logoAlt: string }}
 */
export function getBrandVisuals(marca) {
  const key = resolveBrandKey(marca);
  const cfg = BRAND_CONFIG[key];
  return { key, logoSrc: cfg.logo, logoAlt: cfg.alt };
}

/**
 * @param {string|undefined|null} marca
 * @returns {string}
 */
export function getLogoByMarca(marca) {
  return getBrandVisuals(marca).logoSrc;
}
