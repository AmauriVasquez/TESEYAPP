import React from 'react';
import { Badge } from '@/components/ui/badge';

export const estatusColors = {
  'Por Iniciar': 'bg-gray-200 text-gray-800',
  'En Proceso': 'bg-blue-200 text-blue-800',
  'Detenido': 'bg-yellow-200 text-yellow-800',
  'Terminado': 'bg-green-200 text-green-800',
  'Entregado': 'bg-teal-200 text-teal-800',
  'Cancelado': 'bg-red-200 text-red-800',
};

export const estatusOptions = [
  { value: 'Por Iniciar', label: 'Por Iniciar' },
  { value: 'En Proceso', label: 'En Proceso' },
  { value: 'Detenido', label: 'Detenido' },
  { value: 'Terminado', label: 'Terminado' },
  { value: 'Entregado', label: 'Entregado' },
  { value: 'Cancelado', label: 'Cancelado' },
];

export const faseOptions = [
  { nombre: 'Planeación', avance: 15 },
  { nombre: 'Solicitud de Materiales', avance: 30 },
  { nombre: 'En Proceso', avance: 50 },
  { nombre: 'Detallado', avance: 75 },
  { nombre: 'Revisión', avance: 90 },
];

export const prioridadOptions = [
  { value: 'Baja', label: 'Baja' },
  { value: 'Media', label: 'Media' },
  { value: 'Alta', label: 'Alta' },
  { value: 'Urgente', label: 'Urgente' },
];

export const EstatusBadge = ({ estatus, className }) => {
  const colorClass = estatusColors[estatus] || 'bg-gray-200 text-gray-800';
  return (
    <Badge className={`${colorClass} hover:${colorClass} text-xs py-1 px-3 ${className}`}>
      {estatus}
    </Badge>
  );
};