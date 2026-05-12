import { supabase } from '@/lib/customSupabaseClient';
import { getApiBase } from '@/lib/apiUrl';

/**
 * Sube imagen de bitácora. Intenta POST a `/api/drive/upload-image` si el backend lo expone;
 * si no responde OK, usa bucket `proyecto_archivos` (mismo flujo que el resto del ERP).
 */
export async function uploadBitacoraImage(file, proyectoId, sanitizeFilename) {
  const tryDrive = async () => {
    const url = `${getApiBase()}/api/drive/upload-image`;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('proyectoId', String(proyectoId));
    const res = await fetch(url, { method: 'POST', body: fd });
    if (!res.ok) return null;
    const j = await res.json().catch(() => ({}));
    return j.webViewLink || j.publicUrl || j.url || null;
  };

  let imageUrl = null;
  try {
    imageUrl = await tryDrive();
  } catch {
    imageUrl = null;
  }

  if (imageUrl) return imageUrl;

  const name = sanitizeFilename(file.name);
  const filePath = `bitacora/${proyectoId}/${Date.now()}_${name}`;
  const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, file);
  if (uploadError) throw new Error(uploadError.message);
  return supabase.storage.from('proyecto_archivos').getPublicUrl(filePath).data.publicUrl;
}
