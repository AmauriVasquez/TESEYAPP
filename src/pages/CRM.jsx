import React from 'react';
import { Helmet } from 'react-helmet';
import { Kanban } from 'lucide-react';

const CRM = () => {
  return (
    <>
      <Helmet>
        <title>CRM - IIHEMSA Peninsular</title>
        <meta name="description" content="Panel CRM de ventas" />
      </Helmet>

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CRM</h2>
          <p className="text-gray-600 mt-1">Panel central de relaciones comerciales</p>
        </div>

        <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <Kanban className="w-10 h-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-600 max-w-md">
            Usa la sección <strong className="text-gray-900">Prospectos</strong> para gestionar el
            pipeline kanban, registrar interacciones y convertir oportunidades en clientes.
          </p>
        </div>
      </div>
    </>
  );
};

export default CRM;
