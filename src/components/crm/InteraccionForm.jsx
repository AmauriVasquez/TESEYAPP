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
import { Trash2, AlertTriangle } from 'lucide-react';

const INITIAL_FORM = {
  tipo: 'llamada',
  descripcion: '',
  fecha: new Date().toISOString().split('T')[0],
  proxima_accion: '',
  fecha_proxima_accion: '',
  fecha_seguimiento: '',
  hora_seguimiento: '09:00',
};

const TIPOS = [
  { value: 'llamada', label: '📞 Llamada' },
  { value: 'email', label: '📧 Email' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'visita', label: '📍 Visita' },
  { value: 'reunion', label: '👥 Reunión' },
  { value: 'nota_interna', label: '📝 Nota interna' },
];

const InteraccionForm = ({ open, onOpenChange, prospectoId, marcaOrigen, onSave, interaccion }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditing = !!interaccion?.id;

  useEffect(() => {
    if (open) {
      if (interaccion?.id) {
        // Pre-populate en modo edición
        let fecha_seguimiento = '';
        let hora_seguimiento = '09:00';
        if (interaccion.fecha_hora_programada) {
          const dt = new Date(interaccion.fecha_hora_programada);
          fecha_seguimiento = dt.toISOString().split('T')[0];
          hora_seguimiento = dt.toTimeString().slice(0, 5);
        }
        setFormData({
          tipo: interaccion.tipo || 'llamada',
          descripcion: interaccion.descripcion || '',
          fecha: interaccion.fecha || new Date().toISOString().split('T')[0],
          proxima_accion: interaccion.proxima_accion || '',
          fecha_proxima_accion: interaccion.fecha_proxima_accion || '',
          fecha_seguimiento,
          hora_seguimiento,
        });
      } else {
        setFormData({ ...INITIAL_FORM, fecha: new Date().toISOString().split('T')[0] });
      }
      setConfirmDelete(false);
    }
  }, [open, interaccion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.descripcion.trim()) {
      toast({ variant: 'destructive', title: 'Descripción requerida', description: 'Indica qué se habló o acordó.' });
      return;
    }

    // Fecha de seguimiento → fecha_hora_programada + programada
    let fecha_hora_programada = null;
    let programada = false;
    if (formData.fecha_seguimiento) {
      fecha_hora_programada = `${formData.fecha_seguimiento}T${formData.hora_seguimiento}:00`;
      programada = true;
    }

    const payload = {
      tipo: formData.tipo,
      descripcion: formData.descripcion.trim(),
      fecha: formData.fecha,
      proxima_accion: formData.proxima_accion.trim() || null,
      fecha_proxima_accion: formData.proxima_accion.trim() ? formData.fecha_proxima_accion || null : null,
      fecha_hora_programada,
      programada,
    };

    setIsSaving(true);
    try {
      let error;
      if (isEditing) {
        ({ error } = await supabase
          .from('crm_interacciones')
          .update(payload)
          .eq('id', interaccion.id));
      } else {
        ({ error } = await supabase.from('crm_interacciones').insert([{
          ...payload,
          prospecto_id: prospectoId,
          marca_origen: marcaOrigen,
        }]));
      }
      if (error) throw error;

      toast({ title: isEditing ? 'Interacción actualizada' : 'Interacción registrada' });
      onSave();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'No se pudo guardar.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!interaccion?.id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('crm_interacciones')
        .update({ eliminado: true })
        .eq('id', interaccion.id);
      if (error) throw error;
      toast({ title: 'Interacción eliminada' });
      onSave();
      onOpenChange(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al eliminar', description: err.message });
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) setConfirmDelete(false); onOpenChange(val); }}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar interacción' : 'Registrar interacción'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          {/* Tipo */}
          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select
              value={formData.tipo}
              onValueChange={(val) => setFormData((prev) => ({ ...prev, tipo: val }))}
            >
              <SelectTrigger><SelectValue placeholder="Tipo de interacción" /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descripción */}
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

          {/* Fecha de la interacción */}
          <div className="grid gap-2">
            <Label htmlFor="fecha">Fecha de la interacción</Label>
            <Input
              id="fecha"
              type="date"
              value={formData.fecha}
              onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))}
            />
          </div>

          {/* Próxima acción */}
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

          {/* Fecha de seguimiento (calendarizable) */}
          <div className="grid gap-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <Label className="text-indigo-800 font-semibold text-sm">📅 Fecha de seguimiento</Label>
            <p className="text-xs text-indigo-600 -mt-1">Si se define, aparece en el calendario como pendiente.</p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={formData.fecha_seguimiento}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, fecha_seguimiento: e.target.value }))
                }
                className="flex-1"
              />
              <Input
                type="time"
                value={formData.hora_seguimiento}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, hora_seguimiento: e.target.value }))
                }
                className="w-28"
                disabled={!formData.fecha_seguimiento}
              />
            </div>
            {formData.fecha_seguimiento && (
              <button
                type="button"
                className="text-xs text-indigo-500 hover:text-indigo-700 text-left"
                onClick={() => setFormData((prev) => ({ ...prev, fecha_seguimiento: '', hora_seguimiento: '09:00' }))}
              >
                ✕ Quitar seguimiento
              </button>
            )}
          </div>

          {/* Confirmación de eliminación */}
          {confirmDelete && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">¿Eliminar esta interacción?</p>
                <p className="text-xs text-red-600 mt-0.5">Esta acción no se puede deshacer.</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="h-7 text-xs"
                  >
                    {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    className="h-7 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditing && !confirmDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 sm:mr-auto"
                onClick={() => setConfirmDelete(true)}
                disabled={isSaving}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? 'Guardando...' : isEditing ? 'Actualizar' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default InteraccionForm;
