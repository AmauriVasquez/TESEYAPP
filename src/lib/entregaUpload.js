import { supabase } from '@/lib/customSupabaseClient';
import { getApiBase } from '@/lib/apiUrl';

/**
 * Evidencia fotográfica de entrega (no bitácora). Misma estrategia que otras imágenes de proyecto.
 */
export async function uploadEntregaImage(file, proyectoId, sanitizeFilename) {
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
  const filePath = `entregas/${proyectoId}/foto_${Date.now()}_${name}`;
  const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, file);
  if (uploadError) throw new Error(uploadError.message);
  return supabase.storage.from('proyecto_archivos').getPublicUrl(filePath).data.publicUrl;
}
