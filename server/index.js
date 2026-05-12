import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { google } from 'googleapis';
// PDF/Drive pausado — reactivar cuando se corrija el servicio
// import { uploadQuotePDF } from './GoogleDriveService.js';
import { syncProjectEvent, getAuth, deleteProjectEvent, createBirthdayEvent } from './GoogleCalendarService.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
});

// Ruta de subida a Drive PAUSADA — reactivar cuando se corrija el servicio
app.post('/api/drive/upload-quote', upload.single('file'), async (req, res) => {
  // const result = await uploadQuotePDF(...) — deshabilitado temporalmente
  return res.status(503).json({
    success: false,
    error: 'Creación de PDF y subida a Google Drive temporalmente deshabilitadas. Se reactivarán después.',
  });
  // try {
  //   if (!req.file) {
  //     return res.status(400).json({
  //       success: false,
  //       error: 'No se recibió ningún archivo. Envía el PDF en el campo "file".',
  //     });
  //   }
  //   const fileName = req.body.fileName || req.file.originalname || `cotizacion-${Date.now()}.pdf`;
  //   const sanitized = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  //   const result = await uploadQuotePDF(req.file.buffer, sanitized);
  //   return res.status(200).json({
  //     success: true,
  //     message: 'Archivo subido correctamente a Google Drive.',
  //     driveFileId: result.id,
  //     webViewLink: result.webViewLink,
  //   });
  // } catch (err) {
  //   console.error('Error en Drive API (upload-quote):', err.message, err.stack);
  //   return res.status(500).json({
  //     success: false,
  //     error: err.message || 'Error al subir el archivo a Drive.',
  //   });
  // }
});

app.post('/api/calendar/sync-project', async (req, res) => {
  try {
    const proyecto = req.body;
    if (!proyecto || typeof proyecto !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el objeto proyecto en el body (folio, cliente, fecha_inicio, fecha_fin, google_calendar_event_id).',
      });
    }
    const { eventId } = await syncProjectEvent(proyecto);
    return res.status(200).json({
      success: true,
      google_calendar_event_id: eventId,
    });
  } catch (err) {
    console.error('Error en Calendar API (sync-project):', err.message, err.stack);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error al sincronizar con Google Calendar.',
    });
  }
});

app.delete('/api/calendar/event/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ success: false, error: 'Falta el eventId' });
    }
    await deleteProjectEvent(eventId);
    return res.json({ success: true, message: 'Evento eliminado de Google Calendar' });
  } catch (err) {
    console.error('🔥 Error eliminando evento de Calendar:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** Crear evento de cumpleaños (todo el día) en Google Calendar para el año en curso */
app.post('/api/calendar/birthday', async (req, res) => {
  try {
    const empleado = req.body;
    if (!empleado || typeof empleado !== 'object' || !empleado.fecha_nacimiento) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere objeto empleado con fecha_nacimiento (y nombre_completo).',
      });
    }
    const { eventId } = await createBirthdayEvent(empleado);
    return res.status(200).json({ success: true, eventId });
  } catch (err) {
    console.error('Error en Calendar API (birthday):', err.message, err.stack);
    return res.status(500).json({ success: false, error: err.message || 'Error al crear evento de cumpleaños.' });
  }
});

/** Endpoint de prueba: verifica conexión a Google Calendar sin depender de frontend ni Supabase */
const TEST_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '26242db9062b40165696b9f6b7e9e918db6453400d9f0acbcca338101b381839@group.calendar.google.com';

app.get('/api/test-calendar-bot', async (req, res) => {
  console.log('🤖 Iniciando prueba de conexión a Google Calendar...');
  try {
    const auth = getAuth();
    const calendar = google.calendar({ version: 'v3', auth });
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const response = await calendar.events.insert({
      calendarId: TEST_CALENDAR_ID,
      resource: {
        summary: '🔧 PRUEBA DE CONEXIÓN BOT TESEY',
        start: { date: today },
        end: { date: tomorrow },
      },
    });

    console.log('✅ ¡ÉXITO! Evento creado:', response.data.htmlLink);
    res.json({ success: true, message: 'Bot conectado. Evento creado.', link: response.data.htmlLink });
  } catch (error) {
    console.error('❌ ERROR DEL BOT DE CALENDARIO:', error.message);
    res.status(500).json({ error: error.message, details: String(error) });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor TESEY API en http://localhost:${PORT}`);
});
