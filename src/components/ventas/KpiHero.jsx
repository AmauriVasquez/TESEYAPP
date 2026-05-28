// src/components/ventas/KpiHero.jsx
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Target, DollarSign, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMXNFull, PE_MENSUAL } from '@/config/ventasMetas';

function HeroCard({ icon: Icon, label, value, sub, color, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        'flex flex-col gap-1 rounded-xl border bg-white p-5 shadow-sm',
        color === 'blue'   && 'border-blue-100',
        color === 'green'  && 'border-green-100',
        color === 'amber'  && 'border-amber-100',
        color === 'purple' && 'border-purple-100',
      )}
    >
      <div className={cn(
        'flex h-10 w-10 items-center justify-center rounded-lg',
        color === 'blue'   && 'bg-blue-50 text-blue-600',
        color === 'green'  && 'bg-green-50 text-green-600',
        color === 'amber'  && 'bg-amber-50 text-amber-600',
        color === 'purple' && 'bg-purple-50 text-purple-600',
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {loading ? (
        <div className="h-8 w-32 animate-pulse rounded-md bg-gray-200" />
      ) : (
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      )}
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </motion.div>
  );
}

/**
 * @param {{ metaMes: import('@/config/ventasMetas').METAS_VENTAS[0]|null, ingresoReal: number, loading: boolean }} props
 */
export default function KpiHero({ metaMes, ingresoReal, loading }) {
  const meta = metaMes?.meta_ingresos ?? 0;
  const avancePct = meta > 0 ? Math.round((ingresoReal / meta) * 100) : 0;
  const peAlcanzado = ingresoReal >= PE_MENSUAL;
  const superaMeta   = ingresoReal >= meta;

  let statusLabel = 'Por debajo del PE';
  let statusColor = 'amber';
  if (superaMeta)   { statusLabel = '🎯 Meta superada'; statusColor = 'green'; }
  else if (peAlcanzado) { statusLabel = '✅ PE alcanzado'; statusColor = 'green'; }
  else if (avancePct >= 50) { statusLabel = `${avancePct}% hacia meta`; statusColor = 'blue'; }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <HeroCard
        icon={Target}
        label="Meta del mes"
        value={fmtMXNFull(meta)}
        sub={metaMes ? `${metaMes.vs_pe}% del PE` : undefined}
        color="blue"
        delay={0}
        loading={false}
      />
      <HeroCard
        icon={DollarSign}
        label="Ingresos reales"
        value={fmtMXNFull(ingresoReal)}
        sub="Pagos cobrados en el mes"
        color="green"
        delay={0.05}
        loading={loading}
      />
      <HeroCard
        icon={TrendingUp}
        label="Avance vs meta"
        value={`${avancePct}%`}
        sub={`Faltan ${fmtMXNFull(Math.max(0, meta - ingresoReal))}`}
        color={avancePct >= 100 ? 'green' : avancePct >= 50 ? 'blue' : 'amber'}
        delay={0.1}
        loading={loading}
      />
      <HeroCard
        icon={Zap}
        label="Estado"
        value={statusLabel}
        sub={`PE mensual: ${fmtMXNFull(PE_MENSUAL)}`}
        color={statusColor}
        delay={0.15}
        loading={loading}
      />
    </div>
  );
}
