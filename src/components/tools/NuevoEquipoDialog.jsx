import React, { useState } from 'react';
import { supabase } from '../../lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus } from 'lucide-react';

const NuevoEquipoDialog = ({ onToolAdded }) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    codigo: '', nombre: '', marca: '', numero_serie: '',
    estado: 'Disponible', ubicacion_actual: 'Almacén',
    criterio_mantenimiento: 'TIEMPO',
    frecuencia_mantenimiento: 30,
    contador_actual: 0,
    fecha_prox_mantenimiento: new Date().toISOString().split('T')[0]
  });

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('equipos').insert([formData]);
      if (error) throw error;

      toast({ title: "Éxito", description: "Equipo registrado correctamente." });
      setOpen(false);
      onToolAdded();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Equipo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Registrar Herramienta o Equipo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Código</Label>
              <Input placeholder="Ej. TAL-01" required 
                onChange={(e) => handleChange('codigo', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Nombre del Equipo</Label>
              <Input placeholder="Ej. Taladro Percutor" required 
                onChange={(e) => handleChange('nombre', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Marca</Label>
              <Input placeholder="Ej. Dewalt" 
                onChange={(e) => handleChange('marca', e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>No. Serie</Label>
              <Input placeholder="S/N 1234..." 
                onChange={(e) => handleChange('numero_serie', e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-4 mt-2">
            <Label className="text-base font-semibold">Configuración de Mantenimiento</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo de Control</Label>
              <Select defaultValue="TIEMPO" onValueChange={(val) => handleChange('criterio_mantenimiento', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIEMPO">Por Tiempo (Días)</SelectItem>
                  <SelectItem value="HORAS">Por Uso (Horas)</SelectItem>
                  <SelectItem value="KM">Por Uso (Kilómetros)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Frecuencia (Cada cuánto)</Label>
              <Input type="number" placeholder="Ej. 180" required 
                onChange={(e) => handleChange('frecuencia_mantenimiento', e.target.value)} />
            </div>
          </div>

          {formData.criterio_mantenimiento === 'TIEMPO' ? (
            <div className="grid gap-2">
              <Label>Próximo Mantenimiento</Label>
              <DatePicker
                value={formData.fecha_prox_mantenimiento}
                onChange={(v) => handleChange('fecha_prox_mantenimiento', v)}
                aria-label="Fecha del próximo mantenimiento"
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Lectura Actual (Horas/Km)</Label>
              <Input type="number" placeholder="0" 
                onChange={(e) => handleChange('contador_actual', e.target.value)} />
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar Equipo</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default NuevoEquipoDialog;