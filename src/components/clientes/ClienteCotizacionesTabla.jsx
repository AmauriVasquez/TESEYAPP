import React, { useState, useMemo } from 'react';
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

const PAGO_BADGE = {
  Pagado: 'bg-green-100 text-green-800',
  Parcial: 'bg-amber-100 text-amber-800',
  Pendiente: 'bg-red-100 text-red-800',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(
    value + (String(value).includes('T') ? '' : 'T00:00:00')
  ).toLocaleDateString('es-MX');
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const esEntregable = (cot) =>
  cot.proyecto_id != null && cot.proyecto_estatus !== 'Entregado';

// Bloque de estatus apilado para una cotización (cot + proyecto + pago cuando Aprobada).
// El badge de pago es un botón que lleva al control financiero del proyecto.
const EstatusStack = ({ cot, onNavigatePagos }) => {
  const pagoClickable = Boolean(cot.proyecto_id) && typeof onNavigatePagos === 'function';
  const pagoClass = `px-1.5 py-0.5 rounded-full text-[10px] font-medium ${PAGO_BADGE[cot.pago_estatus] ?? 'bg-gray-100 text-gray-800'}`;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTATUS_COT_BADGE[cot.estatus] ?? 'bg-gray-100 text-gray-800'}`}>
        {cot.estatus}
      </span>
      {cot.estatus === 'Aprobada' && (
        <>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cot.proyecto_estatus ? ESTATUS_PROY_BADGE[cot.proyecto_estatus] ?? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-500'}`}>
            {cot.proyecto_estatus || 'Sin proyecto'}
          </span>
          {pagoClickable ? (
            <button
              type="button"
              className={`${pagoClass} hover:brightness-95 hover:underline focus:outline-none`}
              title="Ver pagos del proyecto"
              onClick={() => onNavigatePagos(cot.proyecto_id)}
            >
              Pago: {cot.pago_estatus} ›
            </button>
          ) : (
            <span className={pagoClass}>Pago: {cot.pago_estatus}</span>
          )}
        </>
      )}
    </div>
  );
};

const ClienteCotizacionesTabla = ({
  cotizaciones = [],
  loading = false,
  error = false,
  onNavigateCotizacion,
  onNavigateProyecto,
  onNavigatePagos,
  onEntregaSuccess,
}) => {
  const [masivaOpen, setMasivaOpen] = useState(false);
  const [seleccion, setSeleccion] = useState([]); // ids de cotización seleccionados
  const [sortKey, setSortKey] = useState('fecha');   // folio|descripcion|fecha|total|proyecto|estatus
  const [sortDir, setSortDir] = useState('desc');    // asc|desc
  const [filtroEstatus, setFiltroEstatus] = useState(''); // '' | 'cot:Aprobada' | 'proy:Entregado' | 'pago:Pendiente'

  const elegibles = cotizaciones.filter(esEntregable);
  const seleccionElegible = seleccion.filter((id) =>
    elegibles.some((c) => c.id === id)
  );
  const todasSeleccionadas =
    elegibles.length > 0 && elegibles.every((c) => seleccion.includes(c.id));

  const toggle = (id) =>
    setSeleccion((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const toggleTodas = () =>
    setSeleccion(todasSeleccionadas ? [] : elegibles.map((c) => c.id));

  // Proyectos a entregar (uno por cotización seleccionada elegible).
  // Memoizado en [cotizaciones, seleccion] para mantener identidad estable y no
  // reiniciar el modal de entrega en re-renders incidentales (ver EntregaMasivaModal).
  const proyectosParaEntrega = useMemo(
    () =>
      cotizaciones
        .filter((c) => seleccion.includes(c.id) && c.proyecto_id != null && c.proyecto_estatus !== 'Entregado')
        .map((c) => ({
          id: c.proyecto_id,
          folio: c.proyecto_folio,
          descripcion: c.proyecto_descripcion,
          cotizacion_id: c.id,
        })),
    [cotizaciones, seleccion]
  );

  // Filas a mostrar: filtradas por estatus y ordenadas. La selección de entrega
  // sigue operando sobre TODAS las cotizaciones; el filtro solo afecta la vista.
  const visibles = useMemo(() => {
    let rows = cotizaciones;
    if (filtroEstatus) {
      const sep = filtroEstatus.indexOf(':');
      const dim = filtroEstatus.slice(0, sep);
      const fval = filtroEstatus.slice(sep + 1);
      rows = rows.filter((c) => {
        if (dim === 'cot') return c.estatus === fval;
        if (dim === 'proy') return c.proyecto_estatus === fval;
        if (dim === 'pago') return c.estatus === 'Aprobada' && c.pago_estatus === fval;
        return true;
      });
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    const valor = (c) => {
      switch (sortKey) {
        case 'folio': return c.folio || '';
        case 'descripcion': return c.descripcion || '';
        case 'fecha': return c.fecha ? new Date(c.fecha).getTime() : 0;
        case 'total': return Number(c.total) || 0;
        case 'proyecto': return c.proyecto_folio || '';
        case 'estatus': return c.estatus || '';
        default: return '';
      }
    };
    const numerico = sortKey === 'fecha' || sortKey === 'total';
    return [...rows].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (numerico) return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * dir;
    });
  }, [cotizaciones, filtroEstatus, sortKey, sortDir]);

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
      {/* Barra de acción masiva — visible cuando hay proyectos entregables */}
      {elegibles.length > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-100 bg-teal-50/80 px-3 py-2 backdrop-blur">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="h-5 w-5 accent-teal-600"
              checked={todasSeleccionadas}
              onChange={toggleTodas}
            />
            Seleccionar todas ({elegibles.length} por entregar)
          </label>
          <Button
            type="button"
            size="sm"
            className="h-10 gap-2 bg-teal-600 hover:bg-teal-700"
            disabled={seleccionElegible.length === 0}
            onClick={() => setMasivaOpen(true)}
          >
            <PackageCheck className="h-4 w-4" />
            Entregar seleccionadas ({seleccionElegible.length})
          </Button>
        </div>
      )}

      {/* Controles: ordenar + filtrar por estatus */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-gray-500">Ordenar:</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="fecha">Fecha</option>
          <option value="folio">Folio</option>
          <option value="total">Total</option>
          <option value="descripcion">Descripción</option>
          <option value="proyecto">Proyecto</option>
          <option value="estatus">Estatus cotización</option>
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm hover:bg-gray-50"
          title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>

        <span className="ml-2 text-xs font-medium text-gray-500">Estatus:</span>
        <select
          value={filtroEstatus}
          onChange={(e) => setFiltroEstatus(e.target.value)}
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">Todos</option>
          <optgroup label="Cotización">
            <option value="cot:Aprobada">Aprobada</option>
            <option value="cot:Borrador">Borrador</option>
            <option value="cot:Rechazada">Rechazada</option>
            <option value="cot:Historial">Historial</option>
          </optgroup>
          <optgroup label="Proyecto">
            <option value="proy:Por Iniciar">Por Iniciar</option>
            <option value="proy:Solicitud de Materiales">Solicitud de Materiales</option>
            <option value="proy:Terminado">Terminado</option>
            <option value="proy:Entregado">Entregado</option>
          </optgroup>
          <optgroup label="Pago">
            <option value="pago:Pagado">Pagado</option>
            <option value="pago:Parcial">Parcial</option>
            <option value="pago:Pendiente">Pendiente</option>
          </optgroup>
        </select>
        {filtroEstatus && (
          <button type="button" onClick={() => setFiltroEstatus('')} className="text-xs text-blue-600 hover:underline">
            Limpiar
          </button>
        )}
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No hay cotizaciones que coincidan con el filtro.</p>
      ) : (
      <>
      {/* MÓVIL — tarjetas apiladas */}
      <div className="space-y-3 sm:hidden">
        {visibles.map((cot) => {
          const entregable = esEntregable(cot);
          const marcada = seleccion.includes(cot.id);
          return (
            <div
              key={cot.id}
              className={`rounded-lg border p-3 space-y-2 ${marcada ? 'border-teal-400 bg-teal-50/40' : 'border-gray-200'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {entregable && (
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 shrink-0 accent-teal-600"
                      checked={marcada}
                      onChange={() => toggle(cot.id)}
                      aria-label={`Seleccionar ${cot.folio}`}
                    />
                  )}
                  <button
                    type="button"
                    className="font-mono text-sm font-semibold text-blue-700 hover:underline focus:outline-none text-left"
                    onClick={() => onNavigateCotizacion?.(cot.id)}
                  >
                    {cot.folio}
                  </button>
                </div>
                <span className="shrink-0 font-semibold text-gray-900 text-sm">{formatMXN(cot.total)}</span>
              </div>

              <p className="text-sm text-gray-700 break-words">{cot.descripcion}</p>
              <p className="text-xs text-gray-500">{formatDate(cot.fecha)}</p>

              {cot.proyecto_id && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Proyecto:</span>
                  <button
                    type="button"
                    className="font-mono text-xs text-teal-700 hover:underline focus:outline-none"
                    onClick={() => onNavigateProyecto?.(cot.proyecto_id)}
                  >
                    {cot.proyecto_folio}
                  </button>
                </div>
              )}

              <EstatusStack cot={cot} onNavigatePagos={onNavigatePagos} />
            </div>
          );
        })}
      </div>

      {/* ESCRITORIO — tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="w-[36px] py-2 px-1 text-center">
                {elegibles.length > 0 && (
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-600"
                    checked={todasSeleccionadas}
                    onChange={toggleTodas}
                    aria-label="Seleccionar todas"
                  />
                )}
              </th>
              <th className="text-left py-2 px-2 font-semibold">Folio</th>
              <th className="text-left py-2 px-2 font-semibold">Descripción</th>
              <th className="text-left py-2 px-2 font-semibold">Fecha</th>
              <th className="text-right py-2 px-2 font-semibold">Total</th>
              <th className="text-left py-2 px-2 font-semibold">Proyecto</th>
              <th className="text-left py-2 px-2 font-semibold">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((cot) => {
              const entregable = esEntregable(cot);
              const marcada = seleccion.includes(cot.id);
              return (
                <tr
                  key={cot.id}
                  className={`border-b border-gray-50 align-top ${marcada ? 'bg-teal-50/50' : 'hover:bg-gray-50'}`}
                >
                  <td className="py-2 px-1 text-center">
                    {entregable && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-teal-600"
                        checked={marcada}
                        onChange={() => toggle(cot.id)}
                        aria-label={`Seleccionar ${cot.folio}`}
                      />
                    )}
                  </td>
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
                    <span className="block truncate" title={cot.descripcion}>{cot.descripcion}</span>
                  </td>
                  <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(cot.fecha)}</td>
                  <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {formatMXN(cot.total)}
                  </td>
                  <td className="py-2 px-2">
                    {cot.proyecto_id ? (
                      <button
                        type="button"
                        className="font-mono text-xs text-teal-700 hover:underline focus:outline-none text-left"
                        onClick={() => onNavigateProyecto?.(cot.proyecto_id)}
                      >
                        {cot.proyecto_folio}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-2"><EstatusStack cot={cot} onNavigatePagos={onNavigatePagos} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}

      <EntregaMasivaModal
        open={masivaOpen}
        onOpenChange={setMasivaOpen}
        proyectos={proyectosParaEntrega}
        onSuccess={() => {
          setMasivaOpen(false);
          setSeleccion([]);
          onEntregaSuccess?.();
        }}
      />
    </>
  );
};

export default ClienteCotizacionesTabla;
