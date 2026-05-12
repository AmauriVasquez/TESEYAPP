import React, { useMemo } from 'react';
import FormatoReciboPagoTESEY from './FormatoReciboPagoTESEY';

/**
 * Comprobante de Ingreso: adapta (proyecto, pago, totalPagado) al formato
 * del recibo oficial TESEY e invoca FormatoReciboPagoTESEY.
 */
const ComprobanteIngreso = ({ proyecto, pago, totalPagado, onAfterPrint }) => {
  const pagoData = useMemo(() => {
    if (!proyecto || !pago) return null;
    const totalProyecto = Number(proyecto?.costo_total ?? 0);
    const montoEstePago = Number(pago?.monto ?? 0);
    const pagosAnteriores = Math.max(0, Number(totalPagado ?? 0) - montoEstePago);

    const clienteNombre = typeof proyecto.cliente === 'string'
      ? proyecto.cliente
      : (proyecto.cliente?.nombre ?? proyecto.cliente_nombre_externo ?? 'Cliente');

    const year = new Date().getFullYear();
    const folioRecibo = `REC-${year}-${String(pago.id ?? '').slice(-4).padStart(4, '0')}`;

    return {
      folio_recibo: folioRecibo,
      fecha_pago: pago.fecha_pago,
      folio_cotizacion: proyecto.cotizacion_folio || (proyecto.cotizacion_id ? `COT-${proyecto.cotizacion_id}` : 'N/A'),
      nombre_proyecto: proyecto?.descripcion || proyecto?.folio || 'Proyecto',
      cliente: {
        nombre: clienteNombre,
        rfc: proyecto.cliente_rfc || null,
      },
      concepto_pago: pago.comentarios || 'Pago a cuenta',
      forma_pago: pago.metodo_pago || 'No especificado',
      referencia_bancaria: pago.referencia_bancaria || null,
      banco_destino: pago.banco_destino || null,
      moneda: 'MXN',
      monto_total_proyecto: totalProyecto,
      pagos_anteriores: pagosAnteriores,
      monto_este_pago: montoEstePago,
    };
  }, [proyecto, pago, totalPagado]);

  return (
    <FormatoReciboPagoTESEY
      pagoData={pagoData}
      onPrint={onAfterPrint}
    />
  );
};

export default ComprobanteIngreso;
