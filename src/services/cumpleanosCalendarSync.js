/**
 * Sincronización de cumpleaños de empleados activos con Google Calendar.
 * Reglas: solo año en curso; si el cumple ya pasó → eliminar evento; si es hoy o futuro → crear evento.
 */

import { getApiBase } from '@/lib/apiUrl';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Obtiene la fecha de cumpleaños en el año actual (solo mes/día desde fecha_nacimiento).
 * @param {string} fechaNacimiento - YYYY-MM-DD o ISO
 * @returns {{ date: Date, dateStr: string } | null}
 */
export function getCumpleAnoActual(fechaNacimiento) {
  const raw = String(fechaNacimiento || '').trim();
  if (!raw) return null;
  const datePart = raw.split('T')[0];
  const parts = datePart.split('-');
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!m || !d || m < 1 || m > 12) return null;
  const year = new Date().getFullYear();
  const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const date = new Date(dateStr + 'T12:00:00');
  return { date, dateStr };
}

/**
 * Compara solo la fecha (sin hora). todayStr = YYYY-MM-DD de hoy.
 */
function isBeforeToday(cumpleDateStr, todayStr) {
  return cumpleDateStr < todayStr;
}

/**
 * Sincroniza cumpleaños de una lista de empleados con Google Calendar:
 * - Si el cumple del año ya pasó y tiene evento → elimina evento y limpia google_calendar_cumple_id.
 * - Si el cumple es hoy o futuro y no tiene evento → crea evento y guarda el ID en Supabase.
 * Cada empleado se procesa con try/catch para que un fallo no detenga el resto.
 * @param {Array<{ id: string, nombre_completo?: string, fecha_nacimiento?: string, google_calendar_cumple_id?: string | null }>} empleados
 * @returns {Promise<{ creados: number, eliminados: number, errores: number }>}
 */
export async function syncCumpleanosGoogleCalendar(empleados) {
  const base = getApiBase();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  let creados = 0;
  let eliminados = 0;
  let errores = 0;

  const list = Array.isArray(empleados) ? empleados : [];
  for (const emp of list) {
    const cumple = getCumpleAnoActual(emp.fecha_nacimiento);
    if (!cumple) continue;

    try {
      const yaPaso = isBeforeToday(cumple.dateStr, todayStr);

      if (yaPaso && emp.google_calendar_cumple_id) {
        const res = await fetch(`${base}/api/calendar/event/${encodeURIComponent(emp.google_calendar_cumple_id)}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || res.statusText);
        }
        const { error } = await supabase
          .from('empleados')
          .update({ google_calendar_cumple_id: null })
          .eq('id', emp.id);
        if (error) throw error;
        eliminados++;
      } else if (!yaPaso && !emp.google_calendar_cumple_id) {
        const res = await fetch(`${base}/api/calendar/birthday`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: emp.id,
            nombre_completo: emp.nombre_completo,
            fecha_nacimiento: emp.fecha_nacimiento,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || res.statusText);
        const eventId = data.eventId;
        if (!eventId) throw new Error('El backend no devolvió eventId');
        const { error } = await supabase
          .from('empleados')
          .update({ google_calendar_cumple_id: eventId })
          .eq('id', emp.id);
        if (error) throw error;
        creados++;
      }
    } catch (e) {
      console.error('[cumpleanosCalendarSync] Error para empleado', emp?.id, emp?.nombre_completo, e);
      errores++;
    }
  }

  return { creados, eliminados, errores };
}
