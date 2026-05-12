/**
 * Servicio de Finanzas: ingresos (proyecto_pagos) y gastos (finanzas_gastos)
 */

import { supabase } from '@/lib/customSupabaseClient';

/** Inserta un pago/ingreso (proyecto_pagos). Los ingresos se leen desde vista finanzas_ingresos. */
export async function registrarIngreso(data) {
  const { error } = await supabase.from('proyecto_pagos').insert({
    proyecto_id: data.proyecto_id,
    monto: data.monto,
    fecha_pago: data.fecha_pago,
    metodo_pago: data.metodo_pago,
    comentarios: data.comentarios ?? null,
    url_cfdi: data.url_cfdi ?? null,
  });
  return { error };
}

/** Inserta un gasto (finanzas_gastos). proyecto_id puede ser null (gasto general). */
export async function registrarGasto(data) {
  const { error } = await supabase.from('finanzas_gastos').insert({
    proyecto_id: data.proyecto_id ?? null,
    monto: data.monto,
    fecha: data.fecha,
    categoria: data.categoria,
    proveedor: data.proveedor ?? null,
    descripcion: data.descripcion ?? null,
    factura_url: data.factura_url ?? null,
  });
  return { error };
}

/** Lista ingresos (vista finanzas_ingresos = proyecto_pagos). */
export async function getIngresos(filters = {}) {
  let q = supabase.from('finanzas_ingresos').select('*').order('fecha', { ascending: false });
  if (filters.proyecto_id) q = q.eq('proyecto_id', filters.proyecto_id);
  if (filters.desde) q = q.gte('fecha', filters.desde);
  if (filters.hasta) q = q.lte('fecha', filters.hasta);
  const { data, error } = await q;
  return { data, error };
}

/** Lista gastos. */
export async function getGastos(filters = {}) {
  let q = supabase.from('finanzas_gastos').select('*').order('fecha', { ascending: false });
  if (filters.proyecto_id !== undefined) q = filters.proyecto_id === null ? q.is('proyecto_id', null) : q.eq('proyecto_id', filters.proyecto_id);
  if (filters.desde) q = q.gte('fecha', filters.desde);
  if (filters.hasta) q = q.lte('fecha', filters.hasta);
  const { data, error } = await q;
  return { data, error };
}
