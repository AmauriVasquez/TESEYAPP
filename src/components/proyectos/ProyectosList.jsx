import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useProyectosPathPrefix } from '@/hooks/useProyectosPathPrefix';
import { motion } from 'framer-motion';
import { Trash2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstatusBadge } from '@/config/proyectosConfig.jsx';

const prioridadColors = {
    'Urgente': 'border-red-600 bg-red-100 text-red-800',
    'Alta': 'border-orange-500 bg-orange-100 text-orange-800',
    'Media': 'border-yellow-500 bg-yellow-100 text-yellow-800',
    'Baja': 'border-gray-400 bg-gray-100 text-gray-700',
};

const ProyectosList = ({
    proyectos = [],
    onDeleteRequest,
    onSort,
    sortConfig = {},
    seleccionActiva = false,
    seleccionados = [],          // array de ids
    onToggleSeleccion,           // (id) => void
    onToggleSeleccionTodos,      // (ids) => void
}) => {
    const navigate = useNavigate();
    const proyectosBase = useProyectosPathPrefix();

    const esEntregable = (p) => Boolean(p.cotizacion_id) && p.estatus !== 'Entregado';
    const idsElegibles = proyectos.filter(esEntregable).map((p) => p.id);
    const todosMarcados = idsElegibles.length > 0 && idsElegibles.every((id) => seleccionados.includes(id));

    // Helper para renderizar encabezados con flecha
    const SortableHead = ({ label, sortKey, className = "" }) => {
        const isActive = sortConfig?.key === sortKey;
        const Icon = isActive 
            ? (sortConfig?.direction === 'ascending' ? ChevronUp : ChevronDown) 
            : ChevronsUpDown;

        return (
            <TableHead className={className}>
                <Button 
                    variant="ghost" 
                    onClick={() => onSort(sortKey)} 
                    className={`h-8 px-2 -ml-2 font-bold hover:bg-gray-100 ${isActive ? 'text-blue-600' : 'text-gray-600'}`}
                >
                    {label}
                    <Icon className={`ml-2 h-4 w-4 ${isActive ? 'opacity-100' : 'opacity-30'}`} />
                </Button>
            </TableHead>
        );
    };

    if (proyectos.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500 font-semibold text-lg">No se encontraron proyectos</p>
                <p className="text-gray-400 mt-1">Intenta ajustar tu búsqueda o los filtros.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50">
                        {seleccionActiva && (
                          <TableHead className="w-[44px]">
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todos los elegibles"
                              className="h-4 w-4 rounded border-gray-300 text-blue-600"
                              checked={todosMarcados}
                              onChange={() => onToggleSeleccionTodos(idsElegibles)}
                            />
                          </TableHead>
                        )}
                        {/* Usamos el helper para cada columna ordenable */}
                        <SortableHead label="Prioridad" sortKey="prioridad" className="w-[120px]" />
                        <SortableHead label="Folio" sortKey="folio" className="w-[120px]" />
                        <SortableHead label="Descripción" sortKey="descripcion" />
                        <SortableHead label="Cliente" sortKey="cliente_nombre" />
                        
                        {/* Columnas que no ordenamos o requieren lógica compleja */}
                        <TableHead className="font-bold text-gray-600">Estado de Pago</TableHead>
                        <SortableHead label="Estatus" sortKey="estatus" />
                        
                        <TableHead className="text-right font-bold text-gray-600">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {proyectos.map((proyecto) => {
                        const costoTotal = proyecto.cotizacion?.total || 0;
                        const totalPagado = proyecto.proyecto_pagos?.reduce((sum, pago) => sum + pago.monto, 0) || 0;
                        const saldoPendiente = costoTotal - totalPagado;
                        const isPagado = saldoPendiente <= 0 && costoTotal > 0;

                        return (
                        <motion.tr
                            key={proyecto.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-gray-50 cursor-pointer border-b transition-colors"
                            onClick={() => navigate(`${proyectosBase}/${proyecto.id}`)}
                        >
                            {seleccionActiva && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar ${proyecto.folio}`}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-40"
                                  disabled={!esEntregable(proyecto)}
                                  checked={seleccionados.includes(proyecto.id)}
                                  onChange={() => onToggleSeleccion(proyecto.id)}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                                 <Badge variant="outline" className={`font-semibold ${prioridadColors[proyecto.prioridad] || prioridadColors['Baja']}`}>
                                    {proyecto.prioridad}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-blue-600 font-medium">{proyecto.folio}</TableCell>
                            <TableCell className="font-medium text-gray-800">{proyecto.descripcion}</TableCell>
                            <TableCell className="text-gray-600">{proyecto.cliente_nombre}</TableCell>
                            <TableCell>
                                {costoTotal > 0 ? (
                                    isPagado ? (
                                        <Badge className="bg-green-100 text-green-800 border border-green-200 shadow-sm">PAGADO</Badge>
                                    ) : (
                                        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm">PENDIENTE</Badge>
                                    )
                                ) : (
                                    <span className="text-xs text-gray-400 italic">Sin cotización</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <EstatusBadge estatus={proyecto.estatus} />
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 hover:bg-red-50"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteRequest(proyecto);
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-red-500 hover:text-red-600" />
                                </Button>
                            </TableCell>
                        </motion.tr>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

export default ProyectosList;