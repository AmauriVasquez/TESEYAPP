// src/components/clientes/ClienteCotizacionesTabla.jsx
// Tabla de cotizaciones (última versión) de un cliente con enlace al proyecto vinculado
// y botón de entrega directa cuando el proyecto es elegible.
import React, { useState } from 'react';
import { Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import EntregaMasivaModal from '@/components/proyectos/EntregaMasivaModal';

const ESTATUS_COT_BADGE = {
  Borrador: 'bg-gray-100 text-gray-800',
  Enviada: 'bg-blue-100 text-blue-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Historial: 'bg-slate-200 text-slate-700',
  Obsoleta: 'bg-slate-200 text-slate-600',
};

const ESTATUS_PROY_BADGE = {
  'Por Iniciar': 'bg-gray-100 text-gray-600',
  'Solicitud de Materiales': 'bg-yellow-100 text-yellow-800',
  Terminado: 'bg-blue-100 text-blue-800',
  Entregado: 'bg-green-100 text-green-700',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(
    value + (String(value).includes('T') ? '' : 'T00:00:00')
  ).toLocaleDateString('es-MX');
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(value) || 0);

// Regla de elegibilidad: igual que ProyectosList.jsx
// El proyecto es entregable si tiene cotizacion_id y no está Entregado.
const esEntregable = (cot) =>
  cot.proyecto_id != null && cot.proyecto_estatus !== 'Entregado';

const ClienteCotizacionesTabla = ({
  cotizaciones = [],
  loading = false,
  error = false,
  onNavigateCotizacion,   // (cotizacionId) => void
  onNavigateProyecto,     // (proyectoId) => void
  onEntregaSuccess,       // () => void  — llamado tras guardar entrega
}) => {
  const [masivaOpen, setMasivaOpen] = useState(false);
  const [proyectoEntrega, setProyectoEntrega] = useState(null); // { id, folio, descripcion, cotizacion_id }

  const handleEntregar = (cot) => {
    setProyectoEntrega({
      id: cot.proyecto_id,
      folio: cot.proyecto_folio,
      descripcion: cot.proyecto_descripcion,
      cotizacion_id: cot.id,
    });
    setMasivaOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <p className="text-sm text-red-600">No se pudieron cargar las cotizaciones.</p>
      </div>
    );
  }

  if (cotizaciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <p className="text-sm">Sin cotizaciones registradas para este cliente.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left py-2 px-2 font-semibold">Folio</th>
              <th className="text-left py-2 px-2 font-semibold">Descripción</th>
              <th className="text-left py-2 px-2 font-semibold">Fecha</th>
              <th className="text-right py-2 px-2 font-semibold">Total</th>
              <th className="text-center py-2 px-2 font-semibold">Estatus</th>
              <th className="text-left py-2 px-2 font-semibold">Proyecto</th>
              <th className="w-[44px]" />
            </tr>
          </thead>
          <tbody>
            {cotizaciones.map((cot) => (
              <tr key={cot.id} className="border-b border-gray-50 hover:bg-gray-50">
                {/* Folio cotización — navega al editor */}
                <td className="py-2 px-2">
                  <button
                    type="button"
                    className="font-mono text-xs text-blue-700 hover:underline focus:outline-none"
                    onClick={() => onNavigateCotizacion?.(cot.id)}
                  >
                    {cot.folio}
                  </button>
                </td>

                <td className="py-2 px-2 text-gray-700 max-w-[140px]">
                  <span className="block truncate" title={cot.descripcion}>
                    {cot.descripcion}
                  </span>
                </td>

                <td className="py-2 px-2 text-gray-500 whitespace-nowrap">
                  {formatDate(cot.fecha)}
                </td>

                <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                  {formatMXN(cot.total)}
                </td>

                <td className="py-2 px-2 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      ESTATUS_COT_BADGE[cot.estatus] ?? 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {cot.estatus}
                  </span>
                </td>

                {/* Proyecto vinculado */}
                <td className="py-2 px-2">
                  {cot.proyecto_id ? (
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        className="font-mono text-xs text-teal-700 hover:underline focus:outline-none text-left"
                        onClick={() => onNavigateProyecto?.(cot.proyecto_id)}
                      >
                        {cot.proyecto_folio}
                      </button>
                      <span
                        className={`self-start px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          ESTATUS_PROY_BADGE[cot.proyecto_estatus] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {cot.proyecto_estatus}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>

                {/* Botón entregar */}
                <td className="py-2 px-1 text-center">
                  {esEntregable(cot) && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-teal-600 hover:bg-teal-50 hover:text-teal-700"
                      title="Registrar entrega"
                      onClick={() => handleEntregar(cot)}
                    >
                      <PackageCheck className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de entrega — acepta array; pasamos el proyecto individual como array de 1 */}
      <EntregaMasivaModal
        open={masivaOpen}
        onOpenChange={setMasivaOpen}
        proyectos={proyectoEntrega ? [proyectoEntrega] : []}
        onSuccess={() => {
          setMasivaOpen(false);
          onEntregaSuccess?.();
        }}
      />
    </>
  );
};

export default ClienteCotizacionesTabla;
