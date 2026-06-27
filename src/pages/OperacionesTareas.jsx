import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useToast } from '@/components/ui/use-toast';
import {
  listarTareas, empleadosAsignables, crearTarea, actualizarTarea, moverEstado,
} from '@/services/tareasService';
import TableroTareas from '@/components/operaciones/TableroTareas';
import TareasPorColaborador from '@/components/operaciones/TareasPorColaborador';
import TareaModal from '@/components/operaciones/TareaModal';

export default function OperacionesTareas() {
  const { can, userId } = usePermissions();
  const { toast } = useToast();
  const puedeCrear = can('operaciones', 'crear');
  const puedeEditar = can('operaciones', 'editar');

  const [vista, setVista] = useState('tablero');
  const [tareas, setTareas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tareaEdit, setTareaEdit] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    const [{ data: t, error: e1 }, { data: emp, error: e2 }] = await Promise.all([
      listarTareas(), empleadosAsignables(),
    ]);
    if (e1 || e2) toast({ title: 'Error al cargar', description: (e1 || e2).message, variant: 'destructive' });
    setTareas(t);
    setEmpleados(emp);
    setCargando(false);
  }, [toast]);

  useEffect(() => { cargar(); }, [cargar]);

  const nombrePorEmpleado = useMemo(() => {
    const m = {};
    empleados.forEach((e) => { m[e.id] = e.nombre_completo; });
    return m;
  }, [empleados]);

  const abrirNueva = () => { setTareaEdit(null); setModalOpen(true); };
  const abrirEditar = (t) => { setTareaEdit(t); setModalOpen(true); };

  const guardar = async (form) => {
    const { error } = tareaEdit
      ? await actualizarTarea(tareaEdit.id, form)
      : await crearTarea(form, userId);
    if (error) { toast({ title: 'No se pudo guardar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: tareaEdit ? 'Tarea actualizada' : 'Tarea creada' });
    await cargar();
  };

  const mover = async (tarea, estado) => {
    if (estado === tarea.estado) return;
    const { error } = await moverEstado(tarea.id, estado);
    if (error) { toast({ title: 'No se pudo mover', description: error.message, variant: 'destructive' }); return; }
    await cargar();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-lg border bg-white p-0.5 text-sm">
          <button type="button" onClick={() => setVista('tablero')}
            className={`rounded-md px-3 py-1.5 ${vista === 'tablero' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
            Tablero
          </button>
          <button type="button" onClick={() => setVista('colaborador')}
            className={`rounded-md px-3 py-1.5 ${vista === 'colaborador' ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>
            Por colaborador
          </button>
        </div>
        {puedeCrear && (
          <Button onClick={abrirNueva}><Plus className="mr-1 h-4 w-4" /> Nueva tarea</Button>
        )}
      </div>

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando...</p>
      ) : vista === 'tablero' ? (
        <TableroTareas tareas={tareas} nombrePorEmpleado={nombrePorEmpleado}
          puedeEditar={puedeEditar} onEditar={abrirEditar} onMover={mover} />
      ) : (
        <TareasPorColaborador tareas={tareas} empleados={empleados} nombrePorEmpleado={nombrePorEmpleado} />
      )}

      <TareaModal open={modalOpen} onOpenChange={setModalOpen}
        empleados={empleados} tarea={tareaEdit} onGuardar={guardar} />
    </div>
  );
}
