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
import { Loader2, Trash2 } from 'lucide-react';
import { registrarPagoMultiProyecto } from '@/services/facturasService';
import { CUENTAS_PAGO } from '@/config/cuentasPago';
import { format } from 'date-fns';

const ENTIDADES = [
  { value: 'tesey', label: 'TESEY' },
  { value: 'ipe', label: 'IIHEMSA Peninsular (IPE)' },
];
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });

/**
 * preProyectos: [{ id, folio, descripcion }] preseleccionados.
 * proyectosCliente: [{ id, folio, descripcion, saldo }] del cliente con saldo>0
 *   (alimenta el picker "Agregar proyecto" y el saldo de cada fila).
 */
export default function PagoMultiProyectoDialog({ open, onOpenChange, onSaved, preProyectos = [], proyectosCliente = [] }) {
  const { toast } = useToast();
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [cuentaValue, setCuentaValue] = useState('');
  const [rows, setRows] = useState([]); // [{ proyectoId }]
  const [montos, setMontos] = useState({}); // proyectoId -> monto (string)
  const [saldosFallback, setSaldosFallback] = useState({});
  const [yaFacturado, setYaFacturado] = useState(false);
  const [facturaNumero, setFacturaNumero] = useState('');
  const [facturaFecha, setFacturaFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [facturaEmisora, setFacturaEmisora] = useState('tesey');
  const [saving, setSaving] = useState(false);

  // Mapa de info por proyecto (label + saldo), combinando proyectosCliente y preProyectos.
  const proyById = useMemo(() => {
    const m = {};
    (proyectosCliente || []).forEach((p) => { m[String(p.id)] = { folio: p.folio, descripcion: p.descripcion, saldo: round2(p.saldo) }; });
    (preProyectos || []).forEach((p) => { if (!m[String(p.id)]) m[String(p.id)] = { folio: p.folio, descripcion: p.descripcion, saldo: undefined }; });
    return m;
  }, [proyectosCliente, preProyectos]);

  useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setFecha(format(new Date(), 'yyyy-MM-dd'));
    setCuentaValue(''); setMontos({}); setSaldosFallback({});
    setYaFacturado(false); setFacturaNumero(''); setFacturaFecha(format(new Date(), 'yyyy-MM-dd')); setFacturaEmisora('tesey');
    setRows((preProyectos || []).map((p) => ({ proyectoId: String(p.id) })));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open]);

  const saldoDe = (id) => {
    const s = proyById[String(id)]?.saldo;
    return s !== undefined ? s : saldosFallback[String(id)];
  };

  const labelDe = (id) => {
    const p = proyById[String(id)];
    return p ? `${p.descripcion || ''} (${p.folio || `PRJ-${id}`})` : `Proyecto ${id}`;
  };

  // Opciones para "Agregar proyecto": proyectos del cliente con saldo, no agregados aún.
  const opcionesAdd = useMemo(() => {
    const usados = new Set(rows.map((r) => String(r.proyectoId)));
    return (proyectosCliente || [])
      .filter((p) => !usados.has(String(p.id)))
      .map((p) => ({ value: String(p.id), label: `${p.descripcion || ''} (${p.folio || `PRJ-${p.id}`})` }));
  }, [proyectosCliente, rows]);

  const total = useMemo(
    () => round2(rows.reduce((s, r) => s + Number(montos[r.proyectoId] || 0), 0)),
    [rows, montos]
  );

  const setMonto = (id, val) => setMontos((m) => ({ ...m, [String(id)]: val }));
  const liquidar = (id) => { const s = saldoDe(id); if (s !== undefined) setMonto(id, String(s)); };
  const liquidarTodo = () => setMontos(() => {
    const m = {};
    rows.forEach((r) => { const s = saldoDe(r.proyectoId); if (s !== undefined) m[r.proyectoId] = String(s); });
    return m;
  });
  const addProyecto = (id) => {
    if (!id) return;
    setRows((rs) => (rs.some((r) => String(r.proyectoId) === String(id)) ? rs : [...rs, { proyectoId: String(id) }]));
  };
  const removeRow = (id) => { setRows((rs) => rs.filter((r) => String(r.proyectoId) !== String(id))); setMontos((m) => { const n = { ...m }; delete n[String(id)]; return n; }); };

  const handleGuardar = async () => {
    const validas = rows.filter((r) => r.proyectoId && Number(montos[r.proyectoId]) > 0);
    if (validas.length === 0) { toast({ variant: 'destructive', title: 'Faltan datos', description: 'Agrega al menos un proyecto con monto.' }); return; }
    if (!cuentaValue) { toast({ variant: 'destructive', title: 'Falta la cuenta', description: 'Elige el método/cuenta de pago.' }); return; }
    if (yaFacturado && (!facturaNumero.trim() || !facturaFecha)) { toast({ variant: 'destructive', title: 'Falta la factura', description: 'Folio y fecha son obligatorios si marcas "Ya facturado".' }); return; }
    setSaving(true);
    const { error } = await registrarPagoMultiProyecto({
      fecha,
      cuentaValue,
      asignaciones: validas.map((r) => ({ proyectoId: parseInt(r.proyectoId, 10), monto: Number(montos[r.proyectoId]) })),
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
            <div className="flex items-center justify-between">
              <Label>Proyectos a pagar</Label>
              {rows.length > 1 && (
                <Button type="button" variant="ghost" size="sm" className="text-green-700 h-7" onClick={liquidarTodo}>Liquidar todo</Button>
              )}
            </div>
            {rows.length === 0 && <p className="text-sm text-gray-400">Agrega un proyecto abajo.</p>}
            {rows.map((r) => {
              const saldo = saldoDe(r.proyectoId);
              const monto = montos[r.proyectoId] ?? '';
              const excede = saldo !== undefined && Number(monto || 0) > saldo;
              return (
                <div key={r.proyectoId} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium flex-1">{labelDe(r.proyectoId)}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeRow(r.proyectoId)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-amber-700">Saldo: ${money(saldo ?? 0)}</span>
                    <div className="flex items-center gap-2">
                      {saldo !== undefined && (
                        <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => liquidar(r.proyectoId)}>Liquidar</Button>
                      )}
                      <Input type="number" step="0.01" className="w-32" value={monto} onChange={(e) => setMonto(r.proyectoId, e.target.value)} placeholder="0.00" />
                    </div>
                  </div>
                  {excede && <p className="text-xs text-amber-600">⚠️ Excede el saldo del proyecto (${money(saldo)}).</p>}
                </div>
              );
            })}
            {opcionesAdd.length > 0 && (
              <Combobox
                options={opcionesAdd}
                value=""
                onChange={addProyecto}
                placeholder="+ Agregar otro proyecto del cliente..."
                searchPlaceholder="Buscar por folio/descripción..."
                notFoundMessage="Sin más proyectos con saldo."
              />
            )}
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
