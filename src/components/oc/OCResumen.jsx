import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { entregaBadgeKeyFromDb, entregaLabelFromKey } from '@/lib/ordenesCompraRecepcion';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

const ESTATUS_BADGE_CLASS = {
  'Pendiente': 'bg-gray-100 text-gray-700 border-gray-300',
  'Pendiente de Validación': 'bg-amber-100 text-amber-800 border-amber-300',
  'Pendiente de Pago': 'bg-amber-100 text-amber-800 border-amber-300',
  'Pendiente de Entrega': 'bg-blue-100 text-blue-800 border-blue-300',
  'Pagado': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Completada': 'bg-green-100 text-green-800 border-green-300',
  'Cancelada': 'bg-red-100 text-red-800 border-red-300',
};

const ENTREGA_BADGE_CLASS = {
  pendiente: 'bg-gray-100 text-gray-700 border-gray-300',
  parcial: 'bg-amber-100 text-amber-800 border-amber-300',
  completa: 'bg-green-100 text-green-800 border-green-300',
};

/**
 * Resumen superior del dashboard: folio, proveedor, monto y badges de estatus/entrega.
 * oc: objeto de orden (folio_oc o folio, proveedores/proveedor, monto_total o calculado)
 * estatusOverride: estatus calculado por el motor (prioridad sobre oc.estatus para reflejar tiempo real)
 */
export default function OCResumen({ oc, montoTotalCalculado, estatusOverride }) {
  if (!oc) return null;

  const folioBase = oc.folio_oc ?? oc.folio ?? '—';
  const version = Number(oc.version) || 1;
  const folio = version > 1 ? `${folioBase} v${version}` : folioBase;
  const proveedorNombre = oc.proveedores?.nombre_comercial ?? oc.proveedor ?? '—';
  const monto = oc.monto_total != null && !Number.isNaN(Number(oc.monto_total))
    ? Number(oc.monto_total)
    : montoTotalCalculado;
  const estatus = estatusOverride ?? oc.estatus ?? 'Pendiente';
  const entregaKey = entregaBadgeKeyFromDb(oc.estado_entrega);

  const proveedor = oc.proveedores ?? oc.proveedor;
  const banco = proveedor?.banco ?? proveedor?.datos_bancarios ?? null;
  const cuentaBancaria = proveedor?.cuenta_bancaria ?? null;
  const empresa = oc.empresa ?? '—';
  const proyectoTexto = oc.proyecto_texto ?? '—';

  return (
    <Card className="col-span-full">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold font-mono text-gray-900">{folio}</h2>
            <p className="text-sm text-gray-600 mt-0.5">Proveedor: {proveedorNombre}</p>
            <p className="text-sm text-gray-600 mt-0.5"><span className="font-medium">Empresa:</span> {empresa}</p>
            <p className="text-sm text-gray-600 mt-0.5"><span className="font-medium">Proyecto/Cuenta:</span> {proyectoTexto}</p>
            {(banco != null || cuentaBancaria != null) && (
              <p className="text-sm text-gray-600 mt-1">
                <span className="font-medium">Datos bancarios proveedor:</span> Banco: {banco || 'No registrado'} — Cuenta: {cuentaBancaria || 'No registrado'}
              </p>
            )}
            <p className="text-lg font-semibold text-gray-900 mt-2">{formatCurrency(monto)} MXN</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={cn('border', ESTATUS_BADGE_CLASS[estatus] ?? 'bg-gray-100 text-gray-700 border-gray-300')}
            >
              {estatus}
            </Badge>
            <Badge
              className={cn('border', ENTREGA_BADGE_CLASS[entregaKey] ?? ENTREGA_BADGE_CLASS.pendiente)}
            >
              {entregaLabelFromKey(entregaKey)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
