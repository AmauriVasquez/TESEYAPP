import { getDefaultClassNames } from 'react-day-picker';
import { cn } from '@/lib/utils';

/**
 * Parte de los classNames por defecto de react-day-picker (rdp-*) y añade overrides.
 * No forzar layout (flex en filas, w-full en celdas): eso rompe la tabla del grid.
 */
export function mergeDayPickerClassNames(overrides = {}) {
  const base = getDefaultClassNames();
  const out = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    const b = base[key];
    out[key] = b ? cn(b, value) : value;
  }
  return out;
}
