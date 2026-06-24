// src/services/facturasService.js
import { supabase } from '@/lib/customSupabaseClient';
import { brandingToEntidad } from '@/config/cuentasPago';

const round2 = (n) => Math.round(Number(n) * 100) / 100;

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

/**
 * Crea UNA factura que ampara cobros de varios proyectos (factura.proyecto_id = NULL).
 * Bloqueo duro: todos los proyectos de esos cobros deben ser de la MISMA entidad emisora.
 */
export async function registrarFacturaMulti({ empresaEmisora, numero, fechaEmision, monto, cobroIds = [] }) {
  if (!cobroIds.length) return { error: { message: 'Sin cobros para facturar.' } };
  const { data: cobros, error: cErr } = await supabase
    .from('proyecto_pagos')
    .select('id, proyecto:proyecto_id(cotizacion:cotizacion_id(branding))')
    .in('id', cobroIds);
  if (cErr) return { error: cErr };
  const entidades = new Set(
    (cobros || []).map((c) => brandingToEntidad(c?.proyecto?.cotizacion?.branding)).filter(Boolean)
  );
  if (entidades.size > 1) {
    return { error: { message: 'Una factura no puede abarcar proyectos de distinta entidad (Tesey / IIHEMSA Peninsular).' } };
  }
  const { data, error } = await supabase
    .from('facturas')
    .insert({ proyecto_id: null, empresa_emisora: empresaEmisora, numero, fecha_emision: fechaEmision, monto: monto ?? null })
    .select('id')
    .single();
  if (error) return { error };
  const { error: linkErr } = await supabase.from('proyecto_pagos').update({ factura_id: data.id }).in('id', cobroIds);
  if (linkErr) return { error: linkErr };
  return { data };
}

/**
 * Registra UN pago repartido en varios proyectos (depósito): crea grupos_pago + N proyecto_pagos
 * ligados por grupo_pago_id; opcionalmente una factura compartida (registrarFacturaMulti).
 */
export async function registrarPagoMultiProyecto({ fecha, cuentaValue, asignaciones = [], factura = null }) {
  const validas = (asignaciones || []).filter((a) => a.proyectoId && Number(a.monto) > 0);
  if (validas.length === 0) return { error: { message: 'Agrega al menos un proyecto con monto.' } };
  const montoTotal = round2(validas.reduce((s, a) => s + Number(a.monto || 0), 0));

  const { data: grupo, error: gErr } = await supabase
    .from('grupos_pago')
    .insert({ fecha, cuenta_value: cuentaValue, monto_total: montoTotal })
    .select('id')
    .single();
  if (gErr) return { error: gErr };

  const rows = validas.map((a) => ({
    proyecto_id: a.proyectoId,
    monto: Number(a.monto),
    fecha_pago: fecha,
    metodo_pago: cuentaValue,
    cuenta_value: cuentaValue,
    grupo_pago_id: grupo.id,
  }));
  const { data: cobros, error: pErr } = await supabase.from('proyecto_pagos').insert(rows).select('id');
  if (pErr) return { error: pErr };

  if (factura && factura.numero) {
    const { error: fErr } = await registrarFacturaMulti({
      empresaEmisora: factura.emisora,
      numero: factura.numero,
      fechaEmision: factura.fecha,
      monto: montoTotal,
      cobroIds: (cobros || []).map((c) => c.id),
    });
    if (fErr) return { data: { grupoId: grupo.id }, error: fErr }; // los cobros quedaron; la factura falló
  }
  return { data: { grupoId: grupo.id } };
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
