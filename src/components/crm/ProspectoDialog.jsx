import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { MARCAS_COMERCIALES } from '@/lib/brandingConfig';

const INITIAL_FORM = {
  nombre: '',
  nombre_contacto: '',
  tipo_persona: 'moral',
  marca_origen: 'tesey',
  telefono: '',
  email: '',
  sitio_web: '',
  ciudad: '',
  estado: '',
  industria: '',
  etapa: 'nuevo',
  valor_estimado: '',
  probabilidad: 20,
  fuente: '',
  fecha_cierre_estimada: '',
  observaciones: '',
};

const ETAPAS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'propuesta_enviada', label: 'Propuesta enviada' },
  { value: 'en_negociacion', label: 'En negociación' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'descartado', label: 'Descartado' },
];

const FUENTES = [
  { value: 'referido', label: 'Referido' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'web', label: 'Web' },
  { value: 'visita_directa', label: 'Visita directa' },
  { value: 'feria', label: 'Feria' },
  { value: 'llamada_fria', label: 'Llamada en frío' },
  { value: 'otro', label: 'Otro' },
];

const ProspectoDialog = ({ open, onOpenChange, prospectoEditar, onSave }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (prospectoEditar) {
      setFormData({
        nombre: prospectoEditar.nombre || '',
        nombre_contacto: prospectoEditar.nombre_contacto || '',
        tipo_persona: prospectoEditar.tipo_persona || 'moral',
        marca_origen: prospectoEditar.marca_origen || 'tesey',
        telefono: prospectoEditar.telefono || '',
        email: prospectoEditar.email || '',
        sitio_web: prospectoEditar.sitio_web || '',
        ciudad: prospectoEditar.ciudad || '',
        estado: prospectoEditar.estado || '',
        industria: prospectoEditar.industria || '',
        etapa: prospectoEditar.etapa || 'nuevo',
        valor_estimado:
          prospectoEditar.valor_estimado != null ? String(prospectoEditar.valor_estimado) : '',
        probabilidad: prospectoEditar.probabilidad ?? 20,
        fuente: prospectoEditar.fuente || '',
        fecha_cierre_estimada: prospectoEditar.fecha_cierre_estimada || '',
        observaciones: prospectoEditar.observaciones || '',
      });
    } else {
      setFormData(INITIAL_FORM);
    }
  }, [open, prospectoEditar]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const performSave = async () => {
    setIsSaving(true);
    try {
      const dataToSave = {
        nombre: formData.nombre.trim(),
        nombre_contacto: formData.nombre_contacto.trim() || null,
        tipo_persona: formData.tipo_persona || 'moral',
        marca_origen: formData.marca_origen,
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        sitio_web: formData.sitio_web.trim() || null,
        ciudad: formData.ciudad.trim() || null,
        estado: formData.estado.trim() || null,
        industria: formData.industria.trim() || null,
        etapa: formData.etapa,
        valor_estimado: parseFloat(formData.valor_estimado) || 0,
        probabilidad: parseInt(formData.probabilidad, 10) || 0,
        fuente: formData.fuente || null,
        fecha_cierre_estimada: formData.fecha_cierre_estimada || null,
        observaciones: formData.observaciones.trim() || null,
      };

      if (prospectoEditar) {
        const { error } = await supabase
          .from('prospectos')
          .update(dataToSave)
          .eq('id', prospectoEditar.id);
        if (error) throw error;
        toast({ title: 'Prospecto actualizado', description: 'Los datos se guardaron correctamente.' });
      } else {
        const { error } = await supabase.from('prospectos').insert([dataToSave]);
        if (error) throw error;
        toast({ title: 'Prospecto creado', description: 'El prospecto se registró exitosamente.' });
      }

      onSave();
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo guardar el prospecto.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast({
        variant: 'destructive',
        title: 'Nombre requerido',
        description: 'Indica el nombre del prospecto.',
      });
      return;
    }
    if (prospectoEditar) {
      setSaveConfirmationOpen(true);
    } else {
      await performSave();
    }
  };

  const handleSaveConfirm = async () => {
    setSaveConfirmationOpen(false);
    await performSave();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{prospectoEditar ? 'Editar prospecto' : 'Nuevo prospecto'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-4 py-4">
            <p className="text-sm font-medium text-gray-900">Datos básicos</p>

            <div className="grid gap-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={handleChange}
                placeholder="Razón social o nombre comercial"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nombre_contacto">Nombre del contacto</Label>
              <Input
                id="nombre_contacto"
                value={formData.nombre_contacto}
                onChange={handleChange}
                placeholder="Persona de contacto"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Tipo de persona</Label>
                <Select
                  value={formData.tipo_persona || 'moral'}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, tipo_persona: val }))}
                >
                  <SelectTrigger id="tipo_persona">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moral">Persona moral</SelectItem>
                    <SelectItem value="fisica">Persona física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Marca de origen</Label>
                <Select
                  value={formData.marca_origen || 'tesey'}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, marca_origen: val }))}
                >
                  <SelectTrigger id="marca_origen">
                    <SelectValue placeholder="Marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARCAS_COMERCIALES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" value={formData.telefono} onChange={handleChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" type="email" value={formData.email} onChange={handleChange} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="sitio_web">Sitio web</Label>
              <Input
                id="sitio_web"
                type="url"
                value={formData.sitio_web}
                onChange={handleChange}
                placeholder="https://ejemplo.com"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" value={formData.ciudad} onChange={handleChange} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" value={formData.estado} onChange={handleChange} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="industria">Industria</Label>
              <Input
                id="industria"
                value={formData.industria}
                onChange={handleChange}
                placeholder="Ej. Construcción, manufactura, comercio..."
              />
            </div>

            <div className="grid gap-2 pt-2 border-t">
              <p className="text-sm font-medium text-gray-900">Pipeline CRM</p>

              <div className="grid gap-2">
                <Label>Etapa</Label>
                <Select
                  value={formData.etapa}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, etapa: val }))}
                >
                  <SelectTrigger id="etapa">
                    <SelectValue placeholder="Etapa" />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="valor_estimado">Valor estimado</Label>
                  <Input
                    id="valor_estimado"
                    type="number"
                    min={0}
                    value={formData.valor_estimado}
                    onChange={handleChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="probabilidad">Probabilidad (%)</Label>
                  <Input
                    id="probabilidad"
                    type="number"
                    min={0}
                    max={100}
                    value={formData.probabilidad}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Fuente</Label>
                <Select
                  value={formData.fuente || undefined}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, fuente: val }))}
                >
                  <SelectTrigger id="fuente">
                    <SelectValue placeholder="Fuente de origen" />
                  </SelectTrigger>
                  <SelectContent>
                    {FUENTES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fecha_cierre_estimada">Fecha cierre estimada</Label>
                <Input
                  id="fecha_cierre_estimada"
                  type="date"
                  value={formData.fecha_cierre_estimada}
                  onChange={handleChange}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="observaciones">Observaciones</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={handleChange}
                  className="h-20 resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSaving ? 'Guardando...' : 'Guardar prospecto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={saveConfirmationOpen} onOpenChange={setSaveConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar actualización de datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará la información del prospecto{' '}
              <span className="font-bold">{prospectoEditar?.nombre}</span>. Esta acción modificará los
              datos guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveConfirm} className="bg-blue-600 hover:bg-blue-700">
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProspectoDialog;
