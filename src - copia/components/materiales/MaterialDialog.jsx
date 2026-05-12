import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, PlusCircle, Trash2, Star, Cuboid, ToyBrick, Building2 } from 'lucide-react';
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';


const MaterialDialog = ({ open, onOpenChange, onSave, material }) => {
  const { toast } = useToast();
  const isEditing = !!material?.id;
  
  const getInitialFormData = () => ({
    descripcion: '',
    unidad_compra: '',
    existencias: 0,
    stock_min: 0,
    stock_max: 0,
    categoria: 'Materiales', // Default to 'Materiales'
    unidades: [{ id: `new_${Date.now()}`, nombre_unidad: '', factor_conversion: 1, es_principal: true }]
  });

  const [formData, setFormData] = useState(getInitialFormData());

  useEffect(() => {
    if (open) {
      if (material && material.id) {
        setFormData({
            ...material,
            categoria: material.categoria || 'Materiales', // Ensure categoria defaults if not set
            unidades: material.unidades && material.unidades.length > 0 ? material.unidades : getInitialFormData().unidades
        });
      } else {
        setFormData(getInitialFormData());
      }
    }
  }, [material, open]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCategoryChange = (value) => {
      setFormData(prev => ({ ...prev, categoria: value }));
  };
  
  const handleUnitChange = (index, field, value) => {
    const newUnidades = [...formData.unidades];
    newUnidades[index][field] = value;
    setFormData(prev => ({ ...prev, unidades: newUnidades }));
  };

  const handlePrincipalChange = (index) => {
      const newUnidades = formData.unidades.map((unidad, i) => ({
          ...unidad,
          es_principal: i === index
      }));
      setFormData(prev => ({...prev, unidades: newUnidades}));
  };

  const addUnit = () => {
      const newUnit = { 
          id: `new_${Date.now()}`,
          nombre_unidad: '', 
          factor_conversion: 1, 
          es_principal: formData.unidades.length === 0
      };
      setFormData(prev => ({...prev, unidades: [...prev.unidades, newUnit]}));
  };

  const removeUnit = (index) => {
      if (formData.unidades.length <= 1) {
          toast({ variant: 'destructive', title: 'Error', description: 'Debe haber al menos una unidad de venta.' });
          return;
      }
      let newUnidades = formData.unidades.filter((_, i) => i !== index);
      // If the removed unit was the principal one, make the first one principal
      if (!newUnidades.some(u => u.es_principal) && newUnidades.length > 0) {
          newUnidades[0].es_principal = true;
      }
      setFormData(prev => ({...prev, unidades: newUnidades}));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.unidades.length === 0 || !formData.unidades.some(u => u.nombre_unidad.trim() !== '')) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debe definir al menos una unidad de venta.' });
        return;
    }
    if (!formData.unidades.some(u => u.es_principal)) {
        toast({ variant: 'destructive', title: 'Error', description: 'Debe marcar una unidad de venta como principal.' });
        return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar Material: ${material.id}` : 'Nuevo Material'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-4">
          
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Categoría del Material</h3>
            <Tabs value={formData.categoria} onValueChange={handleCategoryChange} className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="Materiales" className="gap-2"><Package className="w-4 h-4"/>Materiales</TabsTrigger>
                    <TabsTrigger value="Consumibles" className="gap-2"><ToyBrick className="w-4 h-4" />Consumibles</TabsTrigger>
                    <TabsTrigger value="Activos" className="gap-2"><Cuboid className="w-4 h-4"/>Activos</TabsTrigger>
                    <TabsTrigger value="Edificio" className="gap-2"><Building2 className="w-4 h-4"/>Edificio</TabsTrigger>
                </TabsList>
            </Tabs>
            <p className="text-xs text-center text-gray-500 mt-2">Asigna la categoría correcta para organizar el inventario.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Input id="descripcion" name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Ej. Placa de Acero 1/4" required/>
            </div>
            <div>
                <Label htmlFor="unidad_compra">Unidad de Compra</Label>
                <Input id="unidad_compra" name="unidad_compra" value={formData.unidad_compra} onChange={handleChange} placeholder="Ej. Placa, Caja" required />
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-lg border">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Package className="w-4 h-4 text-blue-600"/>Unidades de Venta / Uso</h3>
                <Button type="button" size="sm" variant="outline" onClick={addUnit} className="gap-1"><PlusCircle className="w-3 h-3"/>Añadir</Button>
             </div>
             <div className="space-y-3">
                 {formData.unidades.map((unit, index) => (
                    <div key={unit.id || index} className="grid grid-cols-12 gap-x-3 items-center">
                        <div className="col-span-5">
                            <Label>Nombre Unidad</Label>
                            <Input value={unit.nombre_unidad} onChange={e => handleUnitChange(index, 'nombre_unidad', e.target.value)} placeholder="Ej. pza, kg" required />
                        </div>
                        <div className="col-span-5">
                            <Label>Factor ({formData.unidad_compra || 'U. Compra'} a esta unidad)</Label>
                            <Input type="number" value={unit.factor_conversion} onChange={e => handleUnitChange(index, 'factor_conversion', parseFloat(e.target.value) || 0)} step="any" required />
                        </div>
                        <div className="col-span-1 flex flex-col items-center justify-end h-full pt-5">
                           <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrincipalChange(index)}>
                                <Star className={cn("w-4 h-4", unit.es_principal ? "text-yellow-400 fill-current" : "text-gray-400")}/>
                           </Button>
                        </div>
                         <div className="col-span-1 flex flex-col items-center justify-end h-full pt-5">
                           <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => removeUnit(index)}>
                                <Trash2 className="w-4 h-4"/>
                           </Button>
                        </div>
                    </div>
                 ))}
             </div>
             <p className="text-xs text-center text-gray-500 mt-3">Marca una unidad con la estrella <Star className="w-3 h-3 inline-block text-yellow-400"/> como la principal para mostrar el stock.</p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border">
             <h3 className="text-sm font-semibold text-gray-800 mb-4">Control de Stock (en Unidad Principal)</h3>
             <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label htmlFor="existencias">Existencias Iniciales</Label>
                    <Input id="existencias" name="existencias" type="number" value={formData.existencias} onChange={handleChange} disabled={isEditing} />
                </div>
                <div>
                    <Label htmlFor="stock_min">Stock Mínimo</Label>
                    <Input id="stock_min" name="stock_min" type="number" value={formData.stock_min} onChange={handleChange} />
                </div>
                <div>
                    <Label htmlFor="stock_max">Stock Máximo</Label>
                    <Input id="stock_max" name="stock_max" type="number" value={formData.stock_max} onChange={handleChange} />
                </div>
             </div>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Guardar Material</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialDialog;