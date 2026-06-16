// src/components/clientes/ClienteResumenCards.jsx
import React from 'react';
import { Loader2, FileText, CheckCircle2, DollarSign, AlertCircle } from 'lucide-react';

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const Card = ({ icon: Icon, label, value, tone = 'gray', hint }) => {
  const tones = {
    gray: 'text-gray-900',
    blue: 'text-blue-700',
    green: 'text-green-700',
    red: 'text-red-700',
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 text-base font-bold ${tones[tone]}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-gray-400">{hint}</p> : null}
    </div>
  );
};

const ClienteResumenCards = ({ resumen, loading, error }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      </div>
    );
  }
  if (error || !resumen) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50/70 p-3 text-xs text-gray-400">
        No se pudo cargar el resumen financiero.
      </div>
    );
  }

  const { cotizado, autorizado, pagado, por_cobrar, num_cotizaciones, num_proyectos } = resumen;
  const conversion = Number(cotizado) > 0 ? Math.round((Number(autorizado) / Number(cotizado)) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Card icon={FileText} label="Cotizado" value={formatMXN(cotizado)} tone="blue" hint="IVA mixto" />
        <Card icon={CheckCircle2} label="Autorizado" value={formatMXN(autorizado)} tone="green" />
        <Card icon={DollarSign} label="Pagado" value={formatMXN(pagado)} tone="gray" />
        <Card
          icon={AlertCircle}
          label="Por cobrar"
          value={formatMXN(por_cobrar)}
          tone={Number(por_cobrar) > 0 ? 'red' : 'gray'}
        />
      </div>
      <p className="text-[11px] text-gray-500">
        Conversión {conversion}% · {num_cotizaciones} cotización{num_cotizaciones === 1 ? '' : 'es'} · {num_proyectos} proyecto{num_proyectos === 1 ? '' : 's'}
      </p>
    </div>
  );
};

export default ClienteResumenCards;
