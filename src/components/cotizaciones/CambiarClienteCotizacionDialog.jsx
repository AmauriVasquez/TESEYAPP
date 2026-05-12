import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';

export default function CambiarClienteCotizacionDialog({ open, onOpenChange, cotizacion, onSuccess }) {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => setClientes(data || []));
      setClienteId(cotizacion?.cliente_id ? String(cotizacion.cliente_id) : '');
    }
  }, [open, cotizacion]);

  const handleSave = async () => {
    if (!cotizacion || !clienteId) return;
    setSaving(true);
    const result = await onSuccess(cotizacion.id, parseInt(clienteId, 10), null);
    setSaving(false);
    if (result && !result.error) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cambiar cliente de la cotización</DialogTitle></DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">Cotización: <strong>{cotizacion?.folio}</strong></p>
          <div className="space-y-2">
            <Label>Nuevo cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="Selecciona un cliente" /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving || !clienteId}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Actualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
