// src/components/ventas/MetaMesCard.jsx
import React from 'react';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMXNFull, PE_MENSUAL } from '@/config/ventasMetas';

/**
 * Card horizontal que muestra el progreso del mes actual vs meta.
 * @param {{
 *   metaMes: { label: string, meta_ingresos: number, vs_pe: number } | null,
 *   ingresoReal: number,
 *   loading: boolean
 * }} props
 */
export default function MetaMesCard({ metaMes, ingresoReal, loading }) {
  const meta = metaMes?.meta_ingresos ?? 0;
  const pct  = meta > 0 ? Math.min(100, Math.round((ingresoReal / meta) * 100)) : 0;
  const peAlcanzado = ingresoReal >= PE_MENSUAL;
  const superaMeta  = ingresoReal >= meta && meta > 0;

  let badgeText, badgeClass;
  if (superaMeta)       { badgeText = '🎯 Meta superada';      badgeClass = 'bg-green-100 text-green-800'; }
  else if (peAlcanzado) { badgeText = '✅ PE alcanzado';        badgeClass = 'bg-green-100 text-green-800'; }
  else if (pct >= 50)   { badgeText = `${pct}% hacia la meta`; badgeClass = 'bg-blue-100 text-blue-800'; }
  else                  { badgeText = '⚠ Por debajo del PE';   badgeClass = 'bg-amber-100 text-amber-800'; }

  const barClass = superaMeta ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Icono + nombre del mes */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Meta del mes
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {metaMes?.label ?? '—'}
              <span className="ml-2 text-xs font-normal text-gray-500">
                {metaMes?.vs_pe ?? 0}% del PE
              </span>
            </p>
          </div>
        </div>
        {/* Badge estado */}
        <span className={cn('rounded-full px-3 py-1 text-xs font-medium', badgeClass)}>
          {badgeText}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-gray-600">
            Meta: <span className="font-semibold text-gray-900">{fmtMXNFull(meta)}</span>
          </span>
          <span className="text-gray-600">
            Real: <span className="font-semibold text-gray-900">
              {loading ? '…' : fmtMXNFull(ingresoReal)}
            </span>
          </span>
          <span className="font-bold text-gray-900">{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          Faltan {fmtMXNFull(Math.max(0, meta - ingresoReal))} · PE mensual: {fmtMXNFull(PE_MENSUAL)}
        </p>
      </div>
    </div>
  );
}
