import { supabase } from '@/lib/customSupabaseClient';

// Estado de cuenta por cliente: proyectos entregados con saldo pendiente.
// Adeudo por proyecto = COALESCE(monto_aprobado, total) de su cotización.
// ANTI FAN-OUT: pagos, entregas y líneas se traen en consultas separadas y se
// agregan en JS con Maps. Nunca se unen pagos contra líneas (multiplicaría el
// pagado y el saldo saldría mal en silencio).
export async function getEstadoCuentaCliente({ clienteId }) {
  // 1. Cliente.
  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('nombre, rfc')
    .eq('id', clienteId)
    .single();
  if (clienteError) throw clienteError;

  const fechaCorte = new Date().toISOString();
  const vacio = {
    cliente: { nombre: cliente?.nombre, rfc: cliente?.rfc },
    fechaCorte,
    marca: 'tesey',
    branding: undefined,
    proyectos: [],
    totalAdeudo: 0,
    sinAdeudos: true,
  };

  // 2. Proyectos del cliente (no eliminados, con cotización).
  const { data: proyectosRaw, error: proyectosError } = await supabase
    .from('proyectos')
    .select('id, folio, descripcion, cotizacion_id, eliminado')
    .eq('cliente_id', clienteId)
    .not('cotizacion_id', 'is', null);
  if (proyectosError) throw proyectosError;

  const proyectos = (proyectosRaw || []).filter((p) => p.eliminado !== true && p.cotizacion_id != null);
  if (proyectos.length === 0) return vacio;

  const proyectoIds = proyectos.map((p) => p.id);
  const cotizacionIds = [...new Set(proyectos.map((p) => p.cotizacion_id))];

  // 3. Cotizaciones (adeudo, folio/fecha, marca/branding).
  const { data: cotizacionesRaw, error: cotizacionesError } = await supabase
    .from('cotizaciones')
    .select('id, folio, fecha, total, monto_aprobado, marca_comercial, branding')
    .in('id', cotizacionIds);
  if (cotizacionesError) throw cotizacionesError;
  const cotById = new Map((cotizacionesRaw || []).map((c) => [c.id, c]));

  // 4. Pagos: agregado por proyecto (SUM) + ledger ordenado.
  const { data: pagosRaw, error: pagosError } = await supabase
    .from('proyecto_pagos')
    .select('proyecto_id, fecha_pago, metodo_pago, monto')
    .in('proyecto_id', proyectoIds)
    .order('fecha_pago', { ascending: true });
  if (pagosError) throw pagosError;

  const pagadoPorProyecto = new Map();
  const pagosPorProyecto = new Map();
  for (const p of pagosRaw || []) {
    pagadoPorProyecto.set(p.proyecto_id, (pagadoPorProyecto.get(p.proyecto_id) || 0) + Number(p.monto || 0));
    const lista = pagosPorProyecto.get(p.proyecto_id) || [];
    lista.push({ fecha_pago: p.fecha_pago, metodo_pago: p.metodo_pago, monto: Number(p.monto || 0) });
    pagosPorProyecto.set(p.proyecto_id, lista);
  }

  // 5. Entregas de los proyectos (para fecha/receptor/firma y "tiene ≥1 entrega").
  const { data: entregasRaw, error: entregasError } = await supabase
    .from('entregas')
    .select('id, proyecto_id, fecha, recibe_nombre, firma_url, created_at')
    .in('proyecto_id', proyectoIds)
    .order('fecha', { ascending: true })
    .order('created_at', { ascending: true });
  if (entregasError) throw entregasError;

  const entregasBase = entregasRaw || [];
  const entregaById = new Map(entregasBase.map((e) => [e.id, e]));
  const tieneEntrega = new Set(entregasBase.map((e) => e.proyecto_id));

  // 6. Renglones de esas entregas.
  const entregaIds = entregasBase.map((e) => e.id);
  let entregaItems = [];
  if (entregaIds.length) {
    const { data: eItems, error: eItemsError } = await supabase
      .from('entregas_items')
      .select('entrega_id, cotizacion_item_id, cantidad_entregada')
      .in('entrega_id', entregaIds);
    if (eItemsError) throw eItemsError;
    entregaItems = eItems || [];
  }

  // 7. Partidas de cotización (descripción/observaciones/precio).
  const { data: cotItemsRaw, error: cotItemsError } = await supabase
    .from('cotizaciones_items')
    .select('id, descripcion, observaciones, precio_unitario')
    .in('cotizacion_id', cotizacionIds);
  if (cotItemsError) throw cotItemsError;
  const cotItemById = new Map((cotItemsRaw || []).map((ci) => [ci.id, ci]));

  // Líneas por proyecto (vía entrega → proyecto), orden entrega_fecha asc.
  const lineasPorProyecto = new Map();
  for (const row of entregaItems) {
    const entrega = entregaById.get(row.entrega_id);
    if (!entrega) continue;
    const partida = cotItemById.get(row.cotizacion_item_id);
    const cantidad = Number(row.cantidad_entregada || 0);
    const precio = Number(partida?.precio_unitario || 0);
    const lista = lineasPorProyecto.get(entrega.proyecto_id) || [];
    lista.push({
      descripcion: partida?.descripcion ?? '—',
      observaciones: partida?.observaciones ?? '',
      cantidad_entregada: cantidad,
      precio_unitario: precio,
      importe: cantidad * precio,
      entrega_fecha: entrega.fecha ?? entrega.created_at,
      recibe_nombre: entrega.recibe_nombre,
      firma_url: entrega.firma_url,
    });
    lineasPorProyecto.set(entrega.proyecto_id, lista);
  }

  // Stitch por proyecto + filtro: ≥1 entrega AND saldo > 0.
  const proyectosOut = [];
  for (const p of proyectos) {
    if (!tieneEntrega.has(p.id)) continue;
    const cot = cotById.get(p.cotizacion_id);
    const total = Number(cot?.monto_aprobado ?? cot?.total ?? 0);
    const pagado = pagadoPorProyecto.get(p.id) || 0;
    const saldo = Math.max(0, total - pagado);
    if (saldo <= 0) continue;

    const lineas = (lineasPorProyecto.get(p.id) || []).sort(
      (a, b) => new Date(a.entrega_fecha) - new Date(b.entrega_fecha)
    );
    const subtotalEntregado = lineas.reduce((s, l) => s + l.importe, 0);

    proyectosOut.push({
      proyecto: { id: p.id, folio: p.folio, descripcion: p.descripcion },
      cotizacion: { folio: cot?.folio, fecha: cot?.fecha },
      total,
      pagado,
      saldo,
      subtotalEntregado,
      pagos: pagosPorProyecto.get(p.id) || [],
      lineas,
    });
  }

  if (proyectosOut.length === 0) return vacio;

  const primerProyecto = proyectos.find((p) => p.id === proyectosOut[0].proyecto.id);
  const primeraCot = cotById.get(primerProyecto?.cotizacion_id);
  const marca = primeraCot?.marca_comercial || primeraCot?.branding || 'tesey';

  return {
    cliente: { nombre: cliente?.nombre, rfc: cliente?.rfc },
    fechaCorte,
    marca,
    branding: primeraCot?.branding,
    proyectos: proyectosOut,
    totalAdeudo: proyectosOut.reduce((s, p) => s + p.saldo, 0),
    sinAdeudos: false,
  };
}
