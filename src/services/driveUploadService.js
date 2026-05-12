/**
 * Servicio para subir el PDF de cotización al backend y que este lo suba a Google Drive.
 * Trazas: en el componente que genera el PDF, agregar antes de crear el blob:
 *   console.log("Generando Blob del PDF...");
 * y cuando termine: console.log("Blob generado, tamaño:", pdfBlob.size);
 * Luego llamar a uploadQuotePdfToDrive(pdfBlob, fileName, toast).
 */

import { getApiBase } from '@/lib/apiUrl';

/**
 * Sube un Blob PDF al backend para que lo suba a Google Drive.
 * @param {Blob} pdfBlob - Blob del PDF (ej. generado por jspdf o html2pdf)
 * @param {string} fileName - Nombre del archivo (ej. "COT-2026-0073.pdf")
 * @param {object} toast - Objeto toast de useToast() para mostrar errores (toast({ variant: 'destructive', ... }))
 * @returns {Promise<{ success: boolean, driveFileId?: string, webViewLink?: string, error?: string }>}
 */
export async function uploadQuotePdfToDrive(pdfBlob, fileName, toast) {
  console.log('Blob generado, tamaño:', pdfBlob?.size ?? 0);

  const url = `${getApiBase()}/api/drive/upload-quote`;
  console.log('[Drive] Enviando PDF a:', url);

  const formData = new FormData();
  formData.append('file', pdfBlob, fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  formData.append('fileName', fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 500 || !response.ok) {
      const errorMessage = data.error || response.statusText || 'Error desconocido';
      console.error('Error al subir a Drive:', response.status, errorMessage);
      if (toast) {
        toast({
          variant: 'destructive',
          title: 'Error al subir a Drive',
          description: 'Error al subir a Drive: ' + errorMessage,
        });
      } else {
        alert('Error al subir a Drive: ' + errorMessage);
      }
      return { success: false, error: errorMessage };
    }

    return {
      success: true,
      driveFileId: data.driveFileId,
      webViewLink: data.webViewLink,
    };
  } catch (err) {
    const errorMessage = err.message || 'Error de red';
    console.error('Error en fetch upload-quote:', err.message, err.stack);
    // "Failed to fetch" = backend no responde: no está corriendo, URL equivocada o bloqueado por red/CORS
    const desc = err.message === 'Failed to fetch'
      ? `No se pudo conectar al servidor (${url}). Comprueba que el backend esté en marcha: npm run dev:server`
      : 'Error al subir a Drive: ' + errorMessage;
    if (toast) {
      toast({
        variant: 'destructive',
        title: 'Error al subir a Drive',
        description: desc,
      });
    } else {
      alert(desc);
    }
    return { success: false, error: errorMessage };
  }
}
