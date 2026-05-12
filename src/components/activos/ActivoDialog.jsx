import React, { useEffect, useMemo, useState } from 'react';
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
import { cn } from '@/lib/utils';

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'disponible', label: 'Disponible' },
  { value: 'en_uso', label: 'En uso' },
  { value: 'en_mantenimiento', label: 'En mantenimiento' },
  { value: 'en_reparacion', label: 'En reparación' },
  { value: 'dado_de_baja', label: 'Dado de baja' },
];

const getInitialFormData = () => ({
  nombre: '',
  categoria_id: '',
  descripcion: '',
  costo_compra: 0,
  fecha_adquisicion: '',
  requiere_responsiva: false,
  requiere_mantenimiento: false,
  estado: 'pendiente',
  detalle_mantenimiento: '',
  ocultarDelListado: false,
});

const ActivoDialog = ({ open, onOpenChange, onSave, activo, categoriasActivas }) => {
  const { toast } = useToast();
  const isEditing = !!activo?.id;
  const [formData, setFormData] = useState(getInitialFormData());

  const categoriasOrdenadas = useMemo(
    () =>
      [...(categoriasActivas ?? [])].sort((a, b) =>
        String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' })
      ),
    [categoriasActivas]
  );

  useEffect(() => {
    if (!open) return;
    if (activo?.id) {
      const fa = activo.fecha_adquisicion        ? String(activo.fecha_adquisicion).slice(0, 10)
        : '';
           setFormData({
        nombre: (activo.nombre ?? '').toUpperCase(),
        categoria_id: activo.categoria_id ?? activo.categoria?.id ?? '',
        descripcion: activo.descripcion ?? '',
        costo_compra: activo.costo_compra ?? 0,
        fecha_adquisicion: fa,
        requiere_responsiva: Boolean(activo.requiere_responsiva),
        requiere_mantenimiento: Boolean(activo.requiere_mantenimiento),
        estado: activo.estado ?? 'pendiente',
        detalle_mantenimiento: '',
        ocultarDelListado: Boolean(activo.eliminado),
      });
    } else {
      setFormData(getInitialFormData());
    }
  }, [activo, open]);

  const handleNombreChange = (e) => {
    const upper = String(e.target.value).toUpperCase();
    setFormData((prev) => ({ ...prev, nombre: upper }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const nombre = (formData.nombre ?? '').trim();
    const categoria_id = formData.categoria_id;
    if (!nombre) {
      toast({ variant: 'destructive', title: 'Error', description: 'El nombre es obligatorio.' });
      return;
    }
    if (!categoria_id) {
      toast({ variant: 'destructive', title: 'Error', description: 'La categoría es obligatoria.' });
      return;
    }
    const costo = Number(formData.costo_compra);
    if (Number.isNaN(costo) || costo < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'El costo de compra debe ser mayor o igual a 0.' });
      return;
    }
    if (!formData.fecha_adquisicion) {
      toast({ variant: 'destructive', title: 'Error', description: 'La fecha de adquisición es obligatoria.' });
      return;
    }

    const prevEstado = activo?.estado;
    const targetEstado = isEditing ? formData.estado : 'pendiente';
    const entraMantenimientoOReparacion =
      isEditing &&
      (targetEstado === 'en_mantenimiento' || targetEstado === 'en_reparacion') &&
      targetEstado !== prevEstado;

    if (entraMantenimientoOReparacion && !(formData.detalle_mantenimiento ?? '').trim()) {
      toast({
        variant: 'destructive',
        title: 'Detalle obligatorio',
        description: 'Indica el motivo o trabajo al pasar a mantenimiento o reparación.',
      });
      return;
    }

    onSave({
      nombre,
      categoria_id,
      descripcion: (formData.descripcion ?? '').trim(),
      costo_compra: costo,
      fecha_adquisicion: formData.fecha_adquisicion,
      requiere_responsiva: Boolean(formData.requiere_responsiva),
      requiere_mantenimiento: Boolean(formData.requiere_mantenimiento),
      estado: targetEstado,
      detalle_cambio_estado: entraMantenimientoOReparacion ? (formData.detalle_mantenimiento ?? '').trim() : null,
      eliminado: isEditing ? Boolean(formData.ocultarDelListado) : false,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar activo` : 'Nuevo activo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-6 py-4 max-h-[80vh] overflow-y-auto pr-2">
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Datos generales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="activo-nombre">Nombre *</Label>
                <Input
                  id="activo-nombre"
                  value={formData.nombre}
                  onChange={handleNombreChange}
                  placeholder="EJ. COMPRESOR INDUSTRIAL"
                  className="mt-1 uppercase"
                  autoComplete="off"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="activo-categoria">Categoría *</Label>
                <select
                  id="activo-categoria"
                  value={formData.categoria_id}
                  onChange={(e) => setFormData((p) => ({ ...p, categoria_id: e.target.value }))}
                  className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1'
                  )}
                  required
                >
                  <option value="">Seleccione categoría</option>
                  {categoriasOrdenadas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="activo-descripcion">Descripción</Label>
                <Textarea
                  id="activo-descripcion"
                  name="descripcion"
                  value={formData.descripcion}
                  onChange={handleChange}
                  placeholder="Detalle opcional del activo"
                  className="mt-1 min-h-[88px]"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Costo y fecha</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="activo-costo">Costo de compra ($)</Label>
                <Input
                  id="activo-costo"
                  name="costo_compra"
                  type="number"
                  value={formData.costo_compra}
                  onChange={handleChange}
                  step="any"
                  min="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="activo-fecha">Fecha de adquisición *</Label>
                <Input
                  id="activo-fecha"
                  name="fecha_adquisicion"
                  type="date"
                  value={formData.fecha_adquisicion}
                  onChange={handleChange}
                  className="mt-1"
                  required
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Requisitos</h3>
            <div className="flex flex-col sm:flex-row gap-6">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={formData.requiere_responsiva}
                  onCheckedChange={(v) =>
                    setFormData((p) => ({ ...p, requiere_responsiva: v === true }))
                  }
                />
                <span className="text-sm">Requiere responsiva</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={formData.requiere_mantenimiento}
                  onCheckedChange={(v) =>
                    setFormData((p) => ({ ...p, requiere_mantenimiento: v === true }))
                  }
                />
                <span className="text-sm">Requiere mantenimiento</span>
              </label>
            </div>
          </div>

          {isEditing && (
            <div className="p-4 bg-gray-50 rounded-lg border space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Estado y ciclo de vida</h3>
              <div>
                <Label htmlFor="activo-estado">Estado operativo</Label>
                <select
                  id="activo-estado"
                  value={formData.estado}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData((p) => ({
                      ...p,
                      estado: v,
                      ...(!['en_mantenimiento', 'en_reparacion'].includes(v) ? { detalle_mantenimiento: '' } : {}),
                    }));
                  }}
                  className={cn(
                    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1'
                  )}
                >
                  {ESTADOS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.estado === 'en_mantenimiento' || formData.estado === 'en_reparacion') &&
                formData.estado !== (activo?.estado ?? '') && (
                  <div>
                    <Label htmlFor="activo-detalle-mant">Descripción del mantenimiento o reparación *</Label>
                    <Textarea
                      id="activo-detalle-mant"
                      value={formData.detalle_mantenimiento}
                      onChange={(e) => setFormData((p) => ({ ...p, detalle_mantenimiento: e.target.value }))}
                      placeholder="Ej. Servicio preventivo trimestral, cambio de rodamientos…"
                      className="mt-1 min-h-[88px]"
                    />
                  </div>
                )}

              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  className="mt-0.5"
                  checked={formData.ocultarDelListado}
                  onCheckedChange={(v) =>
                    setFormData((p) => ({ ...p, ocultarDelListado: v === true }))
                  }
                />
                <span className="text-sm leading-snug">
                  Ocultar del listado (baja lógica). El registro permanece en base de datos; no se elimina físicamente.
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="pt-4 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit">{isEditing ? 'Guardar cambios' : 'Crear activo'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivoDialog;
