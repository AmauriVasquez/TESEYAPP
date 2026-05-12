import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Asegúrate de tener este componente, si no usa <textarea>
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from "@/components/ui/use-toast";

const ClienteDialog = ({ open, onOpenChange, onSave, clienteToEdit }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [usarMismoNombre, setUsarMismoNombre] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    nombre_contacto: '', // Nuevo campo
    rfc: '',
    telefono: '',
    email: '',
    direccion: '',
    observaciones: '', // Nuevo campo
  });

  // Cargar datos al editar o limpiar al crear
  useEffect(() => {
    if (open) {
      if (clienteToEdit) {
        setFormData({
          nombre: clienteToEdit.nombre || '',
          nombre_contacto: clienteToEdit.nombre_contacto || clienteToEdit.nombre || '', // Fallback si no existía antes
          rfc: clienteToEdit.rfc || '',
          telefono: clienteToEdit.telefono || '',
          email: clienteToEdit.email || '',
          direccion: clienteToEdit.direccion || '',
          observaciones: clienteToEdit.observaciones || '',
        });
        setUsarMismoNombre(false); // Por defecto en false al editar para no sobrescribir sin querer
      } else {
        setFormData({
          nombre: '',
          nombre_contacto: '',
          rfc: '',
          telefono: '',
          email: '',
          direccion: '',
          observaciones: '',
        });
        setUsarMismoNombre(false);
      }
    }
  }, [open, clienteToEdit]);

  // Manejador de cambios en inputs
  const handleChange = (e) => {
    const { id, value } = e.target;
    
    setFormData((prev) => {
      const newData = { ...prev, [id]: value };
      
      // Si cambiamos el nombre y el checkbox está activo, actualizamos también el contacto
      if (id === 'nombre' && usarMismoNombre) {
        newData.nombre_contacto = value;
      }
      
      return newData;
    });
  };

  // Manejador del checkbox
  const handleCheckboxChange = (checked) => {
    setUsarMismoNombre(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, nombre_contacto: prev.nombre }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const dataToSave = {
        nombre: formData.nombre,
        nombre_contacto: formData.nombre_contacto,
        rfc: formData.rfc,
        telefono: formData.telefono,
        email: formData.email,
        direccion: formData.direccion,
        observaciones: formData.observaciones,
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
      
      onSave(); // Recargar lista
      onOpenChange(false); // Cerrar modal
    } catch (error) {
      console.error('Error:', error);
      toast({ 
        variant: "destructive", 
        title: "Error", 
        description: "No se pudo guardar el cliente. Verifica los datos." 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{clienteToEdit ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          
          {/* Nombre Comercial */}
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

          {/* Nombre de Contacto (NUEVO) */}
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
              disabled={usarMismoNombre} // Deshabilitar si se está copiando automáticamente
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rfc">RFC</Label>
              <Input
                id="rfc"
                value={formData.rfc}
                onChange={handleChange}
                placeholder="XAXX010101000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="(999) 123-4567"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contacto@empresa.com"
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

          {/* Observaciones (NUEVO) */}
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
    </Dialog>
  );
};

export default ClienteDialog;