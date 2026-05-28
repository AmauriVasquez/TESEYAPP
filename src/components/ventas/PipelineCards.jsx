// src/components/ventas/PipelineCards.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { FileText, UserPlus } from 'lucide-react';
import { fmtMXNFull } from '@/config/ventasMetas';
import { cn } from '@/lib/utils';

function StatRow({ label, value, sub, color }) {
  return (
    <div className={cn('flex items-center justify-between rounded-lg border p-3', color)}>
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/**
 * @param {{
 *   cotizaciones: Array<{estatus: string, total: number}>,
 *   prospectos: Array<{estatus?: string}>,
 *   loading: boolean
 * }} props
 */
export default function PipelineCards({ cotizaciones = [], prospectos = [], loading }) {
  const borradores = cotizaciones.filter(c => c.estatus === 'Borrador');
  const enviadas   = cotizaciones.filter(c => c.estatus === 'Enviada');
  const aprobadas  = cotizaciones.filter(c => c.estatus === 'Aprobada');
  const rechazadas = cotizaciones.filter(c => c.estatus === 'Rechazada');

  const totalPipeline = [...borradores, ...enviadas].reduce((s, c) => s + (Number(c.total) || 0), 0);
  const totalAprobado = aprobadas.reduce((s, c) => s + (Number(c.total) || 0), 0);

  const prospectoActivos     = prospectos.filter(p => !['convertido', 'descartado'].includes(p.estatus));
  const prospectoConvertidos = prospectos.filter(p => p.estatus === 'convertido');
  const conversionPct = prospectos.length > 0
    ? Math.round((prospectoConvertidos.length / prospectos.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-200" />)}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">Pipeline de Cotizaciones</h3>
        </div>
        <StatRow
          label="En proceso (Borrador + Enviadas)"
          value={borradores.length + enviadas.length}
          sub={`Valor: ${fmtMXNFull(totalPipeline)}`}
          color="bg-blue-50/60 border-blue-100"
        />
        <StatRow
          label="Aprobadas"
          value={aprobadas.length}
          sub={`Valor: ${fmtMXNFull(totalAprobado)}`}
          color="bg-green-50/60 border-green-100"
        />
        <StatRow
          label="Rechazadas"
          value={rechazadas.length}
          sub="Oportunidades perdidas"
          color="bg-red-50/40 border-red-100"
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border bg-white p-4 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-800">Pipeline de Prospectos</h3>
        </div>
        <StatRow
          label="Prospectos activos"
          value={prospectoActivos.length}
          sub="En proceso de conversión"
          color="bg-purple-50/60 border-purple-100"
        />
        <StatRow
          label="Convertidos a clientes"
          value={prospectoConvertidos.length}
          sub={`Tasa: ${conversionPct}% de conversión`}
          color="bg-green-50/60 border-green-100"
        />
        <StatRow
          label="Total prospectos registrados"
          value={prospectos.length}
          sub="Histórico completo"
          color="bg-gray-50 border-gray-100"
        />
      </motion.div>
    </div>
  );
}
