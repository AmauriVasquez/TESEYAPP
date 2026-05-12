import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

const AgregarMaterialDialog = ({ open, onOpenChange, onAddMaterial, disabled = false }) => {
  const { toast } = useToast();
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [comentario, setComentario] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [catalogoMateriales, setCatalogoMateriales] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMateriales = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('materiales').select('id, descripcion, unidad_venta, existencias');
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el catálogo de materiales.' });
    } else {
        setCatalogoMateriales(data);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (open) {
        fetchMateriales();
    }
  }, [open, fetchMateriales]);

  useEffect(() => {
    if (selectedMaterialId) {
      const material = catalogoMateriales.find(m => m.id === parseInt(selectedMaterialId));
      setSelectedMaterial(material);
    } else {
      setSelectedMaterial(null);
    }
  }, [selectedMaterialId, catalogoMateriales]);
  
  useEffect(() => {
    // Reset state when dialog opens/closes
    if (!open) {
        setSelectedMaterialId('');
        setCantidad('');
        setComentario('');
        setSelectedMaterial(null);
    }
  }, [open]);

  const handleAgregar = () => {
    if (disabled) return;
    if (!selectedMaterial || !cantidad || parseInt(cantidad) <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error de validación',
        description: 'Debes seleccionar un material y especificar una cantidad válida mayor a cero.',
      });
      return;
    }

    const nuevoMaterial = {
      id: selectedMaterial.id,
      descripcion: selectedMaterial.descripcion,
      cant: parseInt(cantidad),
      comentario: comentario,
    };
    
    onAddMaterial(nuevoMaterial);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar Material al Proyecto</DialogTitle>
        </DialogHeader>
        {loading ? <div className="flex justify-center items-center h-48"><Loader2 className="w-8 h-8 animate-spin"/></div> : (
        <>
        <div className="grid gap-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="material-select">Material</Label>
            <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId} disabled={disabled}>
              <SelectTrigger id="material-select">
                <SelectValue placeholder="Busca y selecciona un material..." />
              </SelectTrigger>
              <SelectContent>
                {catalogoMateriales.map(material => (
                  <SelectItem key={material.id} value={material.id.toString()}>
                    {material.descripcion} <span className="text-xs text-gray-500 ml-2">(Stock: {material.existencias})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cantidad">Cantidad Requerida</Label>
              <Input
                id="cantidad"
                type="number"
                value={cantidad}
                onChange={e => setCantidad(e.target.value)}
                placeholder="Ej. 10"
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad</Label>
              <Input
                value={selectedMaterial ? selectedMaterial.unidad_venta : 'N/A'}
                disabled
                className="font-semibold bg-gray-100"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="comentario">Comentario (opcional)</Label>
            <textarea
                id="comentario"
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                placeholder="Ej. Para refuerzos adicionales..."
                className="w-full border rounded-lg p-3 text-sm min-h-[80px]"
                disabled={disabled}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={handleAgregar} disabled={disabled}>Agregar al Proyecto</Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AgregarMaterialDialog;