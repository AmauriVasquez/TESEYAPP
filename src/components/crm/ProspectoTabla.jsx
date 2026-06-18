import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

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

const ETAPA_BORDER = {
  nuevo: '#fb923c',
  contactado: '#fb7185',
  propuesta_enviada: '#fbbf24',
  en_negociacion: '#facc15',
  convertido: '#10b981',
  descartado: '#d1d5db',
};

const TIPO_LABEL = { llamada: 'Llamada', whatsapp: 'WhatsApp', visita: 'Visita' };

const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);

const fmtProxima = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const Pill = ({ def, fallback }) => {
  const d = def || { label: fallback || '—', cls: 'bg-gray-200 text-gray-700' };
  if (!def && !fallback) return <span className="text-gray-400">—</span>;
  return <span className={`inline-block px-3.5 py-1 rounded-full text-xs font-medium ${d.cls}`}>{d.label}</span>;
};

// Columnas de datos ordenables: key -> { label, accessor, type, align }
const COLUMNS = [
  { key: 'nombre', label: 'Lead', type: 'string', accessor: (p) => p.nombre },
  { key: 'etapa', label: 'Estado', type: 'string', accessor: (p) => p.etapa },
  { key: 'empresa', label: 'Empresa', type: 'string', accessor: (p) => p.razon_social || p.nombre },
  { key: 'industria', label: 'Título', type: 'string', accessor: (p) => p.industria },
  { key: 'email', label: 'E-mail', type: 'string', accessor: (p) => p.email },
  { key: 'telefono', label: 'Teléfono', type: 'string', accessor: (p) => p.telefono },
  { key: 'fuente', label: 'Origen', type: 'string', accessor: (p) => p.fuente },
  { key: 'proxima', label: 'Próxima interacción', type: 'date' },
  { key: 'valor', label: 'Valor', type: 'number', align: 'right', accessor: (p) => Number(p.valor_estimado) || 0 },
];

const ProspectoTabla = ({ prospectos, onCardClick, proximaInteraccion = {} }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const clientesBase = pathname.startsWith('/ventas') ? '/ventas/clientes' : '/clientes';
  const [hoveredId, setHoveredId] = React.useState(null);
  const [sortKey, setSortKey] = React.useState(null);
  const [sortDir, setSortDir] = React.useState('asc');
  const [filtroEtapa, setFiltroEtapa] = React.useState('');
  const [filtroFuente, setFiltroFuente] = React.useState('');

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const accessorFor = React.useCallback(
    (key) => {
      if (key === 'proxima') return (p) => proximaInteraccion[p.id]?.fecha_hora_programada;
      const col = COLUMNS.find((c) => c.key === key);
      return col?.accessor;
    },
    [proximaInteraccion]
  );

  const visibles = React.useMemo(() => {
    const lista = (prospectos || []).filter((p) => {
      if (filtroEtapa && p.etapa !== filtroEtapa) return false;
      if (filtroFuente && p.fuente !== filtroFuente) return false;
      return true;
    });

    if (!sortKey) return lista;

    const col = COLUMNS.find((c) => c.key === sortKey);
    const type = col?.type || 'string';
    const accessor = accessorFor(sortKey);
    const dir = sortDir === 'asc' ? 1 : -1;

    const copia = [...lista];
    copia.sort((a, b) => {
      const va = accessor ? accessor(a) : undefined;
      const vb = accessor ? accessor(b) : undefined;

      if (type === 'number') {
        return ((Number(va) || 0) - (Number(vb) || 0)) * dir;
      }

      if (type === 'date') {
        const ta = va ? new Date(va).getTime() : null;
        const tb = vb ? new Date(vb).getTime() : null;
        if (ta == null && tb == null) return 0;
        if (ta == null) return 1; // nulos al final
        if (tb == null) return -1;
        return (ta - tb) * dir;
      }

      // string
      const sa = va == null ? '' : String(va);
      const sb = vb == null ? '' : String(vb);
      if (!sa && !sb) return 0;
      if (!sa) return 1; // vacíos al final
      if (!sb) return -1;
      return sa.localeCompare(sb, 'es', { sensitivity: 'base' }) * dir;
    });
    return copia;
  }, [prospectos, sortKey, sortDir, proximaInteraccion, filtroEtapa, filtroFuente, accessorFor]);

  const sortArrow = (key) => {
    if (sortKey !== key) return null;
    return <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select
          value={filtroEtapa}
          onChange={(e) => setFiltroEtapa(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Todas las etapas</option>
          {Object.entries(ETAPA_PILL).map(([k, def]) => (
            <option key={k} value={k}>{def.label}</option>
          ))}
        </select>
        <select
          value={filtroFuente}
          onChange={(e) => setFiltroFuente(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Todos los orígenes</option>
          {Object.entries(FUENTE_PILL).map(([k, def]) => (
            <option key={k} value={k}>{def.label}</option>
          ))}
        </select>
      </div>

      <>
      {/* MÓVIL — tarjetas */}
      <div className="sm:hidden space-y-3">
        {visibles.map((p) => {
          const prox = proximaInteraccion[p.id];
          return (
            <div
              key={p.id}
              onClick={() => onCardClick(p)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 cursor-pointer active:bg-gray-50"
              style={{ borderLeft: `4px solid ${ETAPA_BORDER[p.etapa] || '#e5e7eb'}` }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 break-words">{p.nombre}</p>
                  {p.nombre_contacto && <p className="text-xs text-gray-500">{p.nombre_contacto}</p>}
                </div>
                <span className="shrink-0 font-semibold text-gray-800">{fmtMXN(p.valor_estimado)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Pill def={ETAPA_PILL[p.etapa]} fallback={p.etapa} />
                <Pill def={FUENTE_PILL[p.fuente]} fallback={p.fuente} />
              </div>
              {(p.razon_social || p.industria) && (
                <p className="mt-2 text-sm text-gray-700 break-words">
                  {p.razon_social || p.nombre}{p.industria ? ` · ${p.industria}` : ''}
                </p>
              )}
              <div className="mt-2 flex flex-col gap-1 text-sm" onClick={(e) => e.stopPropagation()}>
                {p.email && <a href={`mailto:${p.email}`} className="text-blue-600 hover:underline break-all">{p.email}</a>}
                {p.telefono && <a href={`tel:${p.telefono}`} className="text-gray-700 hover:underline"><span aria-hidden="true">🇲🇽</span> {p.telefono}</a>}
              </div>
              {prox && (
                <p className="mt-2 text-xs text-indigo-600 font-medium">
                  Próxima: {fmtProxima(prox.fecha_hora_programada)} · {TIPO_LABEL[prox.tipo] || prox.tipo}
                </p>
              )}
              {p.etapa === 'convertido' && p.cliente_id != null && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); navigate(`${clientesBase}?cliente=${p.cliente_id}`); }}
                  className="mt-2 flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" /> Ver cliente
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ESCRITORIO — tabla */}
      <div className="hidden sm:block overflow-x-auto bg-white rounded-xl border border-gray-100 shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50">
            <tr className="border-b border-gray-200 text-left">
              <th className="px-3 py-2 w-8">
                <input type="checkbox" className="rounded border-gray-300 opacity-40" readOnly />
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2 font-medium text-gray-400 text-xs cursor-pointer select-none ${col.align === 'right' ? 'text-right' : ''}`}
                >
                  {col.label}
                  {sortArrow(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibles.map((p) => {
              const prox = proximaInteraccion[p.id];
              return (
                <tr
                  key={p.id}
                  onClick={() => onCardClick(p)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="transition-all cursor-pointer hover:bg-gray-50"
                  style={hoveredId === p.id ? { borderLeft: `4px solid ${ETAPA_BORDER[p.etapa] || '#e5e7eb'}` } : { borderLeft: '4px solid transparent' }}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-gray-300" readOnly />
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-gray-900">{p.nombre}</p>
                    {p.nombre_contacto && <p className="text-xs text-gray-500">{p.nombre_contacto}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <Pill def={ETAPA_PILL[p.etapa]} fallback={p.etapa} />
                    {p.etapa === 'convertido' && p.cliente_id != null && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${clientesBase}?cliente=${p.cliente_id}`);
                        }}
                        className="mt-1 flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Ver cliente
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-700">{p.razon_social || p.nombre || '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{p.industria || '—'}</td>
                  <td className="px-3 py-3">
                    {p.email ? (
                      <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline break-all">{p.email}</a>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {p.telefono ? (
                      <a href={`tel:${p.telefono}`} onClick={(e) => e.stopPropagation()} className="text-gray-700 hover:underline">
                        <span aria-hidden="true">🇲🇽</span> {p.telefono}
                      </a>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3"><Pill def={FUENTE_PILL[p.fuente]} fallback={p.fuente} /></td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {prox ? (
                      <span className="text-indigo-600 font-medium">
                        {fmtProxima(prox.fecha_hora_programada)} · {TIPO_LABEL[prox.tipo] || prox.tipo}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">{fmtMXN(p.valor_estimado)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
    </div>
  );
};

export default ProspectoTabla;
