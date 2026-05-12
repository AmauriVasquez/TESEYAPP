/**
 * Utilidades de fecha para zona America/Mexico_City.
 * Evita el "off-by-one day" al interpretar fechas solo-date (yyyy-mm-dd) como UTC.
 * Usar parseDateOnly + format para impresión/PDF y tablas.
 */
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Parsea un string de fecha "yyyy-mm-dd" o ISO como fecha LOCAL (medianoche local),
 * sin conversión UTC que desplace el día.
 * Ej: "2026-02-16" → 16 de febrero en local, no 15.
 * @param {string|Date} dateInput - "yyyy-mm-dd" o ISO o Date
 * @returns {Date} Fecha a medianoche en hora local
 */
export function parseDateOnly(dateInput) {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    const y = dateInput.getFullYear();
    const m = dateInput.getMonth();
    const d = dateInput.getDate();
    return new Date(y, m, d);
  }
  const str = String(dateInput).trim();
  const onlyDate = str.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(onlyDate);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * Formato para PDF/impresión: "dd 'de' MMMM, yyyy" (ej: 16 de febrero, 2026).
 * Usa parseDateOnly para evitar desfase de un día.
 */
export function formatDateForPrint(dateInput) {
  const d = dateInput ? parseDateOnly(dateInput) : new Date();
  if (!d) return format(new Date(), "dd 'de' MMMM, yyyy", { locale: es });
  return format(d, "dd 'de' MMMM, yyyy", { locale: es });
}

/**
 * Formato consistente para tablas: "dd/MMM/yyyy" (ej: 16/Feb/2026).
 */
export function formatDateTable(dateInput) {
  const d = dateInput ? parseDateOnly(dateInput) : null;
  if (!d) return '—';
  return format(d, 'dd/MMM/yyyy', { locale: es });
}

/**
 * Devuelve rango de fechas para filtros en hora local (Mexico).
 * desde: inicio del día local; hasta: fin del día local.
 * Para columnas DATE en Supabase usar solo .gte('fecha', desde) y .lte('fecha', hasta).
 * Para columnas TIMESTAMPTZ usar getFilterDateRangeISO.
 */
export function getFilterDateRange(desdeStr, hastaStr) {
  const desde = parseDateOnly(desdeStr) || new Date();
  const hasta = parseDateOnly(hastaStr) || new Date();
  return {
    desde: format(desde, 'yyyy-MM-dd'),
    hasta: format(hasta, 'yyyy-MM-dd'),
  };
}

/**
 * Rango para consultas con timestamptz: incluye 00:00:00 del día inicio
 * y 23:59:59.999 del día fin en hora local, convertidos a ISO para Supabase.
 */
export function getFilterDateRangeISO(desdeStr, hastaStr) {
  const d = parseDateOnly(desdeStr);
  const h = parseDateOnly(hastaStr);
  if (!d || !h) return { desde: desdeStr, hasta: hastaStr };
  const startLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endLocal = new Date(h.getFullYear(), h.getMonth(), h.getDate(), 23, 59, 59, 999);
  return {
    desde: startLocal.toISOString(),
    hasta: endLocal.toISOString(),
  };
}
