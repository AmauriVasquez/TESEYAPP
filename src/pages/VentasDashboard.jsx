// src/pages/VentasDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
          .gte('fecha_pago', `${ANIO_ACTUAL}-01-01`),

        supabase
          .from('cotizaciones')
          .select('id, folio, estatus, total, fecha, marca_comercial, cliente:cliente_id(nombre), cliente_nombre_externo')
          .not('estatus', 'in', '("Historial","Obsoleta")')
          .eq('es_ultima_version', true),

        supabase
          .from('prospectos')
          .select('id, etapa, marca_origen, nombre')
          .eq('eliminado', false),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (cotRes.error)   throw cotRes.error;
      if (prospRes.error) throw prospRes.error;

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
  }, [toast, ANIO_ACTUAL]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mesLabel = `${NOMBRES_MES[MES_ACTUAL - 1]} ${ANIO_ACTUAL}`;

  return (
    <>
      <Helmet>
        <title>Dashboard Ventas – IIHEMSA Peninsular</title>
      </Helmet>

      <div className="space-y-5">
        {/* ── Encabezado ─────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard de Ventas</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Seguimiento de metas · Meta anual {ANIO_ACTUAL}: {fmtMXNFull(META_ANUAL_2026)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAll}
            disabled={loading}
            className="gap-2"
          >
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <RefreshCw className="h-4 w-4" aria-hidden="true" />
            }
            Actualizar
          </Button>
        </div>

        {/* ── Error banner ───────────────────────────── */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudieron cargar los datos. Usa el botón{' '}
            <strong>Actualizar</strong> para reintentar.
          </div>
        )}

        {/* ── Tab switcher ───────────────────────────── */}
        <div role="tablist" className="flex rounded-xl border bg-white p-1 shadow-sm w-fit gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'anual'}
            onClick={() => setTab('anual')}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
              tab === 'anual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
          >
            Anual {ANIO_ACTUAL}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mensual'}
            onClick={() => setTab('mensual')}
            className={cn(
              'rounded-lg px-5 py-2 text-sm font-medium transition-colors',
              tab === 'mensual'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            )}
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
    </>
  );
}
