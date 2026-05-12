/**
 * URL base del backend API. Blindaje absoluto: nunca retorna vacío en producción.
 * 1) Usa VITE_API_URL si Vite la cargó; 2) En dev → localhost; 3) En prod → fallback a Render.
 */
export function getApiBase() {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3001';
  }
  return 'https://tesey-api.onrender.com';
}
