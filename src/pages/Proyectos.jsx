import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Search, Loader2, PackageCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import NuevoProyectoDialog from '@/components/proyectos/NuevoProyectoDialog';
import EntregaMasivaModal from '@/components/proyectos/EntregaMasivaModal';
import { notifyNewProject } from '@/services/TelegramService';
import ProyectosList from '@/components/proyectos/ProyectosList';
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
import { cn } from '@/lib/utils';

const Proyectos = () => {
    const { toast } = useToast();
    const [proyectos, setProyectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    
    // Estados de diálogos
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [projectToDelete, setProjectToDelete] = useState(null);

    // Filtros y Ordenamiento
    const [sortConfig, setSortConfig] = useState({ key: 'prioridad', direction: 'ascending' });
    const [statusFilter, setStatusFilter] = useState('activos');

    // Entrega masiva
    const [seleccionActiva, setSeleccionActiva] = useState(false);
    const [seleccionados, setSeleccionados] = useState([]); // ids
    const [masivaOpen, setMasivaOpen] = useState(false);

    // ------------------------------------------------------------------
    // CARGA DE DATOS
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
                `)
                .order('id', { ascending: false });

            if (error) throw error;
            
            const projectsWithClientName = (data || []).map(p => ({
                ...p,
                cliente_nombre: p.cliente?.nombre || p.cliente_nombre_externo || 'Sin Cliente',
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

    useEffect(() => {
        fetchProyectos();
    }, [fetchProyectos]);

    // ------------------------------------------------------------------
    // MANEJADORES
    // ------------------------------------------------------------------
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
        }));
    };

    const handleDeleteRequest = (proyecto) => {
        setProjectToDelete(proyecto);
        setDeleteConfirmationOpen(true);
    };

    // ------------------------------------------------------------------
    // SELECCIÓN / ENTREGA MASIVA
    // ------------------------------------------------------------------
    const toggleSeleccion = (id) =>
        setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

    const toggleSeleccionTodos = (idsElegibles) =>
        setSeleccionados((prev) =>
            idsElegibles.every((id) => prev.includes(id))
                ? prev.filter((id) => !idsElegibles.includes(id))
                : Array.from(new Set([...prev, ...idsElegibles]))
        );

    const salirSeleccion = () => {
        setSeleccionActiva(false);
        setSeleccionados([]);
    };

    // Proyectos seleccionados (objetos completos) a partir de la lista cargada
    const proyectosSeleccionados = useMemo(
        () => proyectos.filter((p) => seleccionados.includes(p.id)),
        [proyectos, seleccionados]
    );

    // Validación: todos del mismo cliente registrado (cliente_id no nulo y único)
    const clienteIdsSeleccion = useMemo(
        () => Array.from(new Set(proyectosSeleccionados.map((p) => p.cliente_id ?? null))),
        [proyectosSeleccionados]
    );
    const mismaSeleccionValida =
        proyectosSeleccionados.length > 0 &&
        clienteIdsSeleccion.length === 1 &&
        clienteIdsSeleccion[0] != null;

    // El evento de Google se crea/actualiza/borra desde el flujo de estatus del
    // proyecto (ver ProyectoDetalle + lib/calendarApi). Ya no hay sync masivo.

    const handleDeleteConfirm = async () => {
        if (!projectToDelete) return;
        try {
            const { error } = await supabase.from('proyectos').delete().eq('id', projectToDelete.id);
            if (error) throw error;
            toast({ title: 'Proyecto eliminado', description: 'El registro se borró correctamente.' });
            fetchProyectos();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el proyecto.' });
        } finally {
            setDeleteConfirmationOpen(false);
            setProjectToDelete(null);
        }
    };

    const handleSave = async (nuevoProyectoData) => {
        try {
            setLoading(true);
            const añoActual = new Date().getFullYear();

            // 1. Buscar folio
            const { data: lastProject, error: fetchError } = await supabase
                .from('proyectos')
                .select('folio')
                .like('folio', `PRJ-${añoActual}-%`)
                .order('folio', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (fetchError) throw fetchError;

            // 2. Calcular siguiente
            let siguienteCorrelativo = 1;
            if (lastProject && lastProject.folio) {
                const partes = lastProject.folio.split('-');
                const ultimoNumero = parseInt(partes[2]); 
                if (!isNaN(ultimoNumero)) {
                    siguienteCorrelativo = ultimoNumero + 1;
                }
            }

            const nuevoFolio = `PRJ-${añoActual}-${String(siguienteCorrelativo).padStart(4, '0')}`;

            // 3. Insertar
            const { error: insertError } = await supabase
                .from('proyectos')
                .insert({
                    ...nuevoProyectoData,
                    folio: nuevoFolio,
                    estatus: 'Por Iniciar',
                });

            if (insertError) throw insertError;

            // Obtener nombre del cliente para la notificación
            let clienteNombre = nuevoProyectoData.cliente_nombre_externo || 'Sin cliente';
            if (nuevoProyectoData.cliente_id) {
                const { data: clienteData } = await supabase
                    .from('clientes')
                    .select('nombre')
                    .eq('id', nuevoProyectoData.cliente_id)
                    .single();
                if (clienteData) clienteNombre = clienteData.nombre;
            }

            // Enviar notificación a Telegram
            notifyNewProject({
                descripcion: nuevoProyectoData.descripcion,
                cliente_nombre: clienteNombre,
                folio: nuevoFolio,
            });

            toast({ title: '✅ Proyecto Guardado', description: `Folio generado: ${nuevoFolio}` });
            fetchProyectos();
            setDialogOpen(false);
        } catch (error) {
            console.error("Error al guardar:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar el registro.' });
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------------------------------------------
    // FILTRADO MEMOIZADO (Lógica actualizada para sort dinámico)
    // ------------------------------------------------------------------
    const sortedAndFilteredProyectos = useMemo(() => {
        let filtered = proyectos.filter(p => {
            const term = (searchTerm ?? '').toLowerCase();
            return (
                (p.folio ?? '').toLowerCase().includes(term) ||
                (p.descripcion ?? '').toLowerCase().includes(term) ||
                (p.cliente_nombre ?? '').toLowerCase().includes(term)
            );
        });

        if (statusFilter !== 'todos') {
            const finishedStatuses = ['Terminado', 'Entregado'];
            if (statusFilter === 'activos') {
                filtered = filtered.filter(p => p?.estatus && !finishedStatuses.includes(p.estatus) && p.estatus !== 'Cancelado');
            } else if (statusFilter === 'terminados') {
                filtered = filtered.filter(p => p?.estatus === 'Terminado');
            } else if (statusFilter === 'entregados') {
                filtered = filtered.filter(p => p?.estatus === 'Entregado');
            } else if (statusFilter === 'saldo_pendiente') {
                filtered = filtered.filter(p => {
                    const costoTotal = Number(p?.cotizacion?.total ?? 0) || 0;
                    const totalPagado = (p?.proyecto_pagos ?? []).reduce((s, x) => s + Number(x?.monto ?? 0), 0);
                    return costoTotal > 0 && totalPagado < costoTotal;
                });
            }
        }

        // Lógica de ordenamiento dinámica (compatible con el nuevo ProyectosList)
        filtered.sort((a, b) => {
            const key = sortConfig?.key ?? 'prioridad';
            const direction = sortConfig?.direction === 'ascending' ? 1 : -1;

            // Prioridad personalizada
            if (key === 'prioridad') {
                const prioridadOrder = { 'Urgente': 0, 'Alta': 1, 'Media': 2, 'Baja': 3 };
                const valA = prioridadOrder[a.prioridad] ?? 4;
                const valB = prioridadOrder[b.prioridad] ?? 4;
                return (valA - valB) * direction;
            }

            // Texto o Números genéricos
            const valA = a[key] ? a[key].toString().toLowerCase() : '';
            const valB = b[key] ? b[key].toString().toLowerCase() : '';

            if (valA < valB) return -1 * direction;
            if (valA > valB) return 1 * direction;
            return 0;
        });

        return filtered;
    }, [proyectos, searchTerm, sortConfig, statusFilter]);

    return (
        <>
            <Helmet><title>Proyectos - IIHEMSA Peninsular</title></Helmet>

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Proyectos y Compras</h2>
                        <p className="text-gray-600 mt-1">Gestión integral de proyectos y secuencia de folios.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={seleccionActiva ? 'secondary' : 'outline'}
                            onClick={() => (seleccionActiva ? salirSeleccion() : setSeleccionActiva(true))}
                            className="gap-2"
                        >
                            <PackageCheck className="w-4 h-4" />
                            {seleccionActiva ? 'Cancelar selección' : 'Entrega masiva'}
                        </Button>
                        <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
                            <Plus className="w-4 h-4" /> Nuevo Proyecto
                        </Button>
                    </div>
                </div>

                {/* Barra de búsqueda y filtros */}
                <div className="bg-white p-4 rounded-xl border shadow-sm mb-4">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                        {/* Buscador */}
                        <div className="relative flex-grow w-full sm:max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <Input
                                placeholder="Buscar por folio, descripción o cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                        </div>

                        {/* Barra de filtros (texto) */}
                        <div className="flex flex-wrap items-center justify-end gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('activos')}
                                className={cn(
                                    'hover:text-primary transition-colors',
                                    statusFilter === 'activos' ? 'text-primary font-bold' : ''
                                )}
                            >
                                Activos
                            </button>
                            <span className="text-gray-300 select-none">|</span>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('terminados')}
                                className={cn(
                                    'hover:text-primary transition-colors',
                                    statusFilter === 'terminados' ? 'text-primary font-bold' : ''
                                )}
                            >
                                Terminados
                            </button>
                            <span className="text-gray-300 select-none">|</span>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('entregados')}
                                className={cn(
                                    'hover:text-primary transition-colors',
                                    statusFilter === 'entregados' ? 'text-primary font-bold' : ''
                                )}
                            >
                                Entregados
                            </button>
                            <span className="text-gray-300 select-none">|</span>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('saldo_pendiente')}
                                className={cn(
                                    'hover:text-primary transition-colors',
                                    statusFilter === 'saldo_pendiente' ? 'text-primary font-bold' : ''
                                )}
                            >
                                Saldo Pendiente
                            </button>
                            <span className="text-gray-300 select-none">|</span>
                            <button
                                type="button"
                                onClick={() => setStatusFilter('todos')}
                                className={cn(
                                    'hover:text-primary transition-colors',
                                    statusFilter === 'todos' ? 'text-primary font-bold' : ''
                                )}
                            >
                                Todos
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>
                    ) : (
                        <ProyectosList
                            proyectos={sortedAndFilteredProyectos}
                            onDeleteRequest={handleDeleteRequest}
                            onSort={handleSort}
                            sortConfig={sortConfig}
                            seleccionActiva={seleccionActiva}
                            seleccionados={seleccionados}
                            onToggleSeleccion={toggleSeleccion}
                            onToggleSeleccionTodos={toggleSeleccionTodos}
                        />
                    )}
                </div>
            </div>

            {seleccionActiva && seleccionados.length > 0 && (
              <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-semibold">{seleccionados.length}</span> proyecto(s) seleccionado(s)
                    {!mismaSeleccionValida && (
                      <span className="ml-2 text-red-600">— deben ser del mismo cliente registrado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={salirSeleccion} className="gap-1">
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                    <Button
                      disabled={!mismaSeleccionValida}
                      onClick={() => setMasivaOpen(true)}
                      className="gap-2 bg-teal-600 hover:bg-teal-700"
                    >
                      <PackageCheck className="h-4 w-4" />
                      Entregar seleccionados ({seleccionados.length})
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <EntregaMasivaModal
              open={masivaOpen}
              onOpenChange={setMasivaOpen}
              proyectos={proyectosSeleccionados}
              onSuccess={() => {
                setMasivaOpen(false);
                salirSeleccion();
                fetchProyectos();
              }}
            />

            <NuevoProyectoDialog open={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSave} />

            <AlertDialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar proyecto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción eliminará permanentemente el proyecto <span className="font-bold">{projectToDelete?.folio}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};

export default Proyectos;