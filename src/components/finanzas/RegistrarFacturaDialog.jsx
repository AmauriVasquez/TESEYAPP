// src/components/finanzas/RegistrarFacturaDialog.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { registrarFactura, descartarFacturacion, getCobrosProyecto } from '@/services/facturasService';
import { brandingToEntidad } from '@/config/cuentasPago';
import { format } from 'date-fns';

const ENTIDADES = [{ value: 'tesey', label: 'TESEY' }, { value: 'ipe', label: 'IIHEMSA Peninsular (IPE)' }];

export default function RegistrarFacturaDialog({ open, onOpenChange, proyecto, onSaved }) {
  const { toast } = useToast();
  const [emisora, setEmisora] = useState('tesey');
  const [alcance, setAlcance] = useState('proyecto'); // 'proyecto' | 'ingreso'
  const [cobros, setCobros] = useState([]);
  const [cobroId, setCobroId] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monto, setMonto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !proyecto) return;
    let cancelled = false;
    getCobrosProyecto(proyecto.id).then(({ data }) => {
      if (cancelled) return;
      setEmisora(brandingToEntidad(proyecto?.cotizacion?.branding ?? proyecto?.branding) ?? 'tesey');
      setAlcance('proyecto'); setCobroId(''); setNumero(''); setMonto('');
      setFecha(format(new Date(), 'yyyy-MM-dd'));
      setCobros((data || []).filter((c) => !c.factura_id));
    });
    return () => { cancelled = true; };
  }, [open, proyecto]);

  const handleGuardar = async () => {
    if (!numero.trim() || !fecha) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Número de factura y fecha son obligatorios.' });
      return;
    }
    if (alcance === 'proyecto' && cobros.length === 0) {
      toast({ variant: 'destructive', title: 'Sin cobros por facturar', description: 'Este proyecto no tiene cobros pendientes de factura para ligar.' });
      return;
    }
    if (alcance === 'ingreso' && !cobroId) {
      toast({ variant: 'destructive', title: 'Elige un ingreso', description: 'Selecciona el cobro a facturar.' });
      return;
    }
    const cobroIds = alcance === 'ingreso' && cobroId ? [Number(cobroId)] : cobros.map((c) => c.id);
    setSaving(true);
    const { error } = await registrarFactura({
      proyectoId: proyecto.id,
      empresaEmisora: emisora,
      numero: numero.trim(),
      fechaEmision: fecha,
      monto: monto ? parseFloat(monto) : null,
      cobroIds,
    });
    setSaving(false);
    if (error) {
      const dup = /facturas_numero_unico|duplicate key/i.test(error.message);
      toast({ variant: 'destructive', title: 'Error', description: dup ? `El folio "${numero}" ya existe.` : error.message });
      return;
    }
    toast({ title: '✅ Factura registrada' });
    onSaved?.(); onOpenChange(false);
  };

  const handleDescartar = async () => {
    if (!window.confirm('¿Marcar este proyecto como "No se facturará"?')) return;
    setSaving(true);
    const { error } = await descartarFacturacion(proyecto.id);
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Marcado como no facturable' });
    onSaved?.(); onOpenChange(false);
  };

  if (!proyecto) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:w-full">
        <DialogHeader><DialogTitle>Registrar Factura · {proyecto.folio}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Empresa emisora</Label>
            <Select value={emisora} onValueChange={setEmisora}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENTIDADES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={alcance === 'proyecto'} onChange={() => setAlcance('proyecto')} /> Todo el proyecto (liga {cobros.length} cobro(s))</label>
            <label className="flex items-center gap-2"><input type="radio" checked={alcance === 'ingreso'} onChange={() => setAlcance('ingreso')} /> Un ingreso específico</label>
          </div>
          {alcance === 'ingreso' && (
            <div className="space-y-2">
              <Label>Ingreso</Label>
              <Select value={cobroId} onValueChange={setCobroId}>
                <SelectTrigger><SelectValue placeholder="Elige el cobro..." /></SelectTrigger>
                <SelectContent>{cobros.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fecha_pago} · ${Number(c.monto).toLocaleString('es-MX')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Número de factura *</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="A-1009" /></div>
            <div className="space-y-2"><Label>Fecha *</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Monto (opcional)</Label><Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></div>
        </div>
        <DialogFooter className="flex-row justify-between">
          <Button variant="ghost" className="text-gray-600" onClick={handleDescartar} disabled={saving}>No se facturará</Button>
          <div className="flex gap-2">
            <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
            <Button onClick={handleGuardar} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Marcar como Facturado
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
