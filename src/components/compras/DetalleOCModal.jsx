import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2 } from 'lucide-react';
import OCResumen from '@/components/oc/OCResumen';
import OCValidaciones from '@/components/oc/OCValidaciones';
import OCPagos from '@/components/oc/OCPagos';
import OCRecepcionMaterial from '@/components/oc/OCRecepcionMaterial';
import OCFacturas from '@/components/oc/OCFacturas';
import OCFinanzasResumen from '@/components/oc/OCFinanzasResumen';
import { unidadImpresionPedidoItem } from '@/lib/pedidoMaterialesItemHelpers';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

/**
 * Dashboard de control de OC: resumen, validaciones, pagos y partidas.
 * Recibe open, onOpenChange, oc (prop). Refresca OC al abrir y cuando los hijos actualizan.
 */
const DetalleOCModal = ({ open, onOpenChange, oc, onRefresh }) => {
  const { toast } = useToast();
  const [ocData, setOcData] = useState(null);
  const [partidas, setPartidas] = useState([]);
  const [pedidoInfo, setPedidoInfo] = useState(null);
  const [facturas, setFacturas] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [recepcionItems, setRecepcionItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const effectiveOC = ocData ?? oc;

  const fetchPartidasAndOC = useCallback(async () => {
    if (!open || !oc?.id) return;
    setLoading(true);
    try {
      const [pmiRes, ociRes, pedidoRes, ocRes, facturasRes, pagosRes] = await Promise.all([
        supabase
          .from('pedidos_materiales_items')
          .select('id, cantidad, precio_unitario, unidad_id, catalogo_unidades(nombre), materiales(descripcion, unidad_compra)')
          .eq('orden_compra_id', oc.id),
        supabase
          .from('ordenes_compra_items')
          .select('id, descripcion, unidad, cantidad, cantidad_recibida, precio_unitario, importe, material_id')
          .eq('orden_compra_id', oc.id),
        oc.pedido_id
          ? supabase.from('pedidos_materiales').select('id, folio, proyecto:proyecto_id(descripcion, folio), cuenta').eq('id', oc.pedido_id).single()
          : { data: null },
        supabase.from('ordenes_compra').select('*, proveedores(nombre_comercial, banco, cuenta_bancaria, datos_bancarios)').eq('id', oc.id).single(),
        supabase.from('oc_facturas').select('*').eq('oc_id', oc.id).order('fecha', { ascending: false }),
        supabase.from('oc_pagos').select('*').eq('oc_id', oc.id).order('fecha', { ascending: false }),
      ]);

      const ociList = ociRes.data ?? [];
      const pmiList = pmiRes.data ?? [];

      const fromOcItems = ociList.map((it, idx) => ({
        tipo: 'oc_item',
        pda: idx + 1,
        descripcion: it.descripcion ?? '—',
        unidad: it.unidad ?? '—',
        cantidad: Number(it.cantidad) || 0,
        precio_unitario: Number(it.precio_unitario) || 0,
        importe:
          it.importe != null && it.importe !== ''
            ? Number(it.importe)
            : (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
      }));

      const fromPedido = (pmiList ?? []).map((it, idx) => ({
        tipo: 'pedido',
        pda: idx + 1,
        descripcion: it.materiales?.descripcion ?? '—',
        unidad: unidadImpresionPedidoItem(it),
        cantidad: Number(it.cantidad) || 0,
        precio_unitario: Number(it.precio_unitario) || 0,
        importe: (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0),
      }));

      const unified =
        ociList.length > 0
          ? fromOcItems.map((p, i) => ({ ...p, pda: i + 1 }))
          : [...fromPedido].map((p, i) => ({ ...p, pda: i + 1 }));

      setPartidas(unified);
      setPedidoInfo(pedidoRes?.data ?? null);
      setFacturas(facturasRes?.data ?? []);
      setPagos(pagosRes?.data ?? []);
      setRecepcionItems(
        ociList.map((it) => ({
          id: it.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          cantidad_recibida: it.cantidad_recibida,
          precio_unitario: it.precio_unitario,
        }))
      );
      if (ocRes?.data) {
        setOcData({ ...ocRes.data, proveedores: oc?.proveedores ?? ocRes.data?.proveedores, proveedor: oc?.proveedor ?? ocRes.data?.proveedor });
      }
    } catch (err) {
      console.error('Error en DetalleOCModal fetch:', err);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
    } finally {
      setLoading(false);
    }
  }, [open, oc?.id, oc?.pedido_id, oc?.proveedores, oc?.proveedor, toast]);

  useEffect(() => {
    if (!open || !oc?.id) {
      setPartidas([]);
      setPedidoInfo(null);
      setOcData(null);
      setFacturas([]);
      setPagos([]);
      setRecepcionItems([]);
      return;
    }
    setOcData(oc);
    fetchPartidasAndOC();
  }, [open, oc?.id, fetchPartidasAndOC]);

  const handleRefreshOC = useCallback(async () => {
    if (!oc?.id) return;
    try {
      const [ocRes, facturasRes, pagosRes, recepcionRes] = await Promise.all([
        supabase.from('ordenes_compra').select('*, proveedores(nombre_comercial, banco, cuenta_bancaria, datos_bancarios)').eq('id', oc.id).single(),
        supabase.from('oc_facturas').select('*').eq('oc_id', oc.id).order('fecha', { ascending: false }),
        supabase.from('oc_pagos').select('*').eq('oc_id', oc.id).order('fecha', { ascending: false }),
        supabase.from('ordenes_compra_items').select('id, descripcion, cantidad, cantidad_recibida, precio_unitario').eq('orden_compra_id', oc.id),
      ]);
      if (ocRes?.data) setOcData({ ...ocRes.data, proveedores: oc?.proveedores ?? ocRes.data?.proveedores, proveedor: oc?.proveedor ?? ocRes.data?.proveedor });
      setFacturas(facturasRes?.data ?? []);
      setPagos(pagosRes?.data ?? []);
      setRecepcionItems(recepcionRes?.data ?? []);
      onRefresh?.();
    } catch (err) {
      console.error('Error al refrescar OC:', err);
    }
  }, [oc?.id, oc?.proveedores, oc?.proveedor, onRefresh]);

  const montoTotalCalculado = useMemo(
    () => partidas.reduce((s, p) => s + (p.importe ?? 0), 0),
    [partidas]
  );
  const montoTotal = effectiveOC?.monto_total != null && !Number.isNaN(Number(effectiveOC.monto_total))
    ? Number(effectiveOC.monto_total)
    : montoTotalCalculado;

  const totalFacturado = useMemo(() => facturas.reduce((s, f) => s + (Number(f.monto) || 0), 0), [facturas]);
  const totalPagado = useMemo(() => pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0), [pagos]);
  const valorRecibido = useMemo(
    () => recepcionItems.reduce((s, i) => s + (Number(i.cantidad_recibida) || 0) * (Number(i.precio_unitario) || 0), 0),
    [recepcionItems]
  );
  const isEntregado = useMemo(
    () => recepcionItems.length > 0 && recepcionItems.every((i) => (Number(i.cantidad_recibida) || 0) >= (Number(i.cantidad) || 0)),
    [recepcionItems]
  );
  const isPagado = useMemo(() => montoTotal > 0 && totalPagado >= montoTotal, [montoTotal, totalPagado]);
  const isValidado = Boolean(effectiveOC?.validacion_admin && effectiveOC?.validacion_contraentrega);

  const nuevoEstatus = useMemo(() => {
    if (isEntregado && isValidado && !isPagado) return 'Pendiente de Pago';
    if (isPagado && isValidado && !isEntregado) return 'Pendiente de Entrega';
    if (isPagado && isEntregado && isValidado) return 'Completada';
    return 'Pendiente';
  }, [isEntregado, isPagado, isValidado]);

  useEffect(() => {
    if (!oc?.id || !effectiveOC) return;
    const current = effectiveOC.estatus ?? 'Pendiente';
    if (nuevoEstatus === current) return;
    supabase
      .from('ordenes_compra')
      .update({ estatus: nuevoEstatus })
      .eq('id', oc.id)
      .then(({ error }) => {
        if (error) console.error('Error al actualizar estatus:', error);
        else setOcData((prev) => (prev ? { ...prev, estatus: nuevoEstatus } : prev));
      });
  }, [oc?.id, effectiveOC, nuevoEstatus]);

  const canEnableContraentrega = isEntregado && Math.abs(totalFacturado - valorRecibido) < 0.01;

  if (!oc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] overflow-hidden flex flex-col w-full">
        <DialogHeader>
          <DialogTitle>Dashboard — Orden de Compra {effectiveOC?.folio_oc ?? effectiveOC?.folio ?? oc.folio_oc ?? '—'}</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 space-y-6">
          <OCResumen
            oc={effectiveOC}
            montoTotalCalculado={montoTotalCalculado}
            estatusOverride={nuevoEstatus}
          />

          <OCRecepcionMaterial oc={effectiveOC} onUpdate={handleRefreshOC} />

          {/* Fila superior: entrada de documentos y dinero */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
            <OCFacturas oc={effectiveOC} onUpdate={handleRefreshOC} />
            <OCPagos oc={effectiveOC} montoTotal={montoTotal} onUpdate={handleRefreshOC} />
          </div>

          {/* Fila inferior: revisión y autorización */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-w-0">
            <OCValidaciones
              oc={effectiveOC}
              onUpdate={handleRefreshOC}
              canEnableContraentrega={canEnableContraentrega}
            />
            <OCFinanzasResumen
              montoTotal={montoTotal}
              totalFacturado={totalFacturado}
              totalPagado={totalPagado}
              saldoPendiente={Math.max(0, montoTotal - totalPagado)}
              condicionesPago={effectiveOC?.condiciones_pago}
              subtotal={partidas.length > 0 ? partidas.reduce((s, p) => s + (p.importe ?? 0), 0) : undefined}
              tasaIva={effectiveOC?.tasa_iva}
              ieps={effectiveOC?.monto_ieps ?? effectiveOC?.ieps}
              retencionIva={effectiveOC?.retencion_iva}
              retencionIsr={effectiveOC?.retencion_isr}
            />
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-2">Partidas</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-center px-2 py-2 font-medium w-12">PDA.</th>
                      <th className="text-left px-2 py-2 font-medium">Descripción</th>
                      <th className="text-center px-2 py-2 font-medium w-20">Unidad</th>
                      <th className="text-right px-2 py-2 font-medium w-20">Cantidad</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Precio unit.</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {partidas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-gray-500 py-8">Sin partidas.</td>
                      </tr>
                    ) : (
                      partidas.map((p) => (
                        <tr key={p.pda} className="hover:bg-gray-50">
                          <td className="px-2 py-2 text-center">{p.pda}</td>
                          <td className="px-2 py-2">{p.descripcion}</td>
                          <td className="px-2 py-2 text-center">{p.unidad}</td>
                          <td className="px-2 py-2 text-right">{p.cantidad}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(p.precio_unitario)}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(p.importe)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {partidas.length > 0 && (() => {
              const sub = partidas.reduce((s, p) => s + (p.importe ?? 0), 0);
              const tasa = effectiveOC?.tasa_iva != null && !Number.isNaN(Number(effectiveOC.tasa_iva)) ? Number(effectiveOC.tasa_iva) : 16;
              const iva = sub * (tasa / 100);
              const iepsVal = Number(effectiveOC?.monto_ieps ?? effectiveOC?.ieps) || 0;
              const retIvaVal = Number(effectiveOC?.retencion_iva) || 0;
              const retIsrVal = Number(effectiveOC?.retencion_isr) || 0;
              const totalNeto = sub + iva + iepsVal - retIvaVal - retIsrVal;
              return (
                <div className="mt-2 bg-gray-50 rounded-lg p-4 text-sm space-y-1">
                  <div className="flex justify-end gap-6">
                    <span>Subtotal: <strong>{formatCurrency(sub)}</strong></span>
                    <span>I.V.A. ({tasa}%): <strong>{formatCurrency(iva)}</strong></span>
                  </div>
                  {(iepsVal > 0 || retIvaVal > 0 || retIsrVal > 0) && (
                    <div className="flex justify-end gap-4 text-gray-600">
                      {iepsVal > 0 && <span>IEPS: <strong className="text-gray-800">{formatCurrency(iepsVal)}</strong></span>}
                      {retIvaVal > 0 && <span className="text-red-600">Ret. IVA: −{formatCurrency(retIvaVal)}</span>}
                      {retIsrVal > 0 && <span className="text-red-600">Ret. ISR: −{formatCurrency(retIsrVal)}</span>}
                    </div>
                  )}
                  <div className="flex justify-end pt-1 border-t border-gray-200">
                    <span>Total: <strong>{formatCurrency(montoTotal > 0 ? montoTotal : totalNeto)}</strong></span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DetalleOCModal;
