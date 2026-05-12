import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarPlus as CalendarIcon, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const prioridadOptions = [
    { value: 'Alta', label: 'Alta' },
    { value: 'Media', label: 'Media' },
    { value: 'Baja', label: 'Baja' },
];

const NuevoProyectoDialog = ({ open, onOpenChange, onSave }) => {
  const { toast } = useToast();
  const [tipo, setTipo] = useState('externo');
  const [descripcion, setDescripcion] = useState('');
  const [clienteExterno, setClienteExterno] = useState('');
  const [fechaInicio, setFechaInicio] = useState(null);
  const [fechaFin, setFechaFin] = useState(null);
  const [prioridad, setPrioridad] = useState('Baja');
  const [isSaving, setIsSaving] = useState(false);

  // For client combobox
  const [clientes, setClientes] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(false);


  const fetchClientes = useCallback(async () => {
    setLoadingClientes(true);
    const { data, error } = await supabase.from('clientes').select('id, nombre').order('nombre');
    if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.' });
    } else {
        setClientes(data);
    }
    setLoadingClientes(false);
  }, [toast]);

  useEffect(() => {
    if (open) {
      // Reset state on open
      setTipo('externo');
      setDescripcion('');
      setClienteExterno('');
      setFechaInicio(null);
      setFechaFin(null);
      setPrioridad('Baja');
      setSelectedClientId(null);
      setIsSaving(false);
      fetchClientes();
    }
  }, [open, fetchClientes]);

  const handleSave = async () => {
    let clienteFinal;
    if (tipo === 'interno') {
        const { data: teseyCliente, error } = await supabase.from('clientes').select('id').eq('nombre', 'TESEY').single();
        if(error && error.code !== 'PGRST116') {
             toast({ variant: 'destructive', title: 'Error', description: 'No se pudo encontrar el cliente interno TESEY.' });
             return;
        }
        if(teseyCliente) {
            clienteFinal = { id: teseyCliente.id, nombre: 'TESEY' };
        } else {
            toast({ variant: 'destructive', title: 'Error de Configuración', description: 'El cliente "TESEY" no existe. Por favor, créelo en la sección de clientes.' });
            return;
        }

    } else {
        if (selectedClientId) {
            const clienteSeleccionado = clientes.find(c => c.id === selectedClientId);
            clienteFinal = { id: clienteSeleccionado.id, nombre: clienteSeleccionado.nombre };
        } else if (clienteExterno) {
            clienteFinal = { nombre: clienteExterno };
        }
    }
    
    if (!descripcion || !clienteFinal?.nombre || !fechaInicio || !fechaFin) {
      toast({
        variant: 'destructive',
        title: 'Campos Incompletos',
        description: 'Por favor, completa la descripción, cliente y fechas.',
      });
      return;
    }

    if (fechaFin < fechaInicio) {
        toast({ variant: 'destructive', title: 'Error en Fechas', description: 'La fecha de fin no puede ser anterior a la fecha de inicio.' });
        return;
    }

    setIsSaving(true);
    await onSave({
      descripcion,
      cliente_id: clienteFinal.id,
      cliente_nombre_externo: !clienteFinal.id ? clienteFinal.nombre : null,
      fechaInicio: format(fechaInicio, 'yyyy-MM-dd'),
      fechaFin: format(fechaFin, 'yyyy-MM-dd'),
      prioridad,
    });
    setIsSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
        </DialogHeader>
        <div className="py-6 space-y-6">
          <Tabs value={tipo} onValueChange={(v) => { setTipo(v); setSelectedClientId(null); setClienteExterno(''); }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="externo">Cliente Externo</TabsTrigger>
              <TabsTrigger value="interno">Proyecto Interno</TabsTrigger>
            </TabsList>
          
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4">
                <div className="space-y-2 sm:col-span-3">
                    <Label htmlFor="descripcion">Descripción del Proyecto</Label>
                    <Input id="descripcion" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Fabricación de estructura metálica" />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="prioridad">Prioridad</Label>
                     <Select value={prioridad} onValueChange={setPrioridad}>
                        <SelectTrigger id="prioridad">
                            <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                            {prioridadOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <TabsContent value="externo" className="space-y-2">
              <Label>Cliente</Label>
              <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={comboboxOpen} className="w-full justify-between">
                    {selectedClientId ? clientes.find(c => c.id === selectedClientId)?.nombre : "Seleccionar cliente o escribir nuevo"}
                    {loadingClientes ? <Loader2 className="ml-2 h-4 w-4 animate-spin"/> : <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                      <CommandInput placeholder="Buscar cliente o escribir nuevo..." onValueChange={(value) => { setClienteExterno(value); setSelectedClientId(null); }} />
                      <CommandEmpty>
                          <div className="p-4 text-sm text-center">No se encontró el cliente. <br/> Puedes guardarlo como nuevo.</div>
                      </CommandEmpty>
                      <CommandGroup>
                          {clientes.map((c) => (
                              <CommandItem key={c.id} value={c.nombre} onSelect={() => { setSelectedClientId(c.id); setComboboxOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", selectedClientId === c.id ? "opacity-100" : "opacity-0")} />
                                  {c.nombre}
                              </CommandItem>
                          ))}
                      </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </TabsContent>
            <TabsContent value="interno" className="space-y-2">
              <Label>Cliente</Label>
              <Input value="TESEY" disabled />
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de Inicio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !fechaInicio && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaInicio ? format(fechaInicio, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fechaInicio} onSelect={setFechaInicio} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Fecha de Fin</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !fechaFin && 'text-muted-foreground')}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaFin ? format(fechaFin, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={fechaFin} onSelect={setFechaFin} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={isSaving}>Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSaving ? 'Guardando...' : 'Guardar Proyecto'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NuevoProyectoDialog;