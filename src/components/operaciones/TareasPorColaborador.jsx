import React, { useMemo } from 'react';

const ABIERTAS = new Set(['pendiente', 'en_progreso', 'bloqueada']);
const ESTADO_LABEL = { pendiente: 'Pendiente', en_progreso: 'En progreso', bloqueada: 'Bloqueada', hecha: 'Hecha' };

export default function TareasPorColaborador({ tareas, empleados, nombrePorEmpleado }) {
  const grupos = useMemo(() => {
    const base = new Map();
    empleados.forEach((e) => base.set(e.id, []));
    tareas.forEach((t) => {
      const key = t.asignado_empleado_id ?? '__sin__';
      if (!base.has(key)) base.set(key, []);
      base.get(key).push(t);
    });
    return Array.from(base.entries()).map(([id, lista]) => ({
      id,
      nombre: id === '__sin__' ? 'Sin asignar' : (nombrePorEmpleado[id] || 'Empleado'),
      lista,
      pendientes: lista.filter((t) => ABIERTAS.has(t.estado)).length,
    })).filter((g) => g.lista.length > 0);
  }, [tareas, empleados, nombrePorEmpleado]);

  if (grupos.length === 0) {
    return <p className="text-sm text-gray-500">No hay tareas todavía.</p>;
  }

  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.id} className="rounded-xl border bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <h3 className="text-sm font-semibold text-gray-800">{g.nombre}</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
              {g.pendientes} pendientes
            </span>
          </div>
          <ul className="divide-y">
            {g.lista.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className={t.estado === 'hecha' ? 'text-gray-400 line-through' : ''}>{t.titulo}</span>
                <span className="text-xs text-gray-500">{ESTADO_LABEL[t.estado]}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
