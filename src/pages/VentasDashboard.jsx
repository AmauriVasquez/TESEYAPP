// src/pages/VentasDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { META_ANUAL_2026, fmtMXNFull } from '@/config/ventasMetas';
import { cn } from '@/lib/utils';
import DashboardAnual from '@/components/ventas/DashboardAnual';
import DashboardMensual from '@/components/ventas/DashboardMensual';

const NOMBRES_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function VentasDashboard() {
  const { toast } = useToast();

  const { mes: MES_ACTUAL, anio: ANIO_ACTUAL } = useMemo(() => {
    const now = new Date();
    return { mes: now.getMonth() + 1, anio: now.getFullYear() };
  }, []);

  const [tab, setTab] = useState('anual');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [ingresosPorMes, setIngresosPorMes] = useState({});
  const [cotizaciones, setCotizaciones]     = useState([]);
  const [prospectos, setProspectos]         = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    setIngresosPorMes({});
    setCotizaciones([]);
    setProspectos([]);
    try {
      const [pagosRes, cotRes, prospRes] = await Promise.all([
        supabase
          .from('proyecto_pagos')
          .select('monto, fecha_pago')
          .gte('fecha_pago', '2026-01-01'),

        // Expanded: agrega marca_comercial, fecha, cliente nombre
        supabase
          .from('cotizaciones')
          .select('id, folio, estatus, total, fecha, marca_comercial, cliente:cliente_id(nombre), cliente_nombre_externo')
          .not('estatus', 'in', '("Historial","Obsoleta")')
          .eq('es_ultima_version', true),

        // Expanded: agrega nombre y marca_origen
        supabase
          .from('prospectos')
          .select('id, etapa, marca_origen, nombre')
          .eq('eliminado', false),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (cotRes.error)   throw cotRes.error;
      if (prospRes.error) throw prospRes.error;

      // Normalizar cotizaciones: resolver nombre del cliente
      const cotNormalizadas = (cotRes.data || []).map(c => ({
        ...c,
        cliente_nombre: c.cliente?.nombre || c.cliente_nombre_externo || 'Sin cliente',
      }));

      const mapa = {};
      for (const pago of pagosRes.data || []) {
        if (!pago.fecha_pago) continue;
        const key = pago.fecha_pago.slice(0, 7);
        mapa[key] = (mapa[key] || 0) + Number(pago.monto || 0);
      }
      setIngresosPorMes(mapa);
      setCotizaciones(cotNormalizadas);
      setProspectos(prospRes.data || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al cargar dashboard', description: err.message });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mesLabel = `${NOMBRES_MES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`;

  return (
    <>
      <Helmet>
        <title>Dashboard Ventas – IIHEMSA Peninsular</title>
      </Helmet>

      {/* Dark full-bleed wrapper */}
      <div
        className="-m-4 sm:-m-6 lg:-m-8 min-h-screen"
        style={{ background: '#0F1115' }}
      >
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">

          {/* ── Encabezado ─────────────────────────────── */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold" style={{ color: '#E8EDF5' }}>
                Dashboard de Ventas
              </h2>
              <p className="text-sm mt-0.5" style={{ color: '#8892A4' }}>
                Seguimiento de metas · Meta anual {ANIO_ACTUAL}: {fmtMXNFull(META_ANUAL_2026)}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{ borderColor: '#262B36', color: '#8892A4', background: '#171A21' }}
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />
              }
              Actualizar
            </button>
          </div>

          {/* ── Error banner ───────────────────────────── */}
          {error && (
            <div className="rounded-lg border px-4 py-3 text-sm"
              style={{ borderColor: '#FF5C5C44', background: '#FF5C5C11', color: '#FF5C5C' }}>
              No se pudieron cargar los datos. Usa el botón <strong>Actualizar</strong> para reintentar.
            </div>
          )}

          {/* ── Tab switcher ───────────────────────────── */}
          <div className="flex rounded-xl p-1 w-fit gap-1"
            style={{ background: '#171A21', border: '1px solid #262B36' }}>
            <button
              type="button"
              onClick={() => setTab('anual')}
              className="rounded-lg px-5 py-2 text-sm font-medium transition-all"
              style={tab === 'anual'
                ? { background: '#4F8CFF', color: '#fff' }
                : { color: '#8892A4' }
              }
            >
              Anual {ANIO_ACTUAL}
            </button>
            <button
              type="button"
              onClick={() => setTab('mensual')}
              className="rounded-lg px-5 py-2 text-sm font-medium transition-all"
              style={tab === 'mensual'
                ? { background: '#4F8CFF', color: '#fff' }
                : { color: '#8892A4' }
              }
            >
              {mesLabel}
            </button>
          </div>

          {/* ── Contenido del tab activo ───────────────── */}
          {tab === 'anual' ? (
            <DashboardAnual
              ingresosPorMes={ingresosPorMes}
              cotizaciones={cotizaciones}
              prospectos={prospectos}
              loading={loading}
              anio={ANIO_ACTUAL}
            />
          ) : (
            <DashboardMensual
              ingresosPorMes={ingresosPorMes}
              cotizaciones={cotizaciones}
              prospectos={prospectos}
              loading={loading}
              mes={MES_ACTUAL}
              anio={ANIO_ACTUAL}
            />
          )}

        </div>
      </div>
    </>
  );
}
