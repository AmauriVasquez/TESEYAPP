import React, { useState, useEffect } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

/**
 * Modal obligatorio cuando el usuario cambia de "Por Iniciar" a otro estatus.
 * Obliga a seleccionar fecha_inicio y fecha_fin antes de continuar.
 */
const ProjectDatesModal = ({
  open,
  onOpenChange,
  nuevoEstatus,
  proyecto,
  onConfirm,
  isSubmitting,
}) => {
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);

  useEffect(() => {
    if (!open) return;
    if (proyecto?.fecha_inicio) {
      const d = parseISO(proyecto.fecha_inicio);
      setFechaInicio(isValid(d) ? d : null);
    } else {
      setFechaInicio(null);
    }
    if (proyecto?.fecha_fin) {
      const d = parseISO(proyecto.fecha_fin);
      setFechaFin(isValid(d) ? d : null);
    } else {
      setFechaFin(null);
    }
  }, [open, proyecto?.fecha_inicio, proyecto?.fecha_fin]);

  const canSave = fechaInicio && fechaFin && !isSubmitting;
  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      fecha_inicio: format(fechaInicio, 'yyyy-MM-dd'),
      fecha_fin: format(fechaFin, 'yyyy-MM-dd'),
    };
    onConfirm(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Definir fechas del proyecto</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">
          Al cambiar el estatus de &quot;Por Iniciar&quot; a <strong>{nuevoEstatus}</strong>, debes indicar la fecha de inicio y fin del proyecto.
        </p>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Fecha de inicio</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !fechaInicio && 'text-gray-500')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fechaInicio ? format(fechaInicio, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaInicio}
                  onSelect={setFechaInicio}
                  initialFocus
                  locale={undefined}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label>Fecha de fin</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !fechaFin && 'text-gray-500')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {fechaFin ? format(fechaFin, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fechaFin}
                  onSelect={setFechaFin}
                  disabled={(date) => fechaInicio && date < fechaInicio}
                  initialFocus
                  locale={undefined}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSubmitting ? 'Guardando…' : 'Guardar y actualizar estatus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDatesModal;
