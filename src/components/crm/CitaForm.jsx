// src/components/crm/CitaForm.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';

const TIPOS_CITA = [
  { value: 'llamada', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'visita', label: 'Visita' },
];

const INITIAL = {
  tipo: 'llamada',
  fecha: '',
  hora: '',
  descripcion: '',
};

const CitaForm = ({ open, onOpenChange, prospectoId, marcaOrigen, onSave }) => {
  const { toast } = useToast();
  const [form, setForm] = useState(INITIAL);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fecha || !form.hora) {
      toast({
        variant: 'destructive',
        title: 'Fecha y hora requeridas',
        description: 'Selecciona cuándo será la cita.',
      });
      return;
    }
    setIsSaving(true);
    try {
      const fecha_hora_programada = new Date(
        `${form.fecha}T${form.hora}:00`
      ).toISOString();

      const { error } = await supabase.from('crm_interacciones').insert([
        {
          prospecto_id: prospectoId,
          marca_origen: marcaOrigen,
          tipo: form.tipo,
          descripcion: form.descripcion.trim() || null,
          fecha: form.fecha,
          programada: true,
          fecha_hora_programada,
          eliminado: false,
        },
      ]);
      if (error) throw error;

      toast({
        title: 'Cita programada',
        description: 'La cita fue agendada correctamente.',
      });
      setForm(INITIAL);
      onSave();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo guardar la cita.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Programar cita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Tipo de contacto</Label>
            <Select
              value={form.tipo}
              onValueChange={(val) => setForm((p) => ({ ...p, tipo: val }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_CITA.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={form.fecha}
                onChange={handleChange}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                type="time"
                value={form.hora}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="descripcion">Notas previas (opcional)</Label>
            <Textarea
              id="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              placeholder="Temas a tratar, objetivo de la cita..."
              className="h-20 resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isSaving ? 'Guardando...' : 'Programar cita'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CitaForm;
