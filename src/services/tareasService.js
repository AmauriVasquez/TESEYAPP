/**
 * Servicio de Operaciones · Tareas.
 * RLS y RPCs definidos en supabase/migrations/2026-06-27_operaciones_tareas.sql
 */
import { supabase } from '@/lib/customSupabaseClient';

/** Lista las tareas visibles para el usuario actual (RLS filtra). */
export async function listarTareas() {
  const { data, error } = await supabase
    .from('tareas')
    .select('id, titulo, descripcion, tipo, estado, prioridad, asignado_empleado_id, fecha_limite, proyecto_id, equipo_id, completado_en, created_at')
    .order('created_at', { ascending: false });
  return { data: data ?? [], error };
}

/** Empleados asignables (id + nombre) vía RPC SECURITY DEFINER. */
export async function empleadosAsignables() {
  const { data, error } = await supabase.rpc('operaciones_empleados_asignables');
  return { data: data ?? [], error };
}

/** Crea una tarea. `creado_por` lo setea la app con el usuario actual. */
export async function crearTarea(payload, creadoPor) {
  const { error } = await supabase.from('tareas').insert({
    titulo: payload.titulo,
    descripcion: payload.descripcion ?? null,
    tipo: payload.tipo ?? 'general',
    prioridad: payload.prioridad ?? 'media',
    asignado_empleado_id: payload.asignado_empleado_id ?? null,
    fecha_limite: payload.fecha_limite || null,
    creado_por: creadoPor ?? null,
  });
  return { error };
}

/** Actualiza campos editables de una tarea (admin/supervisor). */
export async function actualizarTarea(id, payload) {
  const { error } = await supabase.from('tareas').update({
    titulo: payload.titulo,
    descripcion: payload.descripcion ?? null,
    tipo: payload.tipo ?? 'general',
    prioridad: payload.prioridad ?? 'media',
    asignado_empleado_id: payload.asignado_empleado_id ?? null,
    fecha_limite: payload.fecha_limite || null,
  }).eq('id', id);
  return { error };
}

/** Mueve el estado de una tarea (RPC: admin/supervisor o el propio asignado). */
export async function moverEstado(id, estado) {
  const { error } = await supabase.rpc('tarea_mover_estado', { p_tarea_id: id, p_estado: estado });
  return { error };
}
