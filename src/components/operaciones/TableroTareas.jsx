import React from 'react';
import { Pencil, Calendar } from 'lucide-react';

const COLUMNAS = [
  { id: 'pendiente', label: 'Pendiente' },
  { id: 'en_progreso', label: 'En progreso' },
  { id: 'bloqueada', label: 'Bloqueada' },
  { id: 'hecha', label: 'Hecha' },
];
const PRIO_COLOR = { alta: 'bg-red-100 text-red-700', media: 'bg-amber-100 text-amber-700', baja: 'bg-slate-100 text-slate-600' };

function Tarjeta({ tarea, nombreEmpleado, puedeEditar, onEditar, onMover }) {
  return (
    <div className="rounded-lg border bg-white p-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{tarea.titulo}</p>
        {puedeEditar && (
          <button type="button" onClick={() => onEditar(tarea)} className="text-gray-400 hover:text-gray-600" aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 ${PRIO_COLOR[tarea.prioridad] || ''}`}>{tarea.prioridad}</span>
        {tarea.fecha_limite && (
          <span className="inline-flex items-center gap-1 text-gray-500">
            <Calendar className="h-3 w-3" />{tarea.fecha_limite}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">{nombreEmpleado || 'Sin asignar'}</p>
      <select
        value={tarea.estado}
        onChange={(e) => onMover(tarea, e.target.value)}
        className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
        aria-label="Mover a"
      >
        {COLUMNAS.map((c) => <option key={c.id} value={c.id}>Mover a: {c.label}</option>)}
      </select>
    </div>
  );
}

export default function TableroTareas({ tareas, nombrePorEmpleado, puedeEditar, onEditar, onMover }) {
  const porColumna = (estado) => tareas.filter((t) => t.estado === estado);

  return (
    <>
      {/* Web: 4 columnas */}
      <div className="hidden sm:grid grid-cols-4 gap-3">
        {COLUMNAS.map((col) => (
          <div key={col.id} className="rounded-xl bg-gray-50 p-2">
            <h3 className="px-1 pb-2 text-sm font-semibold text-gray-700">
              {col.label} <span className="text-gray-400">({porColumna(col.id).length})</span>
            </h3>
            <div className="space-y-2">
              {porColumna(col.id).map((t) => (
                <Tarjeta key={t.id} tarea={t} nombreEmpleado={nombrePorEmpleado[t.asignado_empleado_id]}
                  puedeEditar={puedeEditar} onEditar={onEditar} onMover={onMover} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Móvil: lista de tarjetas agrupada por estado */}
      <div className="sm:hidden space-y-4">
        {COLUMNAS.map((col) => (
          <div key={col.id}>
            <h3 className="pb-1 text-sm font-semibold text-gray-700">
              {col.label} <span className="text-gray-400">({porColumna(col.id).length})</span>
            </h3>
            <div className="space-y-2">
              {porColumna(col.id).map((t) => (
                <Tarjeta key={t.id} tarea={t} nombreEmpleado={nombrePorEmpleado[t.asignado_empleado_id]}
                  puedeEditar={puedeEditar} onEditar={onEditar} onMover={onMover} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
