import React, { useState, useEffect } from 'react';
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

const INITIAL_FORM = {
  tipo: 'llamada',
  descripcion: '',
  fecha: new Date().toISOString().split('T')[0],
  proxima_accion: '',
  fecha_proxima_accion: '',
};

const TIPOS = [
  { value: 'llamada', label: '📞 Llamada' },
  { value: 'email', label: '📧 Email' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'visita', label: '📍 Visita' },
  { value: 'reunion', label: '👥 Reunión' },
  { value: 'nota_interna', label: '📝 Nota interna' },
];

const InteraccionForm = ({ open, onOpenChange, prospectoId, marcaOrigen, onSave }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData({
        ...INITIAL_FORM,
        fecha: new Date().toISOString().split('T')[0],
      });
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.descripcion.trim()) {
      toast({
        variant: 'destructive',
        title: 'Descripción requerida',
        description: 'Indica qué se habló o acordó.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from('crm_interacciones').insert([
        {
          prospecto_id: prospectoId,
          marca_origen: marcaOrigen,
          tipo: formData.tipo,
          descripcion: formData.descripcion.trim(),
          fecha: formData.fecha,
          proxima_accion: formData.proxima_accion.trim() || null,
          fecha_proxima_accion: formData.proxima_accion.trim()
            ? formData.fecha_proxima_accion || null
            : null,
        },
      ]);

      if (error) throw error;

      toast({ title: 'Interacción registrada' });
      onSave();
      onOpenChange(false);
      setFormData({
        ...INITIAL_FORM,
        fecha: new Date().toISOString().split('T')[0],
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo guardar la interacción.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Registrar interacción</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select
              value={formData.tipo}
              onValueChange={(val) => setFormData((prev) => ({ ...prev, tipo: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de interacción" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              value={formData.descripcion}
              onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
              placeholder="¿Qué se habló o acordó?"
              className="h-24 resize-none"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="fecha">Fecha de la interacción</Label>
            <Input
              id="fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="proxima_accion">Próxima acción</Label>
            <Input
              id="proxima_accion"
              value={formData.proxima_accion}
              onChange={(e) => setFormData((prev) => ({ ...prev, proxima_accion: e.target.value }))}
              placeholder="¿Cuál es el siguiente paso?"
            />
          </div>

          {formData.proxima_accion.trim() !== '' && (
            <div className="grid gap-2">
              <Label htmlFor="fecha_proxima_accion">Fecha del próximo paso</Label>
              <Input
                id="fecha_proxima_accion"
                type="date"
                value={formData.fecha_proxima_accion}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fecha_proxima_accion: e.target.value }))
                }
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InteraccionForm;
