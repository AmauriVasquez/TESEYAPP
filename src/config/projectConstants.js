/**
 * Constantes centralizadas para el módulo de Proyectos.
 * Flujo unificado en estatus (sin columna fase).
 */

/** Tubería de trabajo: estatus con avance y colores para Badge/Progress */
export const ESTATUS_WORKFLOW = [
  { nombre: 'Por Iniciar', avance: 0, bg: 'bg-gray-100', text: 'text-gray-800' },
  { nombre: 'Planeación', avance: 15, bg: 'bg-blue-100', text: 'text-blue-800' },
  { nombre: 'Solicitud de Materiales', avance: 30, bg: 'bg-amber-100', text: 'text-amber-800' },
  { nombre: 'En Proceso', avance: 50, bg: 'bg-emerald-100', text: 'text-emerald-800' },
  { nombre: 'Detallado', avance: 75, bg: 'bg-violet-100', text: 'text-violet-800' },
  { nombre: 'Revisión', avance: 90, bg: 'bg-slate-100', text: 'text-slate-800' },
  { nombre: 'Terminado', avance: 100, bg: 'bg-teal-100', text: 'text-teal-800' },
  { nombre: 'Entregado', avance: 100, bg: 'bg-teal-200', text: 'text-teal-900' },
  { nombre: 'Detenido', avance: null, bg: 'bg-yellow-100', text: 'text-yellow-800' },
  { nombre: 'Cancelado', avance: null, bg: 'bg-red-100', text: 'text-red-800' },
];

/** Mapa estatus → clases CSS para Badge (compatibilidad) */
export const ESTATUS_COLOR_CLASSES = ESTATUS_WORKFLOW.reduce((acc, s) => {
  acc[s.nombre] = `${s.bg} ${s.text}`;
  return acc;
}, {});

/** Obtener clases de color para un estatus */
export const getEstatusColorClasses = (estatus) => {
  return ESTATUS_COLOR_CLASSES[estatus] || 'bg-gray-100 text-gray-800';
};

/** Compatibilidad: alias para componentes que usaban getFaseColorClasses(fase) */
export const getFaseColorClasses = (estatus) => getEstatusColorClasses(estatus);

/** Fases visuales del progreso (solo pasos operativos, para la barra de fases en detalle) */
export const PROJECT_PHASES = ESTATUS_WORKFLOW.filter(
  (s) => ['Planeación', 'Solicitud de Materiales', 'En Proceso', 'Detallado', 'Revisión', 'Terminado'].includes(s.nombre)
);
export const DEFAULT_PHASE = 'Planeación';
