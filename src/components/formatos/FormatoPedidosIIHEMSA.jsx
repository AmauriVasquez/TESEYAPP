import React from 'react';
import PedidoMaterialPrint from '@/components/print/PedidoMaterialPrint';

const FormatoPedidosIIHEMSA = ({ pedidoData = {} }) => (
  <div className="flex flex-col items-center w-full bg-gray-100 p-6 rounded-xl print:bg-white print:p-0">
    <PedidoMaterialPrint data={pedidoData} variant="IIHEMSA" />
  </div>
);

export default FormatoPedidosIIHEMSA;
