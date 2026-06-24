// src/components/finanzas/PagoMultiProyectoDialog.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { registrarPagoMultiProyecto } from '@/services/facturasService';
import { CUENTAS_PAGO } from '@/config/cuentasPago';
import { format } from 'date-fns';

const ENTIDADES = [
  { value: 'tesey', label: 'TESEY' },
  { value: 'ipe', label: 'IIHEMSA Peninsular (IPE)' },
];
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

export default function PagoMultiProyectoDialog({ open, onOpenChange, onSaved }) {
  const { toast } = useToast();
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cuentaValue, setCuentaValue] = useState('');
  const [rows, setRows] = useState([{ proyectoId: '', monto: '' }]);
  const [opciones, setOpciones] = useState([]);
  const [saldos, setSaldos] = useState({}); // proyectoId -> saldo
  const [yaFacturado, setYaFacturado] = useState(false);
  const [facturaNumero, setFacturaNumero] = useState('');
  const [facturaFecha, setFacturaFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [facturaEmisora, setFacturaEmisora] = useState('tesey');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setFecha(format(new Date(), 'yyyy-MM-dd'));
    setCuentaValue(''); setRows([{ proyectoId: '', monto: '' }]); setSaldos({});
    setYaFacturado(false); setFacturaNumero(''); setFacturaFecha(format(new Date(), 'yyyy-MM-dd')); setFacturaEmisora('tesey');
    /* eslint-enable react-hooks/set-state-in-effect */
    supabase.from('proyectos').select('id, folio, descripcion').order('id', { ascending: false }).then(({ data }) => {
      setOpciones((data || []).map((p) => ({ value: String(p.id), label: `${p.folio} – ${p.descripcion}` })));
    });
  }, [open]);

  const total = useMemo(() => round2(rows.reduce((s, r) => s + Number(r.monto || 0), 0)), [rows]);

  const cargarSaldo = async (proyectoId) => {
    if (!proyectoId || saldos[proyectoId] !== undefined) return;
    const { data } = await supabase.from('v_proyecto_pago_progreso').select('costo_total, total_pagado').eq('proyecto_id', proyectoId).single();
    if (data) setSaldos((s) => ({ ...s, [proyectoId]: round2(Number(data.costo_total || 0) - Number(data.total_pagado || 0)) }));
  };

  const setRow = (idx, patch) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, { proyectoId: '', monto: '' }]);
  const removeRow = (idx) => setRows((rs) => (rs.length > 1 ? rs.filter((_, i) => i !== idx) : rs));

  const handleGuardar = async () => {
    const validas = rows.filter((r) => r.proyectoId && Number(r.monto) > 0);
    if (validas.length === 0) { toast({ variant: 'destructive', title: 'Faltan datos', description: 'Agrega al menos un proyecto con monto.' }); return; }
    if (!cuentaValue) { toast({ variant: 'destructive', title: 'Falta la cuenta', description: 'Elige el método/cuenta de pago.' }); return; }
    if (yaFacturado && (!facturaNumero.trim() || !facturaFecha)) { toast({ variant: 'destructive', title: 'Falta la factura', description: 'Folio y fecha son obligatorios si marcas "Ya facturado".' }); return; }
    setSaving(true);
    const { error } = await registrarPagoMultiProyecto({
      fecha,
      cuentaValue,
      asignaciones: validas.map((r) => ({ proyectoId: parseInt(r.proyectoId, 10), monto: Number(r.monto) })),
      factura: yaFacturado ? { numero: facturaNumero.trim(), fecha: facturaFecha, emisora: facturaEmisora } : null,
    });
    setSaving(false);
    if (error) {
      const dup = /facturas_numero_unico|duplicate key/i.test(error.message || '');
      toast({ variant: 'destructive', title: 'Error', description: dup ? `El folio "${facturaNumero}" ya existe.` : error.message });
      return;
    }
    toast({ title: '✅ Pago multi-proyecto registrado' });
    onSaved?.(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto sm:w-full">
        <DialogHeader><DialogTitle>Pago a varios proyectos</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Fecha *</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            <div className="space-y-1">
              <Label>Método / Cuenta *</Label>
              <Select value={cuentaValue} onValueChange={setCuentaValue}>
                <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                <SelectContent>{CUENTAS_PAGO.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Desglose por proyecto</Label>
            {rows.map((r, idx) => {
              const saldo = r.proyectoId ? saldos[r.proyectoId] : undefined;
              const excede = saldo !== undefined && Number(r.monto || 0) > saldo;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Combobox
                        options={opciones}
                        value={r.proyectoId}
                        onChange={(v) => { setRow(idx, { proyectoId: v }); cargarSaldo(v); }}
                        placeholder="Proyecto..."
                        searchPlaceholder="Buscar por folio/descripción..."
                        notFoundMessage="Ningún proyecto."
                      />
                    </div>
                    <Input type="number" step="0.01" className="w-32" value={r.monto} onChange={(e) => setRow(idx, { monto: e.target.value })} placeholder="0.00" />
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeRow(idx)} disabled={rows.length === 1}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  {excede && <p className="text-xs text-amber-600">⚠️ Excede el saldo del proyecto (${money(saldo)}).</p>}
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}><Plus className="w-4 h-4" /> Agregar proyecto</Button>
          </div>

          <div className="flex justify-between items-center border-t pt-2 font-semibold">
            <span>Total del pago</span><span className="text-green-700">${money(total)}</span>
          </div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="multi-ya-fact" className="text-base">Ya está facturado (una factura para todos)</Label>
                <p className="text-xs text-muted-foreground">Debe ser de una sola entidad emisora</p>
              </div>
              <Switch id="multi-ya-fact" checked={yaFacturado} onCheckedChange={setYaFacturado} />
            </div>
            {yaFacturado && (
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label>Folio *</Label><Input value={facturaNumero} onChange={(e) => setFacturaNumero(e.target.value)} placeholder="A-1009" /></div>
                <div className="space-y-1"><Label>Fecha *</Label><Input type="date" value={facturaFecha} onChange={(e) => setFacturaFecha(e.target.value)} /></div>
                <div className="space-y-1">
                  <Label>Emisora</Label>
                  <Select value={facturaEmisora} onValueChange={setFacturaEmisora}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ENTIDADES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
          <Button onClick={handleGuardar} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Guardar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
