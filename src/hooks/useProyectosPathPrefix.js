import { useLocation } from 'react-router-dom';

/** Ruta canónica del listado bajo el módulo Operaciones (enlaces desde dashboard, cotizaciones, etc.). */
export const PROYECTOS_LIST_PATH_OPERACIONES = '/operaciones/proyectos';

/**
 * Prefijo para listado/detalle: mantiene `/operaciones/proyectos` si ya estás en ese árbol,
 * `/proyectos` si usas la ruta clásica, o el listado de Operaciones en el resto de la app.
 */
export function useProyectosPathPrefix() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/operaciones/proyectos')) return '/operaciones/proyectos';
  if (pathname.startsWith('/proyectos')) return '/proyectos';
  return PROYECTOS_LIST_PATH_OPERACIONES;
}
