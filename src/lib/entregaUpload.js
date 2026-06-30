import { supabase } from '@/lib/customSupabaseClient';

/**
 * Evidencia fotográfica de entrega (no bitácora). Sube al bucket
 * `proyecto_archivos` de Supabase Storage y devuelve la URL pública.
 */
export async function uploadEntregaImage(file, proyectoId, sanitizeFilename) {
  const name = sanitizeFilename(file.name);
  const filePath = `entregas/${proyectoId}/foto_${Date.now()}_${name}`;
  const { error: uploadError } = await supabase.storage.from('proyecto_archivos').upload(filePath, file);
  if (uploadError) throw new Error(uploadError.message);
  return supabase.storage.from('proyecto_archivos').getPublicUrl(filePath).data.publicUrl;
}
