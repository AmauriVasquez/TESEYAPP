import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Plus, Search, Loader2, LayoutList, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import NuevoProyectoDialog from '@/components/proyectos/NuevoProyectoDialog';
import ProyectosList from '@/components/proyectos/ProyectosList';
import ProyectosCalendar from '@/components/proyectos/ProyectosCalendar';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

const Proyectos = () => {
    const { toast } = useToast();
    // Nota: Mantenemos el hook useLocation por si lo necesitas en el futuro, 
    // pero ya no lo usaremos para forzar recargas en el useEffect.
    const location = useLocation(); 
    
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estados de diálogos (Modales)
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);
    
    // Configuración de filtros y ordenamiento
    const [sortConfig, setSortConfig] = useState({ key: 'prioridad', direction: 'ascending' });
    const [statusFilter, setStatusFilter] = useState('Activos');

    // ------------------------------------------------------------------
    // FUNCIÓN DE CARGA DE DATOS (CORREGIDA)
    // ------------------------------------------------------------------
    const fetchProyectos = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('proyectos')
                .select(`
                    *, 
                    cliente:cliente_id(nombre), 
                    responsable:responsable_id(nombre_completo),
                    cotizacion:cotizacion_id(total),
                    proyecto_pagos(monto)
                `);

            if (error) throw error;
            
            // Protección contra datos nulos
            const safeData = data || [];

            const projectsWithClientName = safeData.map(p => ({
                ...p,
                cliente_nombre: p.cliente?.nombre || p.cliente_nombre_externo || 'N/A',
                responsable_nombre: p.responsable?.nombre_completo || 'No asignado'
            }));

            setProyectos(projectsWithClientName);
        } catch (error) {
            console.error("Error cargando proyectos:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudieron cargar los proyectos.',
            });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // ------------------------------------------------------------------
    // USE EFFECT (CORREGIDO)
    // Eliminamos 'location' de las dependencias para evitar conflictos
    // con las transiciones de página.
    // ------------------------------------------------------------------
    useEffect(() => {
        fetchProyectos();
        
        // Listener para actualizar cuando el usuario vuelve a la pestaña
        const handleFocus = () => {
            fetchProyectos();
        };

        window.addEventListener('focus', handleFocus);
        return () => {
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchProyectos]); 

    // ------------------------------------------------------------------
    // MANEJADORES DE EVENTOS
    // ------------------------------------------------------------------
    const handleSave = () => {
        fetchProyectos();
        setDialogOpen(false);
    };

    const handleDeleteRequest = (project) => {
        setProjectToDelete(project);
        setDeleteConfirmationOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!projectToDelete) return;
        
        const { error } = await supabase.rpc('delete_project_and_related_data', { p_project_id: projectToDelete.id });

        if (error) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: 'No se pudo eliminar el proyecto y sus datos relacionados. ' + error.message });
        } else {
            toast({ title: '✅ Proyecto Eliminado', description: `El proyecto ${projectToDelete.folio} ha sido eliminado.` });
            fetchProyectos();
        }
        setDeleteConfirmationOpen(false);
        setProjectToDelete(null);
    };

    const handleSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    // ------------------------------------------------------------------
    // LOGICA DE FILTRADO Y ORDENAMIENTO (MEMOIZADA)
    // ------------------------------------------------------------------
    const sortedAndFilteredProyectos = useMemo(() => {
        let filtered = proyectos.filter(p => 
            (p.folio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.cliente_nombre || '').toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (statusFilter !== 'Todos') {
            const activeStatuses = ['Por Iniciar', 'En Proceso', 'Detenido'];
            const finishedStatuses = ['Terminado', 'Entregado'];
            
            if (statusFilter === 'Activos') {
                filtered = filtered.filter(p => activeStatuses.includes(p.estatus));
            } else if (statusFilter === 'Terminados') {
                filtered = filtered.filter(p => finishedStatuses.includes(p.estatus));
            }
        }

        const prioridadOrder = { 'Urgente': 0, 'Alta': 1, 'Media': 2, 'Baja': 3 };

        filtered.sort((a, b) => {
            if (sortConfig.key === 'prioridad') {
                const valA = prioridadOrder[a.prioridad] ?? 4;
                const valB = prioridadOrder[b.prioridad] ?? 4;
                return sortConfig.direction === 'ascending' ? valA - valB : valB - valA;
            }
            // Puedes agregar más casos de ordenamiento aquí si lo necesitas
            return 0;
        });

        return filtered;
    }, [proyectos, searchTerm, sortConfig, statusFilter]);

    const filterButtons = ['Todos', 'Activos', 'Terminados'];

    // ------------------------------------------------------------------
    // RENDERIZADO (JSX)
    // ------------------------------------------------------------------
    return (
        <>
            <Helmet>
                <title>Proyectos - Sistema TESEY</title>
                <meta name="description" content="Listado y gestión de proyectos, pedidos y compras." />
            </Helmet>

            <div className="space-y-6">
                {/* Header y Botón Nuevo */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Proyectos y Compras</h2>
                        <p className="text-gray-600 mt-1">Gestiona proyectos, pedidos de materiales y órdenes de compra.</p>
                    </div>
                    <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
                        <Plus className="w-4 h-4" />
                        Nuevo Proyecto
                    </Button>
                </div>

                {/* Tabs Principales */}
                <Tabs defaultValue="proyectos" className="w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <TabsList>
                            <TabsTrigger value="proyectos" className="gap-2"><LayoutList className="w-4 h-4"/> Listado</TabsTrigger>
                            <TabsTrigger value="calendario" className="gap-2"><CalendarIcon className="w-4 h-4"/> Calendario</TabsTrigger>
                            <TabsTrigger value="pedidos" onClick={() => toast({ title: "Próximamente", description: "Módulo de Pedidos en construcción 🚧" })}>Pedidos</TabsTrigger>
                            <TabsTrigger value="compras" onClick={() => toast({ title: "Próximamente", description: "Módulo de Compras en construcción 🚧" })}>Compras</TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Contenido: Lista de Proyectos */}
                    <TabsContent value="proyectos">
                        <div className="bg-white p-4 rounded-xl border shadow-sm mb-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-grow">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Buscar por folio, descripción o cliente..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                                    {filterButtons.map(filter => (
                                        <Button 
                                            key={filter} 
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setStatusFilter(filter)}
                                            className={cn(
                                                "flex-1 justify-center transition-colors duration-200",
                                                statusFilter === filter 
                                                    ? 'bg-white text-gray-800 shadow-sm' 
                                                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                                            )}
                                        >
                                            {filter}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl border shadow-sm min-h-[300px]">
                            {loading ? (
                                <div className="flex justify-center items-center h-64">
                                    <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                                </div>
                            ) : (
                                <ProyectosList 
                                    proyectos={sortedAndFilteredProyectos} 
                                    onDeleteRequest={handleDeleteRequest}
                                    onSort={handleSort}
                                    sortConfig={sortConfig}
                                />
                            )}
                        </div>
                    </TabsContent>
                    
                    {/* Contenido: Calendario */}
                    <TabsContent value="calendario">
                        {loading ? (
                            <div className="flex justify-center items-center h-64 bg-white rounded-xl border">
                                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <ProyectosCalendar proyectos={proyectos} />
                        )}
                    </TabsContent>

                    {/* Placeholders para futuras tabs */}
                    <TabsContent value="pedidos">
                        <div className="text-center py-20 bg-white rounded-xl border shadow-sm mt-4">
                            <p className="text-gray-500">La gestión de Pedidos de Materiales estará disponible aquí.</p>
                        </div>
                    </TabsContent>
                    <TabsContent value="compras">
                        <div className="text-center py-20 bg-white rounded-xl border shadow-sm mt-4">
                            <p className="text-gray-500">La gestión de Órdenes de Compra estará disponible aquí.</p>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Modales Globales */}
            <NuevoProyectoDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} />
            
            <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro de eliminar este proyecto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el proyecto <span className="font-bold">{projectToDelete?.folio}</span> y todos sus datos asociados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
                            Eliminar Definitivamente
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Proyectos;