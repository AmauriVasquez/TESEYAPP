// src/services/facturasService.js
import { supabase } from '@/lib/customSupabaseClient';

/** Crea una factura y liga los cobros indicados. cobroIds = [] => factura sin ligar cobros aún. */
export async function registrarFactura({ proyectoId, empresaEmisora, numero, fechaEmision, monto, uuid, urlCfdi, cobroIds = [] }) {
  const { data, error } = await supabase
    .from('facturas')
    .insert({
      proyecto_id: proyectoId,
      empresa_emisora: empresaEmisora,
      numero,
      fecha_emision: fechaEmision,
      monto: monto ?? null,
      uuid: uuid || null,
      url_cfdi: urlCfdi || null,
    })
    .select('id')
    .single();
  if (error) return { error };

  if (cobroIds.length > 0) {
    const { error: linkErr } = await supabase
      .from('proyecto_pagos')
      .update({ factura_id: data.id })
      .in('id', cobroIds);
    if (linkErr) return { error: linkErr };
  }
  return { data };
}

/** Marca el proyecto como "No se facturará". */
export async function descartarFacturacion(proyectoId) {
  const { error } = await supabase
    .from('proyectos')
    .update({ factura_descartada: true })
    .eq('id', proyectoId);
  return { error };
}

/** Cobros de un proyecto (para elegir cuáles ampara la factura). */
export async function getCobrosProyecto(proyectoId) {
  const { data, error } = await supabase
    .from('proyecto_pagos')
    .select('id, monto, fecha_pago, cuenta_value, metodo_pago, factura_id')
    .eq('proyecto_id', proyectoId)
    .order('fecha_pago', { ascending: false });
  return { data, error };
}
