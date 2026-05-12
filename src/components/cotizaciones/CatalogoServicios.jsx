
import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Loader2, 
  ArrowUpDown 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CatalogoUnidades from './CatalogoUnidades';

const CatalogoServicios = () => {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'descripcion', direction: 'asc' });

  // Dialog & Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentService, setCurrentService] = useState(null); // null = creating new
  const [formData, setFormData] = useState({
    codigo: '',
    descripcion: '',
    unidad: '',
    precio_unitario: ''
  });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicesRes, unitsRes] = await Promise.all([
        supabase.from('catalogo_servicios').select('*').order('created_at', { ascending: false }),
        supabase.from('catalogo_unidades').select('*').order('nombre')
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (unitsRes.error) throw unitsRes.error;

      setServices(servicesRes.data || []);
      setUnidades(unitsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sort Handler
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter & Sort Logic
  const filteredServices = React.useMemo(() => {
    let processed = [...services];

    // Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      processed = processed.filter(s => 
        s.descripcion.toLowerCase().includes(lowerTerm) ||
        (s.codigo && s.codigo.toLowerCase().includes(lowerTerm)) ||
        (s.unidad && s.unidad.toLowerCase().includes(lowerTerm))
      );
    }

    // Sort
    if (sortConfig.key) {
      processed.sort((a, b) => {
        const valA = a[sortConfig.key] || '';
        const valB = b[sortConfig.key] || '';
        
        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return processed;
  }, [services, searchTerm, sortConfig]);

  // CRUD Handlers
  const handleAddNew = () => {
    setCurrentService(null);
    setFormData({ codigo: '', descripcion: '', unidad: '', precio_unitario: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (service) => {
    setCurrentService(service);
    setFormData({
      codigo: service.codigo || '',
      descripcion: service.descripcion,
      unidad: service.unidad,
      precio_unitario: service.precio_unitario
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este servicio del catálogo?')) return;

    try {
      const { error } = await supabase
        .from('catalogo_servicios')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setServices(prev => prev.filter(s => s.id !== id));
      toast({ title: 'Servicio eliminado', description: 'El servicio ha sido removido del catálogo.' });
    } catch (error) {
      console.error('Error deleting service:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el servicio.' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    if (!formData.descripcion || !formData.precio_unitario || !formData.codigo) {
        toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Código, Descripción y precio son obligatorios.' });
        setIsSaving(false);
        return;
    }

    const payload = {
        codigo: formData.codigo,
        descripcion: formData.descripcion,
        unidad: formData.unidad,
        precio_unitario: parseFloat(formData.precio_unitario)
    };

    try {
      if (currentService) {
        // Update
        const { data, error } = await supabase
          .from('catalogo_servicios')
          .update(payload)
          .eq('id', currentService.id)
          .select()
          .single();

        if (error) throw error;

        setServices(prev => prev.map(s => s.id === currentService.id ? data : s));
        toast({ title: 'Servicio actualizado', description: 'Los cambios se han guardado correctamente.' });

      } else {
        // Create
        // Check if code exists
        const exists = services.some(s => s.codigo === formData.codigo);
        if(exists) {
            toast({ variant: 'destructive', title: 'Código duplicado', description: 'El código ingresado ya existe.' });
            setIsSaving(false);
            return;
        }

        const { data, error } = await supabase
          .from('catalogo_servicios')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        setServices(prev => [data, ...prev]);
        toast({ title: 'Servicio creado', description: 'El nuevo servicio se ha agregado al catálogo.' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving service:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Ocurrió un error al guardar el servicio.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Tabs defaultValue="servicios" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="servicios">Listado de Servicios</TabsTrigger>
        <TabsTrigger value="unidades">Configuración de Unidades</TabsTrigger>
      </TabsList>

      <TabsContent value="servicios" className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
            <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input 
                placeholder="Buscar por código, descripción..." 
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>
            <Button onClick={handleAddNew} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Servicio
            </Button>
        </div>

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
            {loading ? (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            ) : (
            <Table>
                <TableHeader>
                <TableRow className="bg-gray-50">
                    <TableHead className="cursor-pointer hover:text-blue-600 transition-colors w-[120px]" onClick={() => handleSort('codigo')}>
                        <div className="flex items-center gap-2">
                            Código {sortConfig.key === 'codigo' && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-blue-600 transition-colors" onClick={() => handleSort('descripcion')}>
                        <div className="flex items-center gap-2">
                            Descripción {sortConfig.key === 'descripcion' && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-blue-600 transition-colors w-[150px]" onClick={() => handleSort('unidad')}>
                        <div className="flex items-center gap-2">
                            Unidad {sortConfig.key === 'unidad' && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                    </TableHead>
                    <TableHead className="text-right cursor-pointer hover:text-blue-600 transition-colors w-[150px]" onClick={() => handleSort('precio_unitario')}>
                        <div className="flex items-center justify-end gap-2">
                            Precio Unitario {sortConfig.key === 'precio_unitario' && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                    </TableHead>
                    <TableHead className="w-[100px] text-right">Acciones</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {filteredServices.length > 0 ? (
                    filteredServices.map((service) => (
                    <TableRow key={service.id} className="hover:bg-gray-50">
                        <TableCell className="font-mono text-sm font-medium text-gray-600">{service.codigo || '-'}</TableCell>
                        <TableCell className="font-medium">{service.descripcion}</TableCell>
                        <TableCell>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {service.unidad}
                            </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                        ${service.precio_unitario?.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(service)} className="h-8 w-8 text-gray-500 hover:text-blue-600">
                            <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(service.id)} className="h-8 w-8 text-gray-500 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-gray-500">
                        No se encontraron servicios.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            )}
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent>
            <DialogHeader>
                <DialogTitle>{currentService ? 'Editar Servicio' : 'Nuevo Servicio'}</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSave} className="space-y-4 py-4">
                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-1">
                        <Label htmlFor="codigo">Código <span className="text-red-500">*</span></Label>
                        <Input 
                            id="codigo"
                            value={formData.codigo}
                            onChange={(e) => setFormData({...formData, codigo: e.target.value})}
                            placeholder="Ej. SERV-001"
                            required
                        />
                    </div>
                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="descripcion">Descripción <span className="text-red-500">*</span></Label>
                        <Input 
                            id="descripcion"
                            value={formData.descripcion}
                            onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                            placeholder="Ej. Mano de obra soldador"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="unidad">Unidad</Label>
                        <Select 
                            value={formData.unidad} 
                            onValueChange={(v) => setFormData({...formData, unidad: v})}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona unidad" />
                            </SelectTrigger>
                            <SelectContent>
                                {unidades.map((u) => (
                                    <SelectItem key={u.id} value={u.abreviatura}>
                                        {u.nombre} ({u.abreviatura})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div className="space-y-2">
                        <Label htmlFor="precio">Precio Unitario <span className="text-red-500">*</span></Label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <Input 
                                id="precio"
                                type="number"
                                step="0.01"
                                className="pl-7"
                                value={formData.precio_unitario}
                                onChange={(e) => setFormData({...formData, precio_unitario: e.target.value})}
                                placeholder="0.00"
                                required
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                        {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {currentService ? 'Guardar Cambios' : 'Crear Servicio'}
                    </Button>
                </DialogFooter>
            </form>
            </DialogContent>
        </Dialog>
      </TabsContent>

      <TabsContent value="unidades">
        <CatalogoUnidades />
      </TabsContent>
    </Tabs>
  );
};

export default CatalogoServicios;
