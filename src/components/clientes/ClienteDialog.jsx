import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from "@/components/ui/use-toast";
import { MARCAS_COMERCIALES } from '@/lib/brandingConfig';

const ClienteDialog = ({ open, onOpenChange, onSave, clienteToEdit }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [usarMismoNombre, setUsarMismoNombre] = useState(false);
  const [saveConfirmationOpen, setSaveConfirmationOpen] = useState(false);
  const [rfcNoAplica, setRfcNoAplica] = useState(false);
  const [emailNoAplica, setEmailNoAplica] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    nombre_contacto: '',
    rfc: '',
    telefono: '',
    email: '',
    direccion: '',
    observaciones: '',
    marca_origen: '',
    tipo_persona: 'moral',
    industria: '',
    ciudad: '',
    estado: '',
    fuente_origen: '',
    notas_crm: '',
  });

  useEffect(() => {
    if (open) {
      if (clienteToEdit) {
        setFormData({
          nombre: clienteToEdit.nombre || '',
          nombre_contacto: clienteToEdit.nombre_contacto || clienteToEdit.nombre || '',
          rfc: clienteToEdit.rfc || '',
          telefono: clienteToEdit.telefono || '',
          email: clienteToEdit.email || '',
          direccion: clienteToEdit.direccion || '',
          observaciones: clienteToEdit.observaciones || '',
          marca_origen: clienteToEdit.marca_origen || '',
          tipo_persona: clienteToEdit.tipo_persona || 'moral',
          industria: clienteToEdit.industria || '',
          ciudad: clienteToEdit.ciudad || '',
          estado: clienteToEdit.estado || '',
          fuente_origen: clienteToEdit.fuente_origen || '',
          notas_crm: clienteToEdit.notas_crm || '',
        });
        setUsarMismoNombre(false);
        setRfcNoAplica(!clienteToEdit.rfc);
        setEmailNoAplica(!clienteToEdit.email);
      } else {
        setFormData({
          nombre: '',
          nombre_contacto: '',
          rfc: '',
          telefono: '',
          email: '',
          direccion: '',
          observaciones: '',
          marca_origen: '',
          tipo_persona: 'moral',
          industria: '',
          ciudad: '',
          estado: '',
          fuente_origen: '',
          notas_crm: '',
        });
        setUsarMismoNombre(false);
        setRfcNoAplica(false);
        setEmailNoAplica(false);
      }
    }
  }, [open, clienteToEdit]);

  const handleChange = (e) => {
    const { id, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [id]: value };

      if (id === 'nombre' && usarMismoNombre) {
        newData.nombre_contacto = value;
      }

      return newData;
    });
  };

  const handleCheckboxChange = (checked) => {
    setUsarMismoNombre(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, nombre_contacto: prev.nombre }));
    }
  };

  const handleRfcNoAplica = (checked) => {
    setRfcNoAplica(checked);
    if (checked) setFormData((prev) => ({ ...prev, rfc: '' }));
  };

  const handleEmailNoAplica = (checked) => {
    setEmailNoAplica(checked);
    if (checked) setFormData((prev) => ({ ...prev, email: '' }));
  };

  const performSave = async () => {
    if (!String(formData.telefono).trim()) {
      toast({
        variant: 'destructive',
        title: 'Teléfono requerido',
        description: 'Captura un número de teléfono para guardar el cliente.',
      });
      return;
    }
    setLoading(true);
    try {
      const dataToSave = {
        nombre: formData.nombre,
        nombre_contacto: formData.nombre_contacto,
        rfc: formData.rfc?.trim() || null,
        telefono: formData.telefono,
        email: formData.email?.trim() || null,
        direccion: formData.direccion,
        observaciones: formData.observaciones,
        marca_origen: formData.marca_origen || null,
        tipo_persona: formData.tipo_persona || 'moral',
        industria: formData.industria || null,
        ciudad: formData.ciudad || null,
        estado: formData.estado || null,
        fuente_origen: formData.fuente_origen || null,
        notas_crm: formData.notas_crm || null,
      };

      if (clienteToEdit) {
        const { error } = await supabase
          .from('clientes')
          .update(dataToSave)
          .eq('id', clienteToEdit.id);
        if (error) throw error;
        toast({ title: "Cliente actualizado", description: "Los datos se guardaron correctamente." });
      } else {
        const { error } = await supabase
          .from('clientes')
          .insert([dataToSave]);
        if (error) throw error;
        toast({ title: "Cliente creado", description: "El cliente se ha registrado exitosamente." });
      }

      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error:', error);
      const esCorreoDuplicado =
        error?.code === '23505' && String(error?.message || '').includes('clientes_email_key');
      toast({
        variant: "destructive",
        title: esCorreoDuplicado ? "Correo ya registrado" : "Error",
        description: esCorreoDuplicado
          ? "Ya existe un cliente con ese correo electrónico. Usa otro correo o marca \"No aplica\"."
          : "No se pudo guardar el cliente. Verifica los datos.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (clienteToEdit) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clienteToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 py-4">

          <div className="grid gap-2">
            <Label htmlFor="nombre">Nombre Comercial o Razón Social</Label>
            <Input
              id="nombre"
              value={formData.nombre}
              onChange={handleChange}
              placeholder="Ej. Empresa Constructora S.A. de C.V."
              required
            />
          </div>

          <div className="grid gap-2 bg-gray-50 p-3 rounded-md border border-gray-100">
            <div className="flex items-center justify-between">
              <Label htmlFor="nombre_contacto">Nombre del Contacto</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sameAsName"
                  checked={usarMismoNombre}
                  onCheckedChange={handleCheckboxChange}
                />
                <label
                  htmlFor="sameAsName"
                  className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-gray-500 cursor-pointer"
                >
                  Igual al nombre comercial
                </label>
              </div>
            </div>
            <Input
              id="nombre_contacto"
              value={formData.nombre_contacto}
              onChange={handleChange}
              placeholder="Ej. Ing. Juan Pérez"
              disabled={usarMismoNombre}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rfc">RFC</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="rfcNoAplica" checked={rfcNoAplica} onCheckedChange={handleRfcNoAplica} />
                  <label htmlFor="rfcNoAplica" className="text-xs font-medium text-gray-500 cursor-pointer">
                    No aplica
                  </label>
                </div>
              </div>
              <Input
                id="rfc"
                value={formData.rfc}
                onChange={handleChange}
                placeholder="XAXX010101000"
                disabled={rfcNoAplica}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Teléfono *</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="(999) 123-4567"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="emailNoAplica" checked={emailNoAplica} onCheckedChange={handleEmailNoAplica} />
                <label htmlFor="emailNoAplica" className="text-xs font-medium text-gray-500 cursor-pointer">
                  No aplica
                </label>
              </div>
            </div>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contacto@empresa.com"
              disabled={emailNoAplica}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="direccion">Dirección Fiscal / Entrega</Label>
            <Textarea
              id="direccion"
              value={formData.direccion}
              onChange={handleChange}
              placeholder="Calle, Número, Colonia, Ciudad, CP"
              className="resize-none h-20"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observaciones">Observaciones</Label>
            <Textarea
              id="observaciones"
              value={formData.observaciones}
              onChange={handleChange}
              placeholder="Notas adicionales, horarios de recepción, referencias, etc."
              className="h-24"
            />
          </div>

          <div className="grid gap-2 pt-2 border-t">
            <p className="text-sm font-medium text-gray-900">Información CRM (opcional)</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tipo_persona">Tipo de persona</Label>
                <Select
                  value={formData.tipo_persona || 'moral'}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, tipo_persona: value }))}
                >
                  <SelectTrigger id="tipo_persona">
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moral">Persona moral</SelectItem>
                    <SelectItem value="fisica">Persona física</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="marca_origen">Marca de origen</Label>
                <Select
                  value={formData.marca_origen || undefined}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, marca_origen: value }))}
                >
                  <SelectTrigger id="marca_origen">
                    <SelectValue placeholder="Selecciona marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {MARCAS_COMERCIALES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={formData.ciudad}
                  onChange={handleChange}
                  placeholder="Ej. Mérida"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  placeholder="Ej. Yucatán"
                />
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

            <div className="grid gap-2">
              <Label htmlFor="fuente_origen">Fuente de origen</Label>
              <Select
                value={formData.fuente_origen || undefined}
                onValueChange={(value) => setFormData(prev => ({ ...prev, fuente_origen: value }))}
              >
                <SelectTrigger id="fuente_origen">
                  <SelectValue placeholder="Selecciona fuente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="referido">Referido</SelectItem>
                  <SelectItem value="directo">Cliente directo</SelectItem>
                  <SelectItem value="feria">Feria o evento</SelectItem>
                  <SelectItem value="web">Web/redes</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notas_crm">Notas CRM</Label>
              <Textarea
                id="notas_crm"
                value={formData.notas_crm}
                onChange={handleChange}
                placeholder="Observaciones internas del equipo de ventas..."
                className="h-20 resize-none"
              />
            </div>
          </div>

        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {loading ? 'Guardando...' : 'Guardar Cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={saveConfirmationOpen} onOpenChange={setSaveConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar actualización de datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se actualizará la información del cliente <span className="font-bold">{clienteToEdit?.nombre}</span>.
              Esta acción modificará los datos guardados.
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
    </Dialog>
  );
};

export default ClienteDialog;
