import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

function formatCurrency(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value));
}

/**
 * Resumen financiero: Plan de Pagos, Subtotal/IVA/IEPS/Retenciones (opcional), Total OC, Total Facturado, Total Pagado, Saldo.
 * progress = totalPagado / montoTotal (pago vs OC).
 * condicionesPago: array JSON o string; si vacío se muestra "Pago al Contado (100%)".
 * subtotal, tasaIva, ieps, retencionIva, retencionIsr: opcionales; si se pasan, se muestra desglose y filas IEPS/Ret solo si > 0.
 */
export default function OCFinanzasResumen({
  montoTotal,
  totalFacturado,
  totalPagado,
  saldoPendiente,
  condicionesPago,
  subtotal,
  tasaIva,
  ieps,
  retencionIva,
  retencionIsr,
  className,
}) {
  const monto = Number(montoTotal) || 0;
  const facturado = Number(totalFacturado) || 0;
  const pagado = Number(totalPagado) || 0;
  const saldo = Number(saldoPendiente) ?? Math.max(0, monto - pagado);
  const progress = monto > 0 ? Math.min(100, (pagado / monto) * 100) : 0;
  const sub = subtotal != null && !Number.isNaN(Number(subtotal)) ? Number(subtotal) : null;
  const tasa = tasaIva != null && !Number.isNaN(Number(tasaIva)) ? Number(tasaIva) : 16;
  const ivaCalc = sub != null ? sub * (tasa / 100) : null;
  const iepsVal = ieps != null && !Number.isNaN(Number(ieps)) ? Number(ieps) : 0;
  const retIvaVal = retencionIva != null && !Number.isNaN(Number(retencionIva)) ? Number(retencionIva) : 0;
  const retIsrVal = retencionIsr != null && !Number.isNaN(Number(retencionIsr)) ? Number(retencionIsr) : 0;

  const planPagos = (() => {
    const raw = condicionesPago ?? null;
    if (raw == null || (Array.isArray(raw) && raw.length === 0)) return null;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return Array.isArray(raw) ? raw : null;
  })();

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">Resumen financiero</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Plan de Pagos Acordado</p>
          {planPagos == null || planPagos.length === 0 ? (
            <p className="text-sm text-gray-600">Pago al Contado (100%)</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {planPagos.map((item, idx) => {
                const concepto = item?.concepto ?? '—';
                const porcentaje = Number(item?.porcentaje) || 0;
                const montoPartida = monto > 0 ? (monto * porcentaje) / 100 : 0;
                return (
                  <li key={idx} className="flex justify-between items-center">
                    <span className="text-gray-700">{concepto} ({porcentaje}%)</span>
                    <span className="font-medium">{formatCurrency(montoPartida)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {sub != null && (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">{formatCurrency(sub)}</span>
            </div>
            {tasa > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">I.V.A. ({tasa}%)</span>
                <span className="font-medium">{formatCurrency(ivaCalc)}</span>
              </div>
            )}
            {iepsVal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">IEPS</span>
                <span className="font-medium">{formatCurrency(iepsVal)}</span>
              </div>
            )}
            {retIvaVal > 0 && (
              <div className="flex justify-between text-sm text-red-700">
                <span>Ret. IVA</span>
                <span className="font-medium">−{formatCurrency(retIvaVal)}</span>
              </div>
            )}
            {retIsrVal > 0 && (
              <div className="flex justify-between text-sm text-red-700">
                <span>Ret. ISR</span>
                <span className="font-medium">−{formatCurrency(retIsrVal)}</span>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total OC</span>
          <span className="font-medium">{formatCurrency(monto)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total facturado</span>
          <span className="font-medium">{formatCurrency(facturado)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Total pagado</span>
          <span className="font-medium text-green-700">{formatCurrency(pagado)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Saldo pendiente</span>
          <span className="font-medium">{formatCurrency(saldo)}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </CardContent>
    </Card>
  );
}
