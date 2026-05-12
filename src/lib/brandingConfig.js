export const BRANDINGS = [
  {
    id: 'iihemsa',
    nombre: 'IIHEMSA',
    logo: '/brand-iihemsa-logo.svg',
    colores: {
      primario: '#1E3A8A',
      secundario: '#0F172A',
      acento: '#3B82F6',
    },
    datos: {
      razonSocial: 'Ingeniería e Instalaciones Hidroneumáticas Eléctricas y Montajes SA de CV',
    },
  },
  {
    id: 'tesey',
    nombre: 'TESEY',
    logo: '/brand-tesey-logo.png',
    colores: {
      primario: '#065F46',
      secundario: '#064E3B',
      acento: '#10B981',
    },
    datos: {
      razonSocial: 'Tecnomaquila y Servicios de Yucatán',
    },
  },
];

export const DEFAULT_BRANDING_ID = BRANDINGS[0].id;

export function getBrandingConfig(id) {
  return BRANDINGS.find((b) => b.id === id) || BRANDINGS[0];
}

export function getTextColor(bgColor) {
  const hex = String(bgColor || '').replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return '#FFFFFF';
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#111111' : '#FFFFFF';
}
