import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarPlus as CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const prioridadOptions = [
    { value: 'Alta', label: 'Alta' },
    { value: 'Media', label: 'Media' },
    { value: 'Baja', label: 'Baja' },
];

const NuevoProyectoDialog = ({ open, onOpenChange, onSave }) => {
  const { toast } = useToast();
  
  // Estado unificado
  const [formData, setFormData] = useState({
    tipo: 'externo',
    descripcion: '',
    cliente_id: null,
    cliente_nombre_externo: '',
    prioridad: 'Baja',
    fecha_inicio: new Date(),
    fecha_fin: new Date()
  });

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('id, nombre').order('nombre');
    setClientes(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchData();
      setFormData({
        tipo: 'externo',
        descripcion: '',
        cliente_id: null,
        cliente_nombre_externo: '',
        prioridad: 'Baja',
        fecha_inicio: new Date(),
        fecha_fin: new Date()
      });
    }
  }, [open, fetchData]);

  // --- AQUÍ ESTABA EL ERROR ---
  const handleSave = async () => {
    // 1. Validaciones usando formData
    if (!formData.descripcion.trim()) {
        toast({ variant: 'destructive', title: 'Falta Descripción', description: 'Escribe una descripción para el proyecto.' });
        return;
    }

    let clienteFinal = { id: null, nombre: '' };

    // Usamos formData.tipo en lugar de 'tipo'
    if (formData.tipo === 'interno') {
        const tesey = clientes.find(c => c.nombre.toUpperCase() === 'TESEY');
        if (tesey) {
            clienteFinal = { id: tesey.id, nombre: 'TESEY' };
        } else {
            toast({ variant: 'destructive', title: 'Configuración', description: 'Debe existir el cliente interno (TESEY) en el sistema.' });
            return;
        }
    } else {
        // Usamos formData.cliente_id
        if (formData.cliente_id) {
            const seleccionado = clientes.find(c => c.id === formData.cliente_id);
            clienteFinal = { id: seleccionado?.id, nombre: seleccionado?.nombre };
        } else if (formData.cliente_nombre_externo) {
            clienteFinal = { id: null, nombre: formData.cliente_nombre_externo };
        } else {
            toast({ variant: 'destructive', title: 'Falta Cliente', description: 'Selecciona un cliente o escribe uno externo.' });
            return;
        }
    }
    
    // Validación de fechas
    if (!formData.fecha_inicio || !formData.fecha_fin) {
      toast({ variant: 'destructive', title: 'Fechas Incompletas', description: 'Selecciona fecha de inicio y fin.' });
      return;
    }

    setIsSaving(true);
    try {
        // Enviamos el objeto limpio al padre
        await onSave({
            descripcion: formData.descripcion,
            cliente_id: clienteFinal.id,
            cliente_nombre_externo: !clienteFinal.id ? clienteFinal.nombre : null,
            fecha_inicio: format(formData.fecha_inicio, 'yyyy-MM-dd'),
            fecha_fin: format(formData.fecha_fin, 'yyyy-MM-dd'),
            prioridad: formData.prioridad,
        });
        // No cerramos aquí, el padre lo hace si tiene éxito, o lo hacemos aquí si preferimos.
    } catch (error) {
        console.error("Error saving:", error);
    } finally {
        setIsSaving(false);
    }
  };

  const clientesOptions = [
    { value: 'externo', label: '-- Cliente Externo Nuevo --' },
    ...clientes.map(c => ({ value: `id:${c.id}`, label: c.nombre }))
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[100vw] max-w-2xl overflow-y-auto max-h-[90vh] sm:w-full">
        <DialogHeader><DialogTitle>Nuevo Proyecto</DialogTitle></DialogHeader>
        
        <div className="space-y-6 py-4">
          <Tabs value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v, cliente_id: null, cliente_nombre_externo: ''})}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="externo">Cliente Externo</TabsTrigger>
              <TabsTrigger value="interno">Interno (IIHEMSA Peninsular)</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Descripción</Label>
              <Input 
                value={formData.descripcion} 
                onChange={(e) => setFormData({...formData, descripcion: e.target.value})} 
                placeholder="Nombre del proyecto..." 
              />
            </div>

            <div className="space-y-2">
              <Label>Cliente</Label>
              {formData.tipo === 'interno' ? (
                <Input value="IIHEMSA Peninsular" disabled className="bg-gray-100" />
              ) : (
                <Combobox
                  options={clientesOptions}
                  value={formData.cliente_id ? `id:${formData.cliente_id}` : 'externo'}
                  onChange={(val) => {
                    if (val === 'externo' || !val) {
                         setFormData({...formData, cliente_id: null, cliente_nombre_externo: ''});
                    } else {
                         const id = parseInt(val.split(':')[1]);
                         setFormData({...formData, cliente_id: id, cliente_nombre_externo: ''});
                    }
                  }}
                  placeholder="Buscar cliente..."
                />
              )}
            </div>

            {formData.tipo === 'externo' && !formData.cliente_id && (
              <div className="space-y-2">
                <Label>Nombre Cliente Externo</Label>
                <Input 
                    value={formData.cliente_nombre_externo} 
                    onChange={(e) => setFormData({...formData, cliente_nombre_externo: e.target.value})} 
                    placeholder="Escribe el nombre del cliente"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Prioridad</Label>
              <Select value={formData.prioridad} onValueChange={(v) => setFormData({...formData, prioridad: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{prioridadOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 flex flex-col">
              <Label>Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.fecha_inicio ? format(formData.fecha_inicio, 'PPP', { locale: es }) : <span>Seleccionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar 
                        mode="single" 
                        selected={formData.fecha_inicio} 
                        onSelect={(d) => d && setFormData({...formData, fecha_inicio: d})} 
                        locale={es} 
                    />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 flex flex-col">
              <Label>Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.fecha_fin ? format(formData.fecha_fin, 'PPP', { locale: es }) : <span>Seleccionar</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar 
                        mode="single" 
                        selected={formData.fecha_fin} 
                        onSelect={(d) => d && setFormData({...formData, fecha_fin: d})} 
                        locale={es} 
                    />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : 'Crear Proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NuevoProyectoDialog;