import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Copy, CheckCircle, XCircle, MoreVertical, Edit, Trash2, Loader2, ArrowRight, User, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CotizacionDialog from '@/components/cotizaciones/CotizacionDialog';
import SeleccionarFormatoCotizacionDialog from '@/components/cotizaciones/SeleccionarFormatoCotizacionDialog';
import CatalogoServicios from '@/components/cotizaciones/CatalogoServicios';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';

const EstatusBadge = ({ estatus }) => {
  const baseClasses = 'px-3 py-1 text-xs font-medium rounded-full inline-block';
  const styles = {
    Borrador: 'bg-gray-100 text-gray-800',
    Enviada: 'bg-blue-100 text-blue-800',
    Aprobada: 'bg-green-100 text-green-800',
    Rechazada: 'bg-red-100 text-red-800',
  };
  return <span className={`${baseClasses} ${styles[estatus]}`}>{estatus}</span>;
};

const Cotizaciones = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog States
  const [dialogOpen, setDialogOpen] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  
  const [selectedCotizacion, setSelectedCotizacion] = useState(null);

  const fetchCotizaciones = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('cotizaciones').select('*, cliente:cliente_id(nombre)').order('id', { ascending: false });

    if (filterStatus !== 'Todos') {
        query = query.eq('estatus', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las cotizaciones.' });
        console.error(error);
    } else {
        const formattedData = data.map(c => ({
            ...c,
            cliente_nombre: c.cliente?.nombre || c.cliente_nombre_externo
        }));
        setCotizaciones(formattedData);
    }
    setLoading(false);
  }, [toast, filterStatus]);

  useEffect(() => {
    fetchCotizaciones();
  }, [fetchCotizaciones]);

  const handleCreateProjectFromQuote = async (cotizacionAprobada) => {
    // 1. Get next project folio
    const { data: lastProject, error: fetchError } = await supabase
      .from('proyectos')
      .select('folio')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if(fetchError && fetchError.code !== 'PGRST116') {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo generar el folio del proyecto.' });
        return null;
    }

    const nextFolioNumber = lastProject ? parseInt(lastProject.folio.split('-')[2]) + 1 : 1;
    const currentYear = new Date().getFullYear();
    const newFolio = `PRJ-${currentYear}-${String(nextFolioNumber).padStart(4, '0')}`;
    
    // 2. Create project
    const { data: newProject, error: createError } = await supabase.from('proyectos').insert({
        folio: newFolio,
        cotizacion_id: cotizacionAprobada.id,
        cotizacion_folio: cotizacionAprobada.folio,
        cliente_id: cotizacionAprobada.cliente_id,
        cliente_nombre_externo: cotizacionAprobada.cliente_nombre_externo,
        descripcion: cotizacionAprobada.descripcion,
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0], // Default 30 days
        estatus: 'Por Iniciar',
        fase: 'Planeación',
        avance: 0,
        prioridad: 'Media',
    }).select().single();

    if(createError){
        toast({ variant: 'destructive', title: 'Error al crear proyecto', description: createError.message });
        return null;
    }

    return newProject;
  };

  const handleStatusChange = async (id, estatus) => {
    const { error } = await supabase.from('cotizaciones').update({ estatus }).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el estatus.' });
    } else {
      toast({ title: `✅ Estatus Actualizado`, description: `La cotización ahora está ${estatus}.` });
      if (estatus === 'Aprobada') {
        const cotizacionAprobada = cotizaciones.find(c => c.id === id);
        const nuevoProyecto = await handleCreateProjectFromQuote(cotizacionAprobada);
        if (nuevoProyecto) {
            toast({
                title: '🎉 ¡Proyecto Creado!',
                description: `El proyecto ${nuevoProyecto.folio} se ha creado desde la cotización.`,
                action: <Button variant="outline" size="sm" onClick={() => navigate(`/proyectos/${nuevoProyecto.id}`)}>Ver Proyecto <ArrowRight className="w-4 h-4 ml-2"/></Button>
            });
        }
      }
      await fetchCotizaciones();
    }
  };

  const handleEdit = (cotizacion) => {
    setSelectedCotizacion(cotizacion);
    setDialogOpen(true);
  };

  const handlePrint = (cotizacion) => {
    setSelectedCotizacion(cotizacion);
    setPrintDialogOpen(true);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from('cotizaciones').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la cotización.' });
    } else {
      await fetchCotizaciones();
      toast({ title: '🗑️ Cotización Eliminada' });
    }
  };

  const filteredCotizaciones = cotizaciones.filter(c => {
    const searchLower = searchTerm.toLowerCase();
    return (c.folio?.toLowerCase().includes(searchLower) ||
            c.cliente_nombre?.toLowerCase().includes(searchLower) ||
            c.cotizacion_control?.toLowerCase().includes(searchLower) ||
            c.descripcion?.toLowerCase().includes(searchLower) ||
            c.usuario_cotizacion?.toLowerCase().includes(searchLower));
  });

  return (
    <>
      <Helmet>
        <title>Cotizaciones - Sistema TESEY</title>
        <meta name="description" content="Gestión de cotizaciones y propuestas comerciales" />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cotizaciones</h2>
            <p className="text-gray-600 mt-1">Crea y gestiona tus propuestas comerciales</p>
          </div>
        </div>
        
        <Tabs defaultValue="cotizaciones" className="w-full">
            <TabsList className="w-full md:w-auto grid w-full grid-cols-2 md:inline-flex">
                <TabsTrigger value="cotizaciones">Cotizaciones</TabsTrigger>
                <TabsTrigger value="catalogo">Catálogo de Servicios</TabsTrigger>
            </TabsList>

            <TabsContent value="cotizaciones" className="space-y-6 mt-6">
                <div className="flex justify-end">
                    <Button
                        onClick={() => {
                        setSelectedCotizacion(null);
                        setDialogOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Cotización
                    </Button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Buscar por folio, cliente, usuario o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2"
                      />
                    </div>
                    <div className="relative">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full sm:w-auto gap-2">
                            <Filter className="w-4 h-4" />
                            {filterStatus}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {['Todos', 'Borrador', 'Enviada', 'Aprobada', 'Rechazada'].map(status => (
                            <DropdownMenuItem key={status} onSelect={() => setFilterStatus(status)}>
                              {status}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                    ) : (
                        <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Folio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Descripción</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredCotizaciones.length > 0 ? filteredCotizaciones.map((c, index) => (
                            <motion.tr
                                key={c.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="hover:bg-gray-50 transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <p className="font-mono text-sm text-blue-600">{c.folio}</p>
                                    {c.cotizacion_control && <p className="text-xs text-gray-500 font-mono">Control: {c.cotizacion_control}</p>}
                                </td>
                                <td className="px-6 py-4">
                                <p className="font-medium text-gray-900">{c.cliente_nombre}</p>
                                <p className="text-sm text-gray-500">{c.descripcion}</p>
                                {c.usuario_cotizacion && (
                                    <div className="flex items-center mt-1 text-xs text-gray-500">
                                        <User className="w-3 h-3 mr-1.5" />
                                        <span>{c.usuario_cotizacion}</span>
                                    </div>
                                )}
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-600">{format(new Date(c.fecha + 'T00:00:00'), 'dd/MMM/yyyy')}</td>
                                <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                                {c.total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                                </td>
                                <td className="px-6 py-4"><EstatusBadge estatus={c.estatus} /></td>
                                <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-2">
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => handlePrint(c)}>
                                        <Printer className="mr-2 h-4 w-4 text-amber-600" /> Imprimir
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleStatusChange(c.id, 'Aprobada')} disabled={c.estatus === 'Aprobada'}>
                                        <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> Aprobar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleStatusChange(c.id, 'Rechazada')} disabled={c.estatus === 'Rechazada'}>
                                        <XCircle className="mr-2 h-4 w-4 text-red-500" /> Rechazar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleEdit(c)}>
                                        <Edit className="mr-2 h-4 w-4" /> Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => handleDelete(c.id)} className="text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                </td>
                            </motion.tr>
                            )) : (
                                <tr>
                                    <td colSpan="6" className="text-center py-16 text-gray-500">
                                        <h3 className="text-lg font-medium">No hay cotizaciones aún</h3>
                                        <p className="text-sm mt-1">Crea tu primera cotización para empezar.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        </table>
                    )}
                  </div>
                </div>
            </TabsContent>
            
            <TabsContent value="catalogo" className="mt-6">
                <CatalogoServicios />
            </TabsContent>
        </Tabs>
      </div>

      <CotizacionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cotizacion={selectedCotizacion}
        onSave={() => {
            fetchCotizaciones();
            setDialogOpen(false);
        }}
      />
      
      <SeleccionarFormatoCotizacionDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        cotizacion={selectedCotizacion}
      />
    </>
  );
};

export default Cotizaciones;