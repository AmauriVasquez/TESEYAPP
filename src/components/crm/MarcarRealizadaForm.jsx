import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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

const ETAPAS = [
  { value: 'contactado', label: 'Contactado' },
  { value: 'propuesta_enviada', label: 'Propuesta enviada' },
  { value: 'en_negociacion', label: 'En negociación' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'descartado', label: 'Descartado' },
];

const MarcarRealizadaForm = ({
  open,
  onOpenChange,
  interaccion,
  prospectoId,
  onSave,
  onRefetch,
}) => {
  const { toast } = useToast();
  const [resultado, setResultado] = useState('');
  const [nuevaEtapa, setNuevaEtapa] = useState('');
  const [motivoDescarte, setMotivoDescarte] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    setResultado('');
    setNuevaEtapa('');
    setMotivoDescarte('');
    onOpenChange(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resultado.trim()) {
      toast({
        variant: 'destructive',
        title: 'Resultado requerido',
        description: 'Describe qué pasó en la interacción.',
      });
      return;
    }
    setIsSaving(true);
    try {
      // Mark interaction as realized: programada = false, save result in descripcion
      const { error: intError } = await supabase
        .from('crm_interacciones')
        .update({ programada: false, descripcion: resultado.trim() })
        .eq('id', interaccion.id);
      if (intError) throw intError;

      // Optionally update prospect stage
      if (nuevaEtapa) {
        const updateData = { etapa: nuevaEtapa };
        if (nuevaEtapa === 'descartado' && motivoDescarte.trim()) {
          updateData.motivo_descarte = motivoDescarte.trim();
        }
        const { error: prospError } = await supabase
          .from('prospectos')
          .update(updateData)
          .eq('id', prospectoId);
        if (prospError) throw prospError;
      }

      toast({
        title: 'Interacción registrada',
        description: 'La cita fue marcada como realizada.',
      });
      setResultado('');
      setNuevaEtapa('');
      setMotivoDescarte('');
      onSave();
      if (onRefetch) onRefetch();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo guardar el resultado.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Resultado de la cita</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="resultado">
              ¿Qué resultado tuvo la interacción?{' '}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="resultado"
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              placeholder="Describe brevemente qué pasó..."
              className="h-24 resize-none"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Actualizar etapa del prospecto (opcional)</Label>
            <Select value={nuevaEtapa} onValueChange={setNuevaEtapa}>
              <SelectTrigger>
                <SelectValue placeholder="— Sin cambio —" />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {nuevaEtapa === 'descartado' && (
            <div className="grid gap-2">
              <Label htmlFor="motivoDescarte">Motivo de descarte</Label>
              <Textarea
                id="motivoDescarte"
                value={motivoDescarte}
                onChange={(e) => setMotivoDescarte(e.target.value)}
                placeholder="¿Por qué se descarta este prospecto?"
                className="h-20 resize-none"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSaving ? 'Guardando...' : 'Confirmar resultado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MarcarRealizadaForm;
