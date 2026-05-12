import React from 'react';
import { useNavigate } from 'react-router-dom';
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

const ProyectosList = ({ proyectos, onDeleteRequest, onSort, sortConfig }) => {
    const navigate = useNavigate();

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) {
            return <ChevronsUpDown className="ml-2 h-4 w-4 opacity-30" />;
        }
        if (sortConfig.direction === 'ascending') {
            return <ChevronUp className="ml-2 h-4 w-4" />;
        }
        return <ChevronDown className="ml-2 h-4 w-4" />;
    };

    if (proyectos.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-gray-500 font-semibold text-lg">No se encontraron proyectos</p>
                <p className="text-gray-400 mt-1">Intenta ajustar tu búsqueda.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-gray-50">
                        <TableHead className="w-[120px]">
                            <Button variant="ghost" onClick={() => onSort('prioridad')} className="px-1 font-bold text-gray-600">
                                Prioridad {getSortIndicator('prioridad')}
                            </Button>
                        </TableHead>
                        <TableHead className="w-[120px] font-bold text-gray-600">Folio</TableHead>
                        <TableHead className="font-bold text-gray-600">Descripción</TableHead>
                        <TableHead className="font-bold text-gray-600">Cliente</TableHead>
                        <TableHead className="font-bold text-gray-600">Estado de Pago</TableHead>
                        <TableHead className="font-bold text-gray-600">Estatus</TableHead>
                        <TableHead className="text-right font-bold text-gray-600">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {proyectos.map((proyecto) => {
                        const costoTotal = proyecto.cotizacion?.total || 0;
                        const totalPagado = proyecto.proyecto_pagos.reduce((sum, pago) => sum + pago.monto, 0);
                        const saldoPendiente = costoTotal - totalPagado;
                        const isPagado = saldoPendiente <= 0 && costoTotal > 0;

                        return (
                        <motion.tr
                            key={proyecto.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-gray-50 cursor-pointer border-b"
                            onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                        >
                            <TableCell>
                                 <Badge variant="outline" className={`font-semibold ${prioridadColors[proyecto.prioridad] || prioridadColors['Baja']}`}>
                                    {proyecto.prioridad}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-blue-600">{proyecto.folio}</TableCell>
                            <TableCell className="font-medium text-gray-800">{proyecto.descripcion}</TableCell>
                            <TableCell className="text-gray-600">{proyecto.cliente?.nombre || proyecto.cliente_nombre_externo}</TableCell>
                            <TableCell>
                                {costoTotal > 0 ? (
                                    isPagado ? (
                                        <Badge className="bg-green-100 text-green-800 border border-green-200">PAGADO</Badge>
                                    ) : (
                                        <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200">SALDO PENDIENTE</Badge>
                                    )
                                ) : (
                                    <span className="text-xs text-gray-400">N/A</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <EstatusBadge estatus={proyecto.estatus} />
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8"
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