import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDateTable } from '@/lib/dateUtils';
import { Loader2, Eye, Printer, Ban, PlusCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import FormatoOCImpresion from './FormatoOCImpresion';
import NuevaOCDirectaModal from './NuevaOCDirectaModal';
import DetalleOCModal from './DetalleOCModal';
import { unidadImpresionPedidoItem } from '@/lib/pedidoMaterialesItemHelpers';
import { PermissionGate } from '@/components/auth/PermissionGate';

const OPCIONES_ESTATUS = [
  { value: 'Pendiente de Validación', label: 'Pendiente de Validación', color: 'amber' },
  { value: 'Pendiente de Pago', label: 'Pendiente de Pago', color: 'orange' },
  { value: 'Pendiente de Entrega', label: 'Pendiente de Entrega', color: 'blue' },
  { value: 'Completada', label: 'Completada', color: 'green' },
  { value: 'Cancelada', label: 'Cancelada', color: 'red' }
];

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

const OrdenesCompraTab = () => {
  const { toast } = useToast();
  const [ordenes, setOrdenes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState(null);
  const [printOC, setPrintOC] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [nuevaOCDirectaOpen, setNuevaOCDirectaOpen] = useState(false);
  const [viewOC, setViewOC] = useState(null);
  const [updatingEstatusId, setUpdatingEstatusId] = useState(null);

  const fetchOrdenes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordenes_compra')
        .select('*, proveedores(nombre_comercial), empresas(nombre)')
        .order('id', { ascending: false });
      if (error) throw error;
      setOrdenes(data ?? []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar las órdenes de compra.' });
      setOrdenes([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchOrdenes();
  }, [fetchOrdenes]);

  const pendientesValidacion = ordenes.filter((o) => String(o.estatus || '').toLowerCase().includes('validación')).length;
  const pendientesPago = ordenes.filter((o) => String(o.estatus || '').toLowerCase().includes('pago')).length;
  const pendientesEntrega = ordenes.filter((o) => String(o.estatus || '').toLowerCase().includes('entrega')).length;

  const handleEstatusChange = async (ocId, newEstatus) => {
    setUpdatingEstatusId(ocId);
    try {
      const { error } = await supabase.from('ordenes_compra').update({ estatus: newEstatus }).eq('id', ocId);
      if (error) throw error;
      toast({ title: 'Estatus actualizado', description: `Cambiado a "${newEstatus}".` });
      fetchOrdenes();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo actualizar el estatus.' });
    } finally {
      setUpdatingEstatusId(null);
    }
  };

  const handleCancel = async (id) => {
    try {
      const { error } = await supabase.from('ordenes_compra').update({ estatus: 'Cancelada' }).eq('id', id);
      if (error) throw error;
      toast({ title: 'OC cancelada', description: 'La orden de compra fue marcada como Cancelada.' });
      setCancelId(null);
      fetchOrdenes();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: err?.message ?? 'No se pudo cancelar.' });
    }
  };

  const handlePrintClick = useCallback(async (oc) => {
    setPrintOC(oc);
    setPrintData(null);
    try {
      const [pmiRes, ociRes, pedidoRes] = await Promise.all([
        supabase
          .from('pedidos_materiales_items')
          .select('id, cantidad, precio_unitario, material_id, unidad_id, catalogo_unidades(nombre), materiales(descripcion, unidad_compra)')
          .eq('orden_compra_id', oc.id),
        supabase
          .from('ordenes_compra_items')
          .select('id, descripcion, unidad, cantidad, precio_unitario, importe, material_id')
          .eq('orden_compra_id', oc.id),
       oc.pedido_id
          ? supabase
              .from('pedidos_materiales')
              .select('id, folio, proyecto:proyecto_id(descripcion, folio), cuenta')
              .eq('id', oc.pedido_id)
              .single()
          : { data: null }
      ]);
      const ociRows = ociRes.data ?? [];
      const pmiRows = pmiRes.data ?? [];

      const fromOcItems = ociRows.map((it, idx) => ({
        pda: idx + 1,
        clave: it.material_id ?? '—',
        descripcion: it.descripcion ?? '—',
        unidad: it.unidad ?? '—',
        cantidad: Number(it.cantidad) || 0,
        valor_unitario: Number(it.precio_unitario) || 0,
        importe:
          it.importe != null && it.importe !== ''
            ? Number(it.importe)
            : (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
      }));

      const fromPedido = (pmiRows ?? []).map((it, idx) => ({
        pda: idx + 1,
        clave: it.materiales?.clave ?? it.material_id ?? '—',
        descripcion: it.materiales?.descripcion ?? '—',
        unidad: unidadImpresionPedidoItem(it),
        cantidad: Number(it.cantidad) || 0,
        valor_unitario: Number(it.precio_unitario) || 0,
        importe: (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
      }));

      const partidas =
        ociRows.length > 0
          ? fromOcItems.map((p, i) => ({ ...p, pda: i + 1 }))
          : fromPedido.map((p, i) => ({ ...p, pda: i + 1 }));
      const pedido = pedidoRes.data;
      const subtotal = partidas.reduce((s, i) => s + i.importe, 0);
      const iva = subtotal * 0.16;
      const total = subtotal + iva;
      const fecha = oc.created_at || oc.fecha || new Date().toISOString();
      const d = new Date(fecha);
      setPrintData({
        folio_oc: oc.folio ?? oc.folio_oc,
        fecha: d,
        hora: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
        orden_pedido: pedido?.folio ?? (pedido?.proyecto?.descripcion ?? pedido?.cuenta) ?? (oc.proyecto_cuenta ?? '—'),
        proveedor: oc.proveedores?.nombre_comercial ?? oc.proveedor?.nombre_comercial ?? '—',
        proyecto_cuenta: pedido ? (pedido.proyecto?.descripcion ?? pedido.proyecto?.folio ?? pedido.cuenta ?? '—') : (oc.proyecto_cuenta ?? '—'),
        partidas,
        subtotal,
        iva,
        impuestos_retenidos: 0,
        total,
        comprador: oc.comprador ?? '—',
        solicitante: oc.solicitante ?? '—',
        descripcion_pedido: oc.descripcion_pedido ?? oc.descripcion ?? '—',
        moneda: oc.moneda ?? 'MXN',
        empresa: oc.empresas?.nombre ?? oc.empresa ?? '—',
        observaciones_generales: oc.observaciones ?? '',
        condicion_pago: oc.condicion_pago ?? oc.forma_pago ?? '—',
        metodo_pago: oc.metodo_pago ?? '—',
        retenciones_monto: oc.impuestos_retenidos ?? 0,
        iva_pct: 16,
        parcialidades: oc.parcialidades ?? [],
        cuentas_bancarias: oc.cuentas_bancarias ?? []
      });
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar la OC para imprimir.' });
      setPrintOC(null);
    }
  }, [toast]);

  const getSubtotalIvaTotal = (oc) => {
    if (oc.subtotal != null && oc.iva != null && oc.total != null) {
      return { subtotal: oc.subtotal, iva: oc.iva, total: oc.total };
    }
    return { subtotal: null, iva: null, total: null };
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          <div className="flex flex-nowrap overflow-x-auto gap-4 pb-2 snap-x md:grid md:grid-cols-3 md:overflow-visible md:pb-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="min-w-[220px] md:min-w-0 snap-center shrink-0 rounded-xl border bg-amber-50 border-amber-200 p-3 md:p-4">
              <p className="text-xs md:text-sm font-medium text-amber-800">🟡 Pendientes de Validación</p>
              <p className="text-xl md:text-2xl font-bold text-amber-900">{pendientesValidacion}</p>
            </div>
            <div className="min-w-[220px] md:min-w-0 snap-center shrink-0 rounded-xl border bg-orange-50 border-orange-200 p-3 md:p-4">
              <p className="text-xs md:text-sm font-medium text-orange-800">🟠 Pendientes de Pago</p>
              <p className="text-xl md:text-2xl font-bold text-orange-900">{pendientesPago}</p>
            </div>
            <div className="min-w-[220px] md:min-w-0 snap-center shrink-0 rounded-xl border bg-blue-50 border-blue-200 p-3 md:p-4">
              <p className="text-xs md:text-sm font-medium text-blue-800">🔵 Pendientes de Entrega</p>
              <p className="text-xl md:text-2xl font-bold text-blue-900">{pendientesEntrega}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <PermissionGate modulo="compras" accion="crear" submodulo="ordenes">
              <Button onClick={() => setNuevaOCDirectaOpen(true)} className="gap-1.5 h-8 px-3 text-xs md:h-10 md:px-4 md:text-sm bg-emerald-600 hover:bg-emerald-700">
                <PlusCircle className="w-3.5 h-3.5 md:w-4 md:h-4" /> Nueva OC
              </Button>
            </PermissionGate>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Folio</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Proveedor</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Subtotal</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">IVA</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Estatus</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600 w-32">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {ordenes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-gray-500 py-12">
                        No hay órdenes de compra registradas.
                      </td>
                    </tr>
                  ) : (
                    ordenes.map((oc) => {
                      const { subtotal, iva, total } = getSubtotalIvaTotal(oc);
                      const proveedorNombre = oc.proveedores?.nombre_comercial ?? oc.proveedor?.nombre_comercial ?? '—';
                      const fecha = oc.created_at ?? oc.fecha;
                      return (
                        <tr key={oc.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono font-medium">{oc.folio ?? oc.folio_oc ?? '—'}</td>
                          <td className="px-4 py-3">{fecha ? formatDateTable(fecha) : '—'}</td>
                          <td className="px-4 py-3">{proveedorNombre}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(subtotal)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(iva)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(total)}</td>
                          <td className="px-4 py-3">
                            <Select
                              value={oc.estatus ?? ''}
                              onValueChange={(v) => handleEstatusChange(oc.id, v)}
                              disabled={updatingEstatusId === oc.id}
                            >
                              <SelectTrigger className={cn(
                                'h-7 text-xs w-full max-w-[160px] md:h-8 md:max-w-[180px]',
                                oc.estatus === 'Pendiente de Validación' && 'border-amber-300 bg-amber-50',
                                oc.estatus === 'Pendiente de Pago' && 'border-orange-300 bg-orange-50',
                                oc.estatus === 'Pendiente de Entrega' && 'border-blue-300 bg-blue-50',
                                oc.estatus === 'Completada' && 'border-green-300 bg-green-50',
                                oc.estatus === 'Cancelada' && 'border-red-300 bg-red-50'
                              )}>
                                <SelectValue placeholder="Estatus" />
                              </SelectTrigger>
                              <SelectContent>
                                {OPCIONES_ESTATUS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-0.5 md:gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-gray-500 hover:text-blue-600" title="Ver" onClick={() => setViewOC(oc)}>
                                <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 md:h-8 md:w-8 text-gray-500 hover:text-gray-700" title="Imprimir" onClick={() => handlePrintClick(oc)}>
                                <Printer className="w-3.5 h-3.5 md:w-4 md:h-4" />
                              </Button>
                              <PermissionGate modulo="compras" accion="editar" submodulo="ordenes">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 md:h-8 md:w-8 text-gray-500 hover:text-red-600 disabled:opacity-40"
                                  title={oc.estatus === 'Cancelada' ? 'OC cancelada' : 'Cancelar OC'}
                                  disabled={oc.estatus === 'Cancelada'}
                                  onClick={() => setCancelId(oc.id)}
                                >
                                  <Ban className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar orden de compra?</AlertDialogTitle>
            <AlertDialogDescription>
              La OC se marcará como <strong>Cancelada</strong> y dejará de contar en los pendientes.
              No se elimina: queda en el histórico para trazabilidad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelId && handleCancel(cancelId)} className="bg-red-600 hover:bg-red-700">
              Cancelar OC
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {printOC && printData && (
        <FormatoOCImpresion
          data={printData}
          onClose={() => { setPrintOC(null); setPrintData(null); }}
        />
      )}

      <NuevaOCDirectaModal
        open={nuevaOCDirectaOpen}
        onOpenChange={setNuevaOCDirectaOpen}
        onSuccess={fetchOrdenes}
      />

      <DetalleOCModal
        open={!!viewOC}
        onOpenChange={(open) => !open && setViewOC(null)}
        oc={viewOC ?? undefined}
        onRefresh={fetchOrdenes}
      />
    </div>
  );
};

export default OrdenesCompraTab;
