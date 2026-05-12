
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
  Plus, 
  Edit, 
  Trash2, 
  Loader2 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

const CatalogoUnidades = () => {
  const { toast } = useToast();
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentUnit, setCurrentUnit] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', abreviatura: '' });

  const fetchUnidades = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalogo_unidades')
        .select('*')
        .order('nombre');
      
      if (error) throw error;
      setUnidades(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las unidades.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnidades();
  }, []);

  const handleAddNew = () => {
    setCurrentUnit(null);
    setFormData({ nombre: '', abreviatura: '' });
    setIsDialogOpen(true);
  };

  const handleEdit = (unit) => {
    setCurrentUnit(unit);
    setFormData({ nombre: unit.nombre, abreviatura: unit.abreviatura });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar esta unidad?')) return;

    try {
      const { error } = await supabase.from('catalogo_unidades').delete().eq('id', id);
      if (error) throw error;
      setUnidades(prev => prev.filter(u => u.id !== id));
      toast({ title: 'Unidad eliminada' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar la unidad.' });
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    if (!formData.nombre || !formData.abreviatura) {
        toast({ variant: 'destructive', title: 'Campos requeridos', description: 'Nombre y abreviatura son obligatorios.' });
        setIsSaving(false);
        return;
    }

    try {
      if (currentUnit) {
        const { data, error } = await supabase
          .from('catalogo_unidades')
          .update({ nombre: formData.nombre, abreviatura: formData.abreviatura })
          .eq('id', currentUnit.id)
          .select()
          .single();
        if (error) throw error;
        setUnidades(prev => prev.map(u => u.id === currentUnit.id ? data : u));
        toast({ title: 'Unidad actualizada' });
      } else {
        const { data, error } = await supabase
          .from('catalogo_unidades')
          .insert([{ nombre: formData.nombre, abreviatura: formData.abreviatura }])
          .select()
          .single();
        if (error) throw error;
        setUnidades(prev => [...prev, data]);
        toast({ title: 'Unidad creada' });
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Error al guardar la unidad.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddNew} className="bg-blue-600 hover:bg-blue-700 text-sm">
          <Plus className="w-4 h-4 mr-2" /> Nueva Unidad
        </Button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        {loading ? (
           <div className="flex justify-center items-center h-32"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Nombre</TableHead>
                <TableHead>Abreviatura</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unidades.length > 0 ? (
                unidades.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.nombre}</TableCell>
                    <TableCell><span className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{unit.abreviatura}</span></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(unit)} className="h-8 w-8 text-gray-500 hover:text-blue-600">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(unit.id)} className="h-8 w-8 text-gray-500 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-gray-500">No hay unidades registradas.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentUnit ? 'Editar Unidad' : 'Nueva Unidad'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="nombre">Nombre de la Unidad</Label>
                <Input id="nombre" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} placeholder="Ej. Pieza, Metro Lineal, Caja" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="abreviatura">Abreviatura</Label>
                <Input id="abreviatura" value={formData.abreviatura} onChange={(e) => setFormData({...formData, abreviatura: e.target.value})} placeholder="Ej. pza, m, cja" required />
            </div>
            <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {currentUnit ? 'Guardar' : 'Crear'}
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogoUnidades;
