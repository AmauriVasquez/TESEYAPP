import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { PlusCircle, Search, Edit, Loader2, Cuboid, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import ActivoDialog from '@/components/activos/ActivoDialog';
import CategoriaActivoDialog from '@/components/activos/CategoriaActivoDialog';
import { supabase } from '@/lib/customSupabaseClient';
import { fetchActivosListCompat } from '@/lib/supabaseActivosCompat';
import { cn } from '@/lib/utils';
import { formatDateTable } from '@/lib/dateUtils';

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  disponible: 'Disponible',
  en_uso: 'En uso',
  en_mantenimiento: 'En mantenimiento',
  en_reparacion: 'En reparación',
  dado_de_baja: 'Dado de baja',
};

const estadoBadgeClass = (estado) => {
  switch (estado) {
    case 'pendiente':
      return 'bg-slate-100 text-slate-800';
    case 'disponible':
      return 'bg-sky-100 text-sky-900';
    case 'en_uso':
      return 'bg-green-100 text-green-800';
    case 'en_mantenimiento':
      return 'bg-amber-100 text-amber-900';
    case 'en_reparacion':
      return 'bg-orange-100 text-orange-900';
    case 'dado_de_baja':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-blue-100 text-blue-800';
  }
};

const formatMoney = (n) => {
  const v = Number(n);
  if (Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
};

const Activos = () => {
  const navigate = useNavigate();
  const [activos, setActivos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCat, setSearchCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);
  const [activeTab, setActiveTab] = useState('activos');
  const [activoDialogOpen, setActivoDialogOpen] = useState(false);
  const [categoriaDialogOpen, setCategoriaDialogOpen] = useState(false);
  const [selectedActivo, setSelectedActivo] = useState(null);
  const [selectedCategoria, setSelectedCategoria] = useState(null);
  const [mostrarActivosOcultos, setMostrarActivosOcultos] = useState(false);
  const { toast } = useToast();

  const categoriasActivas = useMemo(
    () => categorias.filter((c) => !c.eliminado),
    [categorias]
  );

  const fetchCategorias = useCallback(async () => {
    setLoadingCats(true);
    const { data, error } = await supabase
      .from('categorias_activos')
      .select('id, nombre, descripcion, eliminado')
      .order('nombre', { ascending: true });

    if (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las categorías de activos.',
      });
      setCategorias([]);
    } else {
      console.log('categorias:', data);
      setCategorias(data ?? []);
    }
    setLoadingCats(false);
  }, [toast]);

  const fetchActivos = useCallback(async () => {
    setLoading(true);
    const { data, error, mode } = await fetchActivosListCompat(supabase, {
      onlyVisible: !mostrarActivosOcultos,
    });
    if (mode === 'failed' || error) {
      console.error('[DEBUG activos] fetchActivos:', error?.message, error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message ?? 'No se pudieron cargar los activos.',
      });
      setActivos([]);
    } else {
      console.log('activos:', data);
      setActivos(data ?? []);
    }
    setLoading(false);
  }, [toast, mostrarActivosOcultos]);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  useEffect(() => {
    fetchActivos();
  }, [fetchActivos]);

  const searchedActivos = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return activos;
    return activos.filter((a) => {
      const nom = (a.nombre ?? '').toLowerCase();
      const cat = (a.categoria?.nombre ?? '').toLowerCase();
      const est = (ESTADO_LABELS[a.estado] ?? a.estado ?? '').toLowerCase();
      return nom.includes(term) || cat.includes(term) || est.includes(term);
    });
  }, [activos, searchTerm]);

  const searchedCategorias = useMemo(() => {
    const term = searchCat.toLowerCase().trim();
    if (!term) return categorias;
    return categorias.filter((c) => {
      const nom = (c.nombre ?? '').toLowerCase();
      const desc = (c.descripcion ?? '').toLowerCase();
      return nom.includes(term) || desc.includes(term);
    });
  }, [categorias, searchCat]);

  const handleNuevoActivo = () => {
    if (categoriasActivas.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Sin categorías',
        description: 'Crea al menos una categoría en la pestaña «Categorías» antes de registrar un activo.',
      });
      return;
    }
    setSelectedActivo(null);
    setActivoDialogOpen(true);
  };

  const handleEditActivo = (row) => {
    setSelectedActivo(row);
    setActivoDialogOpen(true);
  };

  const handleSaveActivo = async (payload) => {
    const body = {
      nombre: payload.nombre,
      categoria_id: payload.categoria_id,
      descripcion: payload.descripcion || null,
      costo_compra: payload.costo_compra,
      fecha_adquisicion: payload.fecha_adquisicion,
      requiere_responsiva: payload.requiere_responsiva,
      requiere_mantenimiento: payload.requiere_mantenimiento,
      estado: payload.estado ?? 'pendiente',
      detalle_cambio_estado: payload.detalle_cambio_estado ?? null,
    };

    if (selectedActivo?.id) {
      const { error } = await supabase
        .from('activos')
        .update({ ...body, eliminado: payload.eliminado === true })
        .eq('id', selectedActivo.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Activo actualizado' });
    } else {
      const { error } = await supabase.from('activos').insert(body);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Activo creado' });
    }
    setActivoDialogOpen(false);
    setSelectedActivo(null);
    fetchActivos();
  };

  const handleNuevaCategoria = () => {
    setSelectedCategoria(null);
    setCategoriaDialogOpen(true);
  };

  const handleEditCategoria = (row) => {
    setSelectedCategoria(row);
    setCategoriaDialogOpen(true);
  };

  const handleSaveCategoria = async (payload) => {
    if (selectedCategoria?.id) {
      const { error } = await supabase
        .from('categorias_activos')
        .update({
          nombre: payload.nombre,
          descripcion: payload.descripcion || null,
          eliminado: payload.eliminado,
        })
        .eq('id', selectedCategoria.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Categoría actualizada' });
    } else {
      const { error } = await supabase.from('categorias_activos').insert({
        nombre: payload.nombre,
        descripcion: payload.descripcion || null,
        eliminado: false,
      });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return;
      }
      toast({ title: 'Categoría creada' });
    }
    setCategoriaDialogOpen(false);
    setSelectedCategoria(null);
    fetchCategorias();
    fetchActivos();
  };

  return (
    <>
      <Helmet>
        <title>Activos - IIHEMSA Peninsular</title>
        <meta name="description" content="Control de activos fijos y categorías." />
      </Helmet>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Activos</h1>
            <p className="text-gray-600 mt-1">
              Registro de activos fijos, costos y estado operativo. Sin eliminación física de registros.
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="activos" className="gap-2">
              <Cuboid className="w-4 h-4" />
              Activos
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-2">
              <FolderTree className="w-4 h-4" />
              Categorías
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activos">
            <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, categoría o estado..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <Checkbox
                    checked={mostrarActivosOcultos}
                    onCheckedChange={(v) => setMostrarActivosOcultos(v === true)}
                  />
                  Mostrar ocultos (baja lógica)
                </label>
                <Button onClick={handleNuevoActivo} className="gap-2 shrink-0">
                  <PlusCircle className="w-4 h-4" />
                  Nuevo Activo
                </Button>
              </div>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha adquisición</TableHead>
                        <TableHead className="text-right">Costo compra</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchedActivos.map((row) => (
                        <TableRow
                          key={row.id}
                          className={cn(
                            row.eliminado ? 'opacity-60' : '',
                            'cursor-pointer hover:bg-gray-50/80'
                          )}
                          onClick={() => navigate(`/activos/${row.id}`)}
                        >
                          <TableCell className="font-medium">{row.nombre}</TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'text-xs font-semibold px-2 py-1 rounded-full inline-flex w-fit',
                                'bg-indigo-100 text-indigo-800'
                              )}
                            >
                              {row.categoria?.nombre ?? 'Sin categoría'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'text-xs font-semibold px-2 py-1 rounded-full inline-flex w-fit',
                                estadoBadgeClass(row.estado)
                              )}
                            >
                              {ESTADO_LABELS[row.estado] ?? row.estado}
                            </span>
                          </TableCell>
                          <TableCell>{formatDateTable(row.fecha_adquisicion)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(row.costo_compra)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditActivo(row);
                              }}
                              title="Edición rápida"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {!loading && searchedActivos.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-gray-500">No hay activos que coincidan con la búsqueda.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="categorias">
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-4">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar categoría..."
                  className="pl-10"
                  value={searchCat}
                  onChange={(e) => setSearchCat(e.target.value)}
                />
              </div>
              <Button onClick={handleNuevaCategoria} className="gap-2 shrink-0">
                <PlusCircle className="w-4 h-4" />
                Nueva categoría
              </Button>
            </div>
            <div className="bg-white p-6 rounded-xl border shadow-sm">
              <div className="overflow-x-auto">
                {loadingCats ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead>En catálogo</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchedCategorias.map((row) => (
                        <TableRow key={row.id} className={row.eliminado ? 'opacity-60' : ''}>
                          <TableCell className="font-medium">{row.nombre}</TableCell>
                          <TableCell className="text-gray-600 max-w-md truncate">
                            {row.descripcion || '—'}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                'text-xs font-semibold px-2 py-1 rounded-full inline-flex w-fit',
                                row.eliminado ? 'bg-gray-200 text-gray-700' : 'bg-green-100 text-green-800'
                              )}
                            >
                              {row.eliminado ? 'No' : 'Sí'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditCategoria(row)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4 text-gray-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                {!loadingCats && searchedCategorias.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-gray-500">No hay categorías registradas.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      <ActivoDialog
        open={activoDialogOpen}
        onOpenChange={setActivoDialogOpen}
        onSave={handleSaveActivo}
        activo={selectedActivo}
        categoriasActivas={categoriasActivas}
      />
      <CategoriaActivoDialog
        open={categoriaDialogOpen}
        onOpenChange={setCategoriaDialogOpen}
        onSave={handleSaveCategoria}
        categoria={selectedCategoria}
      />
    </>
  );
};

export default Activos;
