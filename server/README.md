# API Backend TESEY (Google Drive)

## Variables de entorno

Copia `.env.example` a `.env` y rellena con los datos de tu Service Account de Google.  
**No uses el archivo `.json` de la cuenta de servicio en el código:** solo extrae `client_email` y `private_key` al `.env`.

- `GOOGLE_DRIVE_CLIENT_EMAIL` — client_email del JSON
- `GOOGLE_DRIVE_PRIVATE_KEY` — private_key (en .env usa `\n` para los saltos de línea)
- `GOOGLE_DRIVE_ROOT_FOLDER` — ID de la **carpeta** donde se crearán Año → Cotizaciones. Esa carpeta debe ser accesible por la Service Account (ver abajo).

### ⚠️ "Service Accounts do not have storage"

Las cuentas de servicio **no tienen Mi unidad**. Solo pueden escribir en:

1. **Carpeta compartida con la cuenta de servicio (recomendado)**  
   - En Google Drive (Mi unidad) crea una carpeta, p. ej. "TESEY Cotizaciones".  
   - Clic derecho → Compartir. Añade el **email de la Service Account** (el `client_email` de tu `.env`; termina en `@....iam.gserviceaccount.com`).  
   - Asígnale rol **Editor**.  
   - Abre la carpeta en Drive y copia el ID de la URL:  
     `https://drive.google.com/drive/folders/ESTE_ES_EL_ID`  
   - Usa ese ID como `GOOGLE_DRIVE_ROOT_FOLDER`.

2. **Unidad compartida (Shared Drive)**  
   - Crea o usa una Unidad compartida, añade la Service Account como miembro (p. ej. "Administrador de contenido").  
   - Crea o elige una carpeta dentro y usa su ID como `GOOGLE_DRIVE_ROOT_FOLDER`.  
   - El código ya envía `supportsAllDrives: true` para que funcione con Unidades compartidas.

## Seguridad

**Cuando todo funcione, elimina el archivo `.json` de la Service Account** de tu computadora y del proyecto. Las credenciales deben vivir solo en `.env` (y `.env` no se sube a Git).

## Arrancar

```bash
cd server
npm install
npm run dev
```

El servidor queda en `http://localhost:3001`.

## Endpoint: subir PDF de cotización

- **POST** `/api/drive/upload-quote`
- **Content-Type:** `multipart/form-data`
- **Campo:** `file` (archivo PDF)
- **Opcional:** `fileName` (nombre con el que guardar, ej. `COT-2026-0073.pdf`)

**Respuesta exitosa (200):**

```json
{
  "success": true,
  "message": "Archivo subido correctamente a Google Drive.",
  "driveFileId": "...",
  "webViewLink": "https://drive.google.com/file/d/..."
}
```

Los PDFs se guardan en: **Carpeta raíz → Año (ej. 2026) → Cotizaciones → archivo.pdf**

## Google Calendar (opcional)

- **Variable:** `GOOGLE_CALENDAR_ID` — ID del calendario donde se crean/actualizan eventos de proyectos. Por defecto se usa el calendario del ERP. El calendario debe estar **compartido** con el `client_email` de la Service Account (permiso "Hacer cambios en los eventos").
- **POST** `/api/calendar/sync-project`  
  - **Body (JSON):** `{ folio, cliente, fecha_inicio, fecha_fin, google_calendar_event_id? }`  
  - Si `google_calendar_event_id` existe, se actualiza el evento; si no, se crea uno nuevo.  
  - **Respuesta (200):** `{ success: true, google_calendar_event_id: "..." }`
