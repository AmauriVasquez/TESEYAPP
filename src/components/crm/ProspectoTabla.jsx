import React from 'react';

const ETAPA_PILL = {
  nuevo: { label: 'Nuevo', cls: 'bg-orange-400 text-white' },
  contactado: { label: 'Contactado', cls: 'bg-rose-400 text-white' },
  propuesta_enviada: { label: 'Propuesta enviada', cls: 'bg-amber-400 text-white' },
  en_negociacion: { label: 'En negociación', cls: 'bg-yellow-400 text-white' },
  convertido: { label: 'Convertido', cls: 'bg-emerald-500 text-white' },
  descartado: { label: 'Descartado', cls: 'bg-gray-400 text-white' },
};

const FUENTE_PILL = {
  referido: { label: 'Referido', cls: 'bg-blue-500 text-white' },
  redes_sociales: { label: 'Redes sociales', cls: 'bg-fuchsia-500 text-white' },
  web: { label: 'Web', cls: 'bg-sky-500 text-white' },
  visita_directa: { label: 'Visita directa', cls: 'bg-teal-500 text-white' },
  feria: { label: 'Feria', cls: 'bg-indigo-500 text-white' },
  llamada_fria: { label: 'Llamada en frío', cls: 'bg-slate-500 text-white' },
  otro: { label: 'Otro', cls: 'bg-gray-400 text-white' },
};

const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);

const fmtFecha = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const Pill = ({ def, fallback }) => {
  const d = def || { label: fallback || '—', cls: 'bg-gray-200 text-gray-700' };
  if (!def && !fallback) return <span className="text-gray-400">—</span>;
  return <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${d.cls}`}>{d.label}</span>;
};

const ProspectoTabla = ({ prospectos, onCardClick, ultimaInteraccion = {} }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Lead</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Empresa</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Título</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">E-mail</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Teléfono</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Origen</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Última interacción</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prospectos.map((p) => (
            <tr
              key={p.id}
              onClick={() => onCardClick(p)}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <td className="px-3 py-2.5">
                <p className="font-medium text-gray-900">{p.nombre}</p>
                {p.nombre_contacto && <p className="text-xs text-gray-400">{p.nombre_contacto}</p>}
              </td>
              <td className="px-3 py-2.5"><Pill def={ETAPA_PILL[p.etapa]} fallback={p.etapa} /></td>
              <td className="px-3 py-2.5 text-gray-700">{p.razon_social || p.nombre || '—'}</td>
              <td className="px-3 py-2.5 text-gray-600">{p.industria || '—'}</td>
              <td className="px-3 py-2.5">
                {p.email ? (
                  <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline break-all">{p.email}</a>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {p.telefono ? (
                  <a href={`tel:${p.telefono}`} onClick={(e) => e.stopPropagation()} className="text-gray-700 hover:underline">
                    <span aria-hidden="true">🇲🇽</span> {p.telefono}
                  </a>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2.5"><Pill def={FUENTE_PILL[p.fuente]} fallback={p.fuente} /></td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtFecha(ultimaInteraccion[p.id] || p.updated_at)}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">{fmtMXN(p.valor_estimado)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProspectoTabla;
