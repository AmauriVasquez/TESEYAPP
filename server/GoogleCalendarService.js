import { google } from 'googleapis';

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '26242db9062b40165696b9f6b7e9e918db6453400d9f0acbcca338101b381839@group.calendar.google.com';

/**
 * Autenticación con la misma Service Account que Drive.
 * El calendario debe estar compartido con el client_email de la cuenta de servicio (permiso "Hacer cambios en los eventos").
 */
export function getAuth() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    console.error('[Calendar] Faltan GOOGLE_DRIVE_CLIENT_EMAIL o GOOGLE_DRIVE_PRIVATE_KEY en .env');
    throw new Error('Faltan credenciales de Google en .env');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });
}

const TIMEZONE = 'America/Mexico_City';

/**
 * Sincroniza un proyecto con Google Calendar (crear o actualizar evento de todo el día).
 * Usa extracción YYYY-MM-DD y cálculo en UTC para evitar offset de zona horaria.
 * @param {object} proyecto - { folio, descripcion, fecha_inicio, fecha_fin, google_calendar_event_id }
 * @returns {Promise<{ eventId: string }>} ID del evento en Google Calendar
 */
export async function syncProjectEvent(proyecto) {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const title = `[PROYECTO] ${proyecto.folio || 'Sin folio'} - ${proyecto.descripcion || 'Sin descripción'}`;

  // Extracción segura YYYY-MM-DD (por si la BD manda ISO completo)
  const rawStart = String(proyecto.fecha_inicio || '').trim();
  const rawEnd = String(proyecto.fecha_fin || '').trim();
  if (!rawStart) {
    throw new Error('El proyecto debe tener fecha_inicio para sincronizar con el calendario.');
  }

  const startDateStr = rawStart.split('T')[0];
  const endDateStr = rawEnd ? rawEnd.split('T')[0] : startDateStr;

  // End date en UTC a mediodía + 1 día (Google all-day usa end.date exclusivo)
  const endDateObj = new Date(endDateStr + 'T12:00:00Z');
  endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
  const googleEndDateStr = endDateObj.toISOString().split('T')[0];

  const eventBody = {
    summary: title,
    start: {
      date: startDateStr,
      timeZone: TIMEZONE,
    },
    end: {
      date: googleEndDateStr,
      timeZone: TIMEZONE,
    },
  };

  const eventId = proyecto.google_calendar_event_id || null;

  if (eventId) {
    console.log('[Calendar] Actualizando evento existente:', eventId);
    await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,
      requestBody: eventBody,
    });
    console.log('[Calendar] Evento actualizado correctamente.');
    return { eventId };
  }

  console.log('[Calendar] Creando nuevo evento en el calendario.');
  const { data } = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: eventBody,
  });
  const newEventId = data.id;
  console.log('[Calendar] Evento creado con ID:', newEventId);
  return { eventId: newEventId };
}

/**
 * Elimina un evento del calendario de Google (p. ej. cuando el proyecto pasa a Terminado/Entregado).
 * @param {string} eventId - ID del evento en Google Calendar
 */
export async function deleteProjectEvent(eventId) {
  if (!eventId) {
    throw new Error('Se requiere eventId para eliminar el evento.');
  }
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  console.log(`[Calendar] Intentando eliminar evento: ${eventId}`);
  await calendar.events.delete({
    calendarId: CALENDAR_ID,
    eventId: eventId,
  });
  console.log(`[Calendar] Evento ${eventId} eliminado correctamente.`);
}

/**
 * Crea un evento de cumpleaños (todo el día) en Google Calendar para el año en curso.
 * @param {object} empleado - { nombre_completo, fecha_nacimiento } (fecha_nacimiento YYYY-MM-DD o ISO)
 * @returns {Promise<{ eventId: string }>} ID del evento creado
 */
export async function createBirthdayEvent(empleado) {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const raw = String(empleado.fecha_nacimiento || '').trim();
  if (!raw) throw new Error('El empleado debe tener fecha_nacimiento para crear evento de cumpleaños.');
  const datePart = raw.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!m || !d) throw new Error('fecha_nacimiento inválida.');

  const yearActual = new Date().getFullYear();
  const startDateStr = `${yearActual}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const endDateObj = new Date(startDateStr + 'T12:00:00Z');
  endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
  const endDateStr = endDateObj.toISOString().split('T')[0];

  const nombre = empleado.nombre_completo || 'Colaborador';
  const summary = `🎂 Cumpleaños de ${nombre}`;

  const eventBody = {
    summary,
    start: { date: startDateStr, timeZone: TIMEZONE },
    end: { date: endDateStr, timeZone: TIMEZONE },
  };

  console.log('[Calendar] Creando evento de cumpleaños:', summary);
  const { data } = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: eventBody,
  });
  const eventId = data.id;
  console.log('[Calendar] Evento de cumpleaños creado con ID:', eventId);
  return { eventId };
}
