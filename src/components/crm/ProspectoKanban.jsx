import React from 'react';

const COLUMNAS = [
  { id: 'nuevo', label: 'Nuevo' },
  { id: 'contactado', label: 'Contactado' },
  { id: 'propuesta_enviada', label: 'Propuesta enviada' },
  { id: 'en_negociacion', label: 'En negociación' },
];

const MARCA_BADGE = {
  tesey: 'bg-emerald-100 text-emerald-800',
  kutra: 'bg-amber-100 text-amber-800',
  arkeo: 'bg-purple-100 text-purple-800',
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const diasDesde = (updatedAt) => {
  if (!updatedAt) return 0;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const ProspectoCard = ({ prospecto, onCardClick }) => {
  const dias = diasDesde(prospecto.updated_at);
  const sinActividad = dias > 7;
  const marcaClass = MARCA_BADGE[prospecto.marca_origen] || 'bg-gray-100 text-gray-800';
  const prob = Math.min(100, Math.max(0, Number(prospecto.probabilidad) || 0));

  return (
    <button
      type="button"
      onClick={() => onCardClick(prospecto)}
      className="w-full text-left bg-white border rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-shadow"
    >
      {prospecto.folio && (
        <p className="text-[11px] text-gray-500 mb-1">{prospecto.folio}</p>
      )}
      <p className="font-medium text-gray-900 text-sm leading-snug">{prospecto.nombre}</p>
      {prospecto.marca_origen && (
        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${marcaClass}`}>
          {prospecto.marca_origen.toUpperCase()}
        </span>
      )}
      <p className="text-sm font-semibold text-gray-800 mt-2">
        {formatMXN(prospecto.valor_estimado)}
      </p>
      {sinActividad && (
        <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          Sin actividad
        </span>
      )}
      <div className="mt-2 h-1 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${prob}%` }}
        />
      </div>
    </button>
  );
};

const ProspectoKanban = ({ prospectos, onCardClick }) => {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory">
      {COLUMNAS.map((col) => {
        const items = prospectos.filter((p) => p.etapa === col.id);
        const suma = items.reduce((acc, p) => acc + (Number(p.valor_estimado) || 0), 0);

        return (
          <div key={col.id} className="flex-none w-[260px] sm:flex-1 sm:min-w-[180px] snap-start">
            <div className="mb-3 px-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-gray-200 text-xs font-medium text-gray-700">
                  {items.length}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{formatMXN(suma)}</p>
            </div>
            <div className="min-h-[80px]">
              {items.map((p) => (
                <ProspectoCard key={p.id} prospecto={p} onCardClick={onCardClick} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProspectoKanban;
