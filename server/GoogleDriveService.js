import { google } from 'googleapis';
import { Readable } from 'stream';

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER;
const MIME_FOLDER = 'application/vnd.google-apps.folder';
const MIME_PDF = 'application/pdf';

function getAuth() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  if (!clientEmail || !privateKey) {
    console.error('[Drive] Faltan GOOGLE_DRIVE_CLIENT_EMAIL o GOOGLE_DRIVE_PRIVATE_KEY en .env');
    throw new Error('Faltan GOOGLE_DRIVE_CLIENT_EMAIL o GOOGLE_DRIVE_PRIVATE_KEY en .env');
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  console.log('[Drive] Autenticación GoogleAuth inicializada. client_email:', clientEmail ? `${clientEmail.slice(0, 20)}...` : 'NO');
  return auth;
}

// Necesario para carpetas en Unidades compartidas (Shared Drives)
const DRIVE_OPTS = { supportsAllDrives: true, includeItemsFromAllDrives: true };

/**
 * Busca una carpeta por nombre dentro de parentId. Retorna el id si existe, null si no.
 */
async function findFolderByName(drive, parentId, name) {
  console.log('[Drive] Buscando carpeta por nombre:', name, 'en parentId:', parentId);
  const { data } = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name}' and mimeType = '${MIME_FOLDER}' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
    ...DRIVE_OPTS,
  });
  const file = data.files?.[0];
  return file ? file.id : null;
}

/**
 * Crea una carpeta en Drive dentro de parentId con el nombre dado. Retorna el id.
 */
async function createFolder(drive, parentId, name) {
  const { data } = await drive.files.create({
    requestBody: {
      name,
      mimeType: MIME_FOLDER,
      parents: [parentId],
    },
    fields: 'id',
    ...DRIVE_OPTS,
  });
  return data.id;
}

/**
 * Obtiene o crea la carpeta del año dentro de la raíz. Retorna el id.
 */
async function getOrCreateYearFolder(drive) {
  const year = String(new Date().getFullYear());
  console.log('[Drive] Buscando/Creando carpeta del año:', year);
  let yearFolderId = await findFolderByName(drive, ROOT_FOLDER_ID, year);
  if (!yearFolderId) {
    console.log('[Drive] Carpeta del año no existe, creando:', year);
    yearFolderId = await createFolder(drive, ROOT_FOLDER_ID, year);
  }
  console.log('[Drive] Carpeta del año ID:', yearFolderId);
  return yearFolderId;
}

/**
 * Obtiene o crea la carpeta "Cotizaciones" dentro de la carpeta del año. Retorna el id.
 */
async function getOrCreateCotizacionesFolder(drive, yearFolderId) {
  const name = 'Cotizaciones';
  console.log('[Drive] Buscando/Creando carpeta Cotizaciones...');
  let folderId = await findFolderByName(drive, yearFolderId, name);
  if (!folderId) {
    console.log('[Drive] Carpeta Cotizaciones no existe, creando.');
    folderId = await createFolder(drive, yearFolderId, name);
  }
  console.log('[Drive] Carpeta Cotizaciones ID:', folderId);
  return folderId;
}

/**
 * Sube un PDF de cotización a Drive: Raíz → Año → Cotizaciones → archivo.
 * @param {Buffer|Readable} fileStream - Contenido del archivo (Buffer o stream)
 * @param {string} fileName - Nombre del archivo (ej. "COT-2026-0073.pdf")
 * @returns {Promise<{ id: string, webViewLink: string }>}
 */
export async function uploadQuotePDF(fileStream, fileName) {
  console.log('[Drive] uploadQuotePDF iniciado. fileName:', fileName);
  if (!ROOT_FOLDER_ID) {
    console.error('[Drive] GOOGLE_DRIVE_ROOT_FOLDER no está definido en .env');
    throw new Error('GOOGLE_DRIVE_ROOT_FOLDER no está definido en .env');
  }
  console.log('[Drive] Buscando carpeta raíz con ID:', ROOT_FOLDER_ID);
  let auth;
  let drive;
  try {
    auth = getAuth();
    drive = google.drive({ version: 'v3', auth });
  } catch (err) {
    console.error('[Drive] Error en autenticación:', err.message, err.stack);
    throw err;
  }

  let yearFolderId;
  let cotizacionesFolderId;
  try {
    yearFolderId = await getOrCreateYearFolder(drive);
    cotizacionesFolderId = await getOrCreateCotizacionesFolder(drive, yearFolderId);
  } catch (err) {
    console.error('[Drive] Error en getOrCreateFolderStructure:', err.message, err.stack);
    throw err;
  }

  // 1. VALIDACIÓN AGRESIVA (targetFolderId = ID de la subcarpeta Cotizaciones)
  const targetFolderId = cotizacionesFolderId;
  if (!targetFolderId || typeof targetFolderId !== 'string') {
    console.error('❌ ERROR CRÍTICO: El folder ID de destino está vacío o es inválido:', targetFolderId);
    throw new Error('Error interno: ID de carpeta destino inválido antes de subir.');
  }

  const nombreArchivo = fileName;
  const bufferStream = Buffer.isBuffer(fileStream) ? Readable.from(fileStream) : fileStream;

  console.log(`🚀 Intentando subir archivo '${nombreArchivo}' a la carpeta con ID: ${targetFolderId}`);

  // 2. LA PETICIÓN BLINDADA (requestBody, NO resource — obligatorio en googleapis recientes)
  try {
    const driveResponse = await drive.files.create({
      requestBody: {
        name: nombreArchivo,
        parents: [targetFolderId],
      },
      media: {
        mimeType: 'application/pdf',
        body: bufferStream,
      },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });

    const data = driveResponse.data;
    console.log('✅ Archivo subido con éxito. ID:', data.id);
    return {
      id: data.id,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
    };
  } catch (err) {
    console.error('[Drive] Error en Drive API (files.create):', err.message, err.stack);
    throw err;
  }
}
