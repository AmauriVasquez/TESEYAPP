export const BRAND_CONFIG = {
  TESEY: {
    logo: '/brand-tesey-logo.png',
    alt: 'TESEY',
  },
  IIHEMSA_PENINSULAR: {
    logo: '/brand-iihemsa-peninsular-logo.svg',
    alt: 'IIHEMSA Peninsular',
  },
  KUTRA: {
    logo: '/brand-kutra-logo.png',
    alt: 'KUTRA',
  },
  ARKEO: {
    logo: '/brand-arkeo-logo.png',
    alt: 'ARKEO',
  },
};

const SLUG_TO_CANONICAL = {
  tesey: 'TESEY',
  iihemsa_peninsular: 'IIHEMSA_PENINSULAR',
  iihemsa: 'IIHEMSA_PENINSULAR',
  kutra: 'KUTRA',
  arkeo: 'ARKEO',
};

export function resolveBrandKey(marca) {
  if (marca === undefined || marca === null) return 'TESEY';
  const raw = String(marca).trim();
  if (!raw) return 'TESEY';
  const slug = raw.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (SLUG_TO_CANONICAL[slug]) return SLUG_TO_CANONICAL[slug];
  const normalized = raw.toUpperCase().replace(/\s+/g, '_').replace(/-/g, '_');
  if (BRAND_CONFIG[normalized]) return normalized;
  console.warn('[brandLogos] Marca no encontrada, fallback TESEY:', marca);
  return 'TESEY';
}

export function getBrandVisuals(marca) {
  const key = resolveBrandKey(marca);
  const cfg = BRAND_CONFIG[key];
  return { key, logoSrc: cfg.logo, logoAlt: cfg.alt };
}

export function getLogoByMarca(marca) {
  return getBrandVisuals(marca).logoSrc;
}
