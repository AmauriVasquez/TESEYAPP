import React, { useState, useEffect } from 'react';
import FormatoOCTESEY from '../formatos/FormatoOCTESEY';
import FormatoOCIIHEMSA from '../formatos/FormatoOCIIHEMSA';
import FormatoOCMSM from '../formatos/FormatoOCMSM';
import { X } from 'lucide-react';

// Datos de ejemplo para pruebas (integrar con tu API/estado real)
const ejemploOrdenCompra = {
  folio: 'OC-2026-0000',
  fecha: '13/03/2026',
  empresa: 'TESEY',
  proveedor: 'PRAXAIR, S.A. DE C.V.',
  proyecto: 'MANTENIMIENTO GENERAL - PLANTA X',
  descripcion: 'Adquisición de gases industriales para el área de producción.',
  moneda: 'MXN',
  comprador: 'Samuel Cruz',
  solicitante: 'Hannia Vasquez',
  empresa_datos: {
    nombre: 'Tecnomaquila y Servicios de Yucatán',
    rfc: 'TSY221213TIA',
    calle: 'CALLE 24 # 73-4',
    colonia: 'RESID. XCANATUN',
    ciudad: 'MÉRIDA',
    estado: 'YUC.',
    cp: 'C.P. 97302',
    regimen: '626 Régimen Simplificado de Confianza',
  },
  conceptos: [
    { id: 1, clave: 'GAS-PRO-001', concepto: 'Corte de CELOSIA ACERO NEGRO DE 1/4"', descripcion: 'Diseño seleccionado por el cliente, incluye material (medidas proporcionadas por el cliente)', cant: 1, unid: 'SERVICIO', pUnitario: 15070.0, importe: 15070.0 },
    { id: 2, clave: 'GAS-IND-005', concepto: 'Oxígeno Industrial - Tanque 50L', descripcion: 'Carga de gas oxígeno industrial para corte.', cant: 5, unid: 'TANQUE', pUnitario: 850.5, importe: 4252.5 },
  ],
  total: 19322.5,
};

function empresaToMarcaVista(empresa) {
  const u = String(empresa || '').toUpperCase();
  if (u.includes('MSM')) return 'msm';
  if (u.includes('IIHEMSA')) return 'iihemsa';
  if (u.includes('PENINSULAR')) return 'iihemsa_peninsular';
  if (u.includes('TESEY')) return 'iihemsa_peninsular';
  return 'iihemsa_peninsular';
}

const ModalDetalleOC = ({ isOpen, onClose, ordenCompra = ejemploOrdenCompra }) => {
  const [marcaVista, setMarcaVista] = useState(() => empresaToMarcaVista(ordenCompra?.empresa));

  useEffect(() => {
    if (isOpen && ordenCompra?.empresa != null) {
      setMarcaVista(empresaToMarcaVista(ordenCompra.empresa));
    }
  }, [isOpen, ordenCompra?.empresa, ordenCompra?.folio]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !ordenCompra) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 print:bg-transparent print:static print:inset-auto"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <div className="w-full max-w-5xl bg-white rounded-lg shadow-xl flex flex-col max-h-[95vh] print:max-h-none print:w-full print:shadow-none">
        <div className="flex justify-between items-center p-3 border-b bg-gray-50 print:hidden">
          <div className="flex items-center gap-3">
            <label htmlFor="formato-select" className="font-semibold text-gray-700">
              Formato de Impresión:
            </label>
            <select
              id="formato-select"
              value={marcaVista}
              onChange={(e) => setMarcaVista(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
            >
              <option value="iihemsa">IIHEMSA</option>
              <option value="iihemsa_peninsular">IIHEMSA Peninsular</option>
              <option value="tesey">TESEY</option>
              <option value="msm">MSM</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors text-sm border bg-white"
            >
              <X size={16} />
              Cerrar
            </button>
          </div>
        </div>

        <div className="print-area overflow-auto bg-gray-200 p-6 flex justify-center print:bg-white print:p-0 print:overflow-visible print:block flex-1">
          {(marcaVista === 'iihemsa_peninsular' || marcaVista === 'tesey') && (
            <FormatoOCTESEY data={ordenCompra} onPrint={handlePrint} marca={marcaVista} />
          )}
          {marcaVista === 'iihemsa' && <FormatoOCIIHEMSA data={ordenCompra} onPrint={handlePrint} marca={marcaVista} />}
          {marcaVista === 'msm' && <FormatoOCMSM data={ordenCompra} onPrint={handlePrint} />}

          {!['iihemsa', 'iihemsa_peninsular', 'tesey', 'msm'].includes(marcaVista) && (
            <div className="text-red-500 font-bold p-12 text-center bg-white rounded-md border print:hidden">
              Error: Formato no soportado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDetalleOC;
export { ejemploOrdenCompra };
