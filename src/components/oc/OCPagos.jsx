import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
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
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { formatDateTable } from '@/lib/dateUtils';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

/**
 * Control de pagos: resumen financiero, barra de progreso, tabla de pagos y formulario registrar pago.
 * Consulta oc_pagos por oc_id. Inserta en oc_pagos al registrar.
 */
export default function OCPagos({ oc, montoTotal, onUpdate }) {
  const { toast } = useToast();
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ monto: '', fecha: '', metodo_pago: '', referencia: '' });

  const METODOS_PAGO = ['Efectivo', 'BANREGIO-NOFISCAL', 'BBVA-FISCAL'];

  const openDialog = () => {
    setForm({ monto: '', fecha: new Date().toISOString().slice(0, 10), metodo_pago: '', referencia: '' });
    setDialogOpen(true);
  };

  const fetchPagos = useCallback(async () => {
    if (!oc?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('oc_pagos')
        .select('*')
        .eq('orden_compra_id', oc.id)
        .order('fecha_pago', { ascending: false });
      if (error) throw error;
      setPagos(data ?? []);
    } catch (err) {
      console.error('Error en OCPagos fetch:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los pagos.' });
      setPagos([]);
    } finally {
      setLoading(false);
    }
  }, [oc?.id, toast]);

  useEffect(() => {
    if (oc?.id) fetchPagos();
  }, [oc?.id, fetchPagos]);

  const totalPagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const montoOC = montoTotal ?? oc?.monto_total ?? 0;
  const saldo = Math.max(0, Number(montoOC) - totalPagado);
  const progress = Number(montoOC) > 0 ? Math.min(100, (totalPagado / Number(montoOC)) * 100) : 0;

  const handleRegistrarPago = async (e) => {
    e?.preventDefault();
    const montoNum = parseFloat(form.monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Monto inválido.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('oc_pagos').insert({
        orden_compra_id: oc.id,
        monto: montoNum,
        fecha_pago: (form.fecha || '').trim() || new Date().toISOString().slice(0, 10),
        metodo_pago: (form.metodo_pago || '').trim() || null,
        referencia: (form.referencia || '').trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Pago registrado', description: formatCurrency(montoNum) + ' registrado.' });
      setDialogOpen(false);
      setForm({ monto: '', fecha: '', metodo_pago: '', referencia: '' });
      fetchPagos();
      onUpdate?.();
    } catch (err) {
      console.error('Error en OCPagos insert:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo registrar el pago.' });
    } finally {
      setSaving(false);
    }
  };

  const handleEliminarPago = useCallback(async (pagoId) => {
    if (!window.confirm('¿Estás seguro de eliminar este pago? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('oc_pagos').delete().eq('id', pagoId);
      if (error) throw error;
      toast({ title: 'Pago eliminado', description: 'El registro fue eliminado.' });
      setPagos((prev) => prev.filter((p) => p.id !== pagoId));
      onUpdate?.();
    } catch (err) {
      console.error('Error en OCPagos delete:', err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo eliminar.' });
    }
  }, [toast, onUpdate]);

  if (!oc) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Control de pagos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total OC</span>
              <span className="font-medium">{formatCurrency(montoOC)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total pagado</span>
              <span className="font-medium text-green-700">{formatCurrency(totalPagado)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Saldo pendiente</span>
              <span className="font-medium">{formatCurrency(saldo)}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">Pagos registrados</h4>
              <Button size="sm" onClick={openDialog} className="gap-1">
                <PlusCircle className="h-4 w-4" /> Registrar pago
              </Button>
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
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="w-14 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-gray-500 py-6">
                          Sin pagos registrados.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagos.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-sm">{p.fecha_pago ?? p.fecha ? formatDateTable(p.fecha_pago ?? p.fecha) : '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(p.monto)}</TableCell>
                          <TableCell className="text-sm">{p.metodo_pago ?? '—'}</TableCell>
                          <TableCell className="text-sm font-mono">{p.referencia ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-500 hover:text-red-600"
                              onClick={() => handleEliminarPago(p.id)}
                              title="Eliminar pago"
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
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pago</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRegistrarPago} className="space-y-4">
            <div>
              <Label htmlFor="pago_monto">Monto *</Label>
              <Input
                id="pago_monto"
                type="number"
                step="0.01"
                min="0.01"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="pago_fecha">Fecha</Label>
              <DatePicker id="pago_fecha" value={form.fecha} onChange={(fecha) => setForm((f) => ({ ...f, fecha }))} />
            </div>
            <div>
              <Label htmlFor="pago_metodo">Método de pago</Label>
              <Select
                value={form.metodo_pago || ''}
                onValueChange={(v) => setForm((f) => ({ ...f, metodo_pago: v }))}
              >
                <SelectTrigger id="pago_metodo">
                  <SelectValue placeholder="Selecciona método..." />
                </SelectTrigger>
                <SelectContent>
                  {METODOS_PAGO.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pago_ref">Referencia</Label>
              <Input
                id="pago_ref"
                value={form.referencia}
                onChange={(e) => setForm((f) => ({ ...f, referencia: e.target.value }))}
                placeholder="Número de referencia"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
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
