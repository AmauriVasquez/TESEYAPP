import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, PlusCircle, Trash2, FileText, FileCode } from 'lucide-react';
import { formatDateTable } from '@/lib/dateUtils';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

/**
 * Facturas de la OC: tabla + agregar factura.
 * Consulta oc_facturas por oc_id. Inserta en oc_facturas.
 */
export default function OCFacturas({ oc, onUpdate }) {
  const { toast } = useToast();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ folio: '', fecha: '', monto: '' });

  const fetchFacturas = useCallback(async () => {
    if (!oc?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('oc_facturas')
        .select('*')
        .eq('orden_compra_id', oc.id)
        .order('fecha_emision', { ascending: false });
      if (error) throw error;
      setFacturas(data ?? []);
    } catch (err) {
      console.error('Error en OCFacturas fetch:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las facturas.' });
      setFacturas([]);
    } finally {
      setLoading(false);
    }
  }, [oc?.id, toast]);

  useEffect(() => {
    if (oc?.id) fetchFacturas();
  }, [oc?.id, fetchFacturas]);

  const totalFacturado = facturas.reduce((s, f) => s + (Number(f.monto) || 0), 0);

  const openDialog = () => {
    setForm({ folio: '', fecha: new Date().toISOString().slice(0, 10), monto: '' });
    setDialogOpen(true);
  };

  const handleAgregarFactura = async (e) => {
    e?.preventDefault();
    const montoNum = parseFloat(form.monto);
    if (!Number.isFinite(montoNum) || montoNum < 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Monto inválido.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('oc_facturas').insert({
        orden_compra_id: oc.id,
        folio_factura: (form.folio || '').trim() || null,
        fecha_emision: (form.fecha || '').trim() || new Date().toISOString().slice(0, 10),
        monto: montoNum,
      });
      if (error) throw error;
      toast({ title: 'Factura agregada', description: formatCurrency(montoNum) + ' registrada.' });
      setDialogOpen(false);
      fetchFacturas();
      onUpdate?.();
    } catch (err) {
      console.error('Error en OCFacturas insert:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo agregar la factura.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarFactura = useCallback(async (facturaId) => {
    if (!window.confirm('¿Estás seguro de eliminar esta factura?')) return;
    try {
      const { error } = await supabase.from('oc_facturas').delete().eq('id', facturaId);
      if (error) throw error;
      toast({ title: 'Factura eliminada', description: 'El registro fue eliminado.' });
      setFacturas((prev) => prev.filter((f) => f.id !== facturaId));
      onUpdate?.();
    } catch (err) {
      console.error('Error en OCFacturas delete:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo eliminar.' });
    }
  }, [toast, onUpdate]);

  if (!oc) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Facturas</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled
                className="gap-1 opacity-60 cursor-not-allowed"
                title="Próximamente"
              >
                <FileText className="h-4 w-4" /> Subir PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled
                className="gap-1 opacity-60 cursor-not-allowed"
                title="Próximamente"
              >
                <FileCode className="h-4 w-4" /> Subir XML
              </Button>
              <Button size="sm" onClick={openDialog} className="gap-1">
                <PlusCircle className="h-4 w-4" /> Agregar factura
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Total facturado: <strong>{formatCurrency(totalFacturado)}</strong></span>
          </div>
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
<TableHeader>
                <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead className="w-28">Fecha</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="w-14 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {facturas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500 py-6">
                        Sin facturas registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    facturas.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-mono text-sm">{f.folio_factura ?? f.folio ?? '—'}</TableCell>
                        <TableCell className="text-sm">{f.fecha_emision ?? f.fecha ? formatDateTable(f.fecha_emision ?? f.fecha) : '—'}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(f.monto)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-red-600"
                            onClick={() => handleEliminarFactura(f.id)}
                            title="Eliminar factura"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar factura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAgregarFactura} className="space-y-4">
            <div>
              <Label htmlFor="fact_folio">Folio</Label>
              <Input
                id="fact_folio"
                value={form.folio}
                onChange={(e) => setForm((p) => ({ ...p, folio: e.target.value }))}
                placeholder="Folio fiscal"
              />
            </div>
            <div>
              <Label htmlFor="fact_fecha">Fecha</Label>
              <DatePicker id="fact_fecha" value={form.fecha} onChange={(fecha) => setForm((p) => ({ ...p, fecha }))} />
            </div>
            <div>
              <Label htmlFor="fact_monto">Monto *</Label>
              <Input
                id="fact_monto"
                type="number"
                step="0.01"
                min="0"
                value={form.monto}
                onChange={(e) => setForm((p) => ({ ...p, monto: e.target.value }))}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
