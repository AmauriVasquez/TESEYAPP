import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Plus, Search, Loader2, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { getApiBase } from '@/lib/apiUrl';
import NuevoProyectoDialog from '@/components/proyectos/NuevoProyectoDialog';
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
    const [syncAllLoading, setSyncAllLoading] = useState(false);
    
    // Filtros y Ordenamiento
    const [sortConfig, setSortConfig] = useState({ key: 'prioridad', direction: 'ascending' });
    const [statusFilter, setStatusFilter] = useState('activos');

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

    /** Sincronización masiva + limpieza: (1) Eliminar de Google los terminados/entregados con evento; (2) Crear en Google los activos sin evento. */
    const syncAllToCalendar = async () => {
        toast({ title: 'Sincronizando con Google Calendar...', description: 'Limpiando terminados y creando eventos activos.' });
        setSyncAllLoading(true);
        const API_BASE = getApiBase();
        let eliminados = 0;
        let creados = 0;

        try {
            // ——— FASE 1: Limpieza — Eliminar eventos de proyectos Terminado/Entregado que aún tengan ID en Google ———
            const { data: proyectosAClean, error: errClean } = await supabase
                .from('proyectos')
                .select('id, google_calendar_event_id')
                .in('estatus', ['Terminado', 'Entregado'])
                .not('google_calendar_event_id', 'is', null);

            if (!errClean && proyectosAClean?.length) {
                for (const proyecto of proyectosAClean) {
                    const eventId = proyecto.google_calendar_event_id;
                    if (!eventId) continue;
                    try {
                        const res = await fetch(`${API_BASE}/api/calendar/event/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
                        if (res.ok) {
                            await supabase.from('proyectos').update({ google_calendar_event_id: null }).eq('id', proyecto.id);
                            eliminados++;
                        }
                    } catch (_) {
                        // Continuar con el siguiente
                    }
                }
            }

            // ——— FASE 2: Sincronización — Crear en Google los proyectos activos con fechas y sin evento ———
            const { data: proyectosSinSync, error: fetchError } = await supabase
                .from('proyectos')
                .select('id, folio, descripcion, fecha_inicio, fecha_fin, google_calendar_event_id, cliente_nombre_externo, cliente:cliente_id(nombre)')
                .not('fecha_inicio', 'is', null)
                .is('google_calendar_event_id', null)
                .not('estatus', 'in', '("Terminado","Entregado")');

            if (!fetchError && proyectosSinSync?.length) {
                const endpoint = `${API_BASE}/api/calendar/sync-project`;
                for (const proyecto of proyectosSinSync) {
                    try {
                        const payload = {
                            id: proyecto.id,
                            folio: proyecto.folio,
                            descripcion: proyecto.descripcion || proyecto.cliente?.nombre || proyecto.cliente_nombre_externo || 'Sin descripción',
                            fecha_inicio: proyecto.fecha_inicio?.split?.('T')[0] ?? proyecto.fecha_inicio,
                            fecha_fin: proyecto.fecha_fin?.split?.('T')[0] ?? proyecto.fecha_fin,
                            google_calendar_event_id: null,
                        };
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                        });
                        const text = await res.text();
                        if (res.ok) {
                            const data = JSON.parse(text);
                            const eventId = data?.google_calendar_event_id ?? data?.eventId ?? null;
                            if (eventId) {
                                await supabase.from('proyectos').update({ google_calendar_event_id: eventId }).eq('id', proyecto.id);
                                creados++;
                            }
                        }
                    } catch (_) {
                        // Continuar con el siguiente
                    }
                }
            }

            toast({
                title: '¡Listo!',
                description: `Se sincronizaron ${creados} proyecto(s) y se limpiaron ${eliminados} terminado(s).`,
            });
            fetchProyectos();
        } catch (err) {
            console.error('Error sincronización masiva:', err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo completar la sincronización con el calendario.' });
        } finally {
            setSyncAllLoading(false);
        }
    };

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
                            variant="outline"
                            onClick={syncAllToCalendar}
                            disabled={syncAllLoading}
                            className="gap-2"
                            title="Sincronizar proyectos con fechas (sin evento en Google) al calendario"
                        >
                            {syncAllLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarCheck className="w-4 h-4" />}
                            Sincronizar con Google Calendar
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

                <div className="bg-white rounded-xl border shadow-sm min-h-[300px] overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="w-12 h-12 animate-spin text-blue-600" /></div>
                    ) : (
                        <ProyectosList 
                            proyectos={sortedAndFilteredProyectos} 
                            onDeleteRequest={handleDeleteRequest}
                            onSort={handleSort}
                            sortConfig={sortConfig}
                        />
                    )}
                </div>
            </div>

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