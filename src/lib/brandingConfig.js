export const BRANDINGS = [
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
      rfc: 'TSY221213TIA',
      regimenFiscal: '626 Régimen Simplificado de Confianza',
      direccion: 'CALLE 24 # 73-4 , RESIDENCIAL XCANATUN, MERIDA,',
      direccion2: 'YUCATAN, MEXICO, C.P. 97302',
    },
  },
  {
    id: 'iihemsa_peninsular',
    nombre: 'IIHEMSA Peninsular',
    logo: '/brand-iihemsa-peninsular-logo.svg',
    colores: {
      primario: '#1E3A8A',
      secundario: '#0F172A',
      acento: '#3B82F6',
    },
    datos: {
      razonSocial: 'IIHEMSA Peninsular',
      rfc: 'IPE1003058K9',
      regimenFiscal: 'Régimen General de Ley Personas Morales',
      direccion: 'CALLE 24 SIN NUMERO, TEMOZON NORTE,',
      direccion2: 'MÉRIDA, YUCATÁN, MÉXICO, C.P. 97302',
    },
  },
];

export const DEFAULT_BRANDING_ID = 'tesey';

export const MARCAS_COMERCIALES = [
  { id: 'tesey', nombre: 'TESEY' },
  { id: 'kutra', nombre: 'KUTRA' },
  { id: 'arkeo', nombre: 'ARKEO' },
];

export const DEFAULT_MARCA_COMERCIAL = 'tesey';

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

export const MARCAS_COLORES = {
  tesey: {
    primario:   '#464644',
    secundario: '#df6100',
    acento:     '#ff5a06',
  },
  kutra: {
    primario:   '#7c806f',
    secundario: '#7c806f',
    acento:     '#ded7c9',
  },
  arkeo: {
    primario:   '#5a5655',
    secundario: '#b69576',
    acento:     '#b69576',
  },
};

export function getMarcaColores(marcaId) {
  return MARCAS_COLORES[marcaId] || MARCAS_COLORES.tesey;
}
