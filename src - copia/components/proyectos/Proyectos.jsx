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
    'Alta': 'border-red-500 bg-red-100 text-red-700',
    'Media': 'border-yellow-500 bg-yellow-100 text-yellow-700',
    'Baja': 'border-gray-400 bg-gray-100 text-gray-600',
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
            <div className="text-center py-10">
                <p className="text-gray-500">No hay proyectos en esta categoría.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[120px]">
                            <Button variant="ghost" onClick={() => onSort('prioridad')} className="px-1">
                                Prioridad {getSortIndicator('prioridad')}
                            </Button>
                        </TableHead>
                        <TableHead className="w-[120px]">Folio</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Responsable</TableHead>
                        <TableHead>Estatus</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {proyectos.map((proyecto) => (
                        <motion.tr
                            key={proyecto.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                        >
                            <TableCell>
                                 <Badge variant="outline" className={`font-semibold ${prioridadColors[proyecto.prioridad] || prioridadColors['Baja']}`}>
                                    {proyecto.prioridad}
                                </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-blue-600">{proyecto.folio}</TableCell>
                            <TableCell className="font-medium">{proyecto.descripcion}</TableCell>
                            <TableCell>{proyecto.cliente?.nombre || proyecto.cliente_nombre_externo}</TableCell>
                            <TableCell>{proyecto.responsable?.nombre_completo || 'No asignado'}</TableCell>
                            <TableCell>
                                <EstatusBadge estatus={proyecto.estatus} />
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteRequest(proyecto);
                                    }}
                                >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </TableCell>
                        </motion.tr>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

export default ProyectosList;