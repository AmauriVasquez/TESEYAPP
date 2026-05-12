import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ESTATUS_WORKFLOW, getEstatusColorClasses, PROJECT_PHASES } from '@/config/projectConstants';

/** Colores para Badge por estatus (flujo unificado) */
export const estatusColors = ESTATUS_WORKFLOW.reduce((acc, s) => {
  acc[s.nombre] = `${s.bg} ${s.text}`;
  return acc;
}, {});

export const estatusOptions = ESTATUS_WORKFLOW.map((s) => ({ value: s.nombre, label: s.nombre }));

/** Opciones del dropdown "Estatus del Proyecto" (tubería completa en orden) */
export const estatusWorkflowOptions = [
  'Por Iniciar',
  'Planeación',
  'Solicitud de Materiales',
  'En Proceso',
  'Detallado',
  'Revisión',
  'Terminado',
  'Entregado',
  'Cancelado',
  'Detenido',
].map((nombre) => ({ value: nombre, label: nombre }));

/** Pasos para la barra visual de progreso (sin Terminado/Entregado/Detenido/Cancelado) */
export const faseOptions = PROJECT_PHASES.filter((p) => p.nombre !== 'Terminado').map(
  ({ nombre, avance }) => ({ nombre, avance })
);

export const prioridadOptions = [
  { value: 'Baja', label: 'Baja' },
  { value: 'Media', label: 'Media' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Urgente', label: 'Urgente' },
];

export const EstatusBadge = ({ estatus, className }) => {
  const colorClass = estatusColors[estatus] || getEstatusColorClasses(estatus) || 'bg-gray-200 text-gray-800';
  return (
    <Badge className={`${colorClass} hover:opacity-90 text-xs py-1 px-3 ${className || ''}`}>
      {estatus}
    </Badge>
  );
};

/** Badge por estatus (antes FaseBadge: ahora muestra estatus con mismos colores) */
export const FaseBadge = ({ fase, estatus, className }) => {
  const value = estatus ?? fase;
  const colorClasses = getEstatusColorClasses(value);
  return (
    <Badge variant="outline" className={`${colorClasses} border-transparent text-xs py-1 px-3 font-medium ${className || ''}`}>
      {value || '—'}
    </Badge>
  );
};