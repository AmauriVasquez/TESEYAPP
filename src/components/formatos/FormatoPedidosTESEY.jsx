import React from 'react';
import PedidoMaterialPrint from '@/components/print/PedidoMaterialPrint';

/** Vista envuelta para previsualización fuera del modal de impresión; el documento puro es PedidoMaterialPrint. */
const FormatoPedidosTESEY = ({ pedidoData = {} }) => (
  <div className="flex flex-col items-center w-full bg-gray-100 p-6 rounded-xl print:bg-white print:p-0">
    <PedidoMaterialPrint data={pedidoData} variant="TESEY" />
  </div>
);

export default FormatoPedidosTESEY;
