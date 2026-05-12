import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

const AsignarResponsableDialog = ({ open, onOpenChange, onSave }) => {
  const [responsableId, setResponsableId] = useState('');
  const [responsables, setResponsables] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const fetchResponsables = async () => {
        setLoading(true);
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nombre_completo')
          .in('rol', ['Administrador', 'Proyectos']);
        
        if (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los responsables.' });
        } else {
          setResponsables(data);
        }
        setLoading(false);
      };
      fetchResponsables();
    }
  }, [open, toast]);

  const handleSave = () => {
    if (responsableId) {
      onSave(responsableId);
      setResponsableId('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar Responsable del Proyecto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="responsable">Selecciona un usuario</Label>
            {loading ? (
              <div className="flex items-center justify-center h-10">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <Select value={responsableId} onValueChange={setResponsableId}>
                <SelectTrigger id="responsable">
                  <SelectValue placeholder="Elige un responsable..." />
                </SelectTrigger>
                <SelectContent>
                  {responsables.map(r => <SelectItem key={r.id} value={r.id}>{r.nombre_completo}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={!responsableId || loading}>Guardar Asignación</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AsignarResponsableDialog;