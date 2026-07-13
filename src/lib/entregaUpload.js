import { supabase } from '@/lib/customSupabaseClient';

const MAX_FOTO_PX = 1600;
const JPEG_QUALITY = 0.8;

async function decodeImagen(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch { /* WebViews viejos: caer al método clásico */ }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
    img.src = url;
  });
}

/**
 * Comprime una foto de cámara (8–14 MB típicos) a JPEG ≤1600px antes de
 * preview/subida. Las fotos a resolución completa decodificadas en RAM
 * mataban la pestaña en móviles de campo (pantalla blanca) y tardaban
 * minutos en subir por 4G. Si algo falla devuelve el archivo original:
 * mejor una subida lenta que una entrega bloqueada.
 */
export async function compressEntregaFoto(file) {
  try {
    const src = await decodeImagen(file);
    const scale = Math.min(1, MAX_FOTO_PX / Math.max(src.width, src.height));
    const w = Math.max(1, Math.round(src.width * scale));
    const h = Math.max(1, Math.round(src.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(src, 0, 0, w, h);
    if (src.close) src.close(); // liberar el bitmap full-res de inmediato
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const nombre = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], nombre, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

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
