import { supabase } from '@/lib/customSupabaseClient';

/**
 * Cliente del Google Calendar vía Edge Function `calendar` (reemplaza al
 * servidor de Render). Se invoca con la sesión del usuario; verify_jwt deja
 * pasar solo a usuarios logueados.
 */
async function invoke(payload) {
  const { data, error } = await supabase.functions.invoke('calendar', { body: payload });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

/** Crea o actualiza el evento del proyecto. Devuelve el eventId de Google. */
export async function syncProyectoEvento({ folio, descripcion, fecha_inicio, fecha_fin, google_calendar_event_id }) {
  const data = await invoke({
    action: 'sync_project',
    folio,
    descripcion,
    fecha_inicio,
    fecha_fin,
    google_calendar_event_id: google_calendar_event_id ?? null,
  });
  return data?.eventId ?? null;
}

/** Borra un evento por id (proyecto Terminado, cumpleaños pasado). */
export async function eliminarEvento(eventId) {
  if (!eventId) return;
  await invoke({ action: 'delete_event', eventId });
}

/** Crea el evento de cumpleaños del empleado. Devuelve el eventId. */
export async function crearEventoCumple({ nombre_completo, fecha_nacimiento }) {
  const data = await invoke({ action: 'birthday', nombre_completo, fecha_nacimiento });
  return data?.eventId ?? null;
}
