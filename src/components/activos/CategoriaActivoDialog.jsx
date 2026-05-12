import React, { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';

const getInitial = () => ({
  nombre: '',
  descripcion: '',
  activa_en_catalogo: true,
});

const CategoriaActivoDialog = ({ open, onOpenChange, onSave, categoria }) => {
  const { toast } = useToast();
  const isEditing = !!categoria?.id;
  const [formData, setFormData] = useState(getInitial());

  useEffect(() => {
    if (!open) return;
    if (categoria?.id) {
      setFormData({
        nombre: categoria.nombre ?? '',
        descripcion: categoria.descripcion ?? '',
        activa_en_catalogo: !categoria.eliminado,
      });
    } else {
      setFormData(getInitial());
    }
  }, [categoria, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const nombre = (formData.nombre ?? '').trim();
    if (!nombre) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es obligatorio.' });
      return;
    }
    onSave({
      nombre,
      descripcion: (formData.descripcion ?? '').trim(),
      eliminado: !formData.activa_en_catalogo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar categoría' : 'Nueva categoría de activo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-5 py-4">
          <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
            <div>
              <Label htmlFor="cat-nombre">Nombre *</Label>
              <Input
                id="cat-nombre"
                value={formData.nombre}
                onChange={(e) => setFormData((p) => ({ ...p, nombre: e.target.value }))}
                placeholder="Ej. Equipo de cómputo"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cat-desc">Descripción</Label>
              <Textarea
                id="cat-desc"
                value={formData.descripcion}
                onChange={(e) => setFormData((p) => ({ ...p, descripcion: e.target.value }))}
                className="mt-1 min-h-[80px]"
                placeholder="Opcional"
              />
            </div>
            {isEditing && (
              <label className="flex items-center gap-3 cursor-pointer pt-1">
                <Checkbox
                  checked={formData.activa_en_catalogo}
                  onCheckedChange={(v) =>
                    setFormData((p) => ({ ...p, activa_en_catalogo: v === true }))
                  }
                />
                <span className="text-sm">Visible en listas y en el formulario de activos</span>
              </label>
            )}
          </div>
          <DialogFooter className="pt-2 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit">{isEditing ? 'Guardar' : 'Crear categoría'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CategoriaActivoDialog;
