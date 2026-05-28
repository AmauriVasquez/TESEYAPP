// src/pages/VentasDashboard.jsx
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { getMetaMes, META_ANUAL_2026, fmtMXNFull } from '@/config/ventasMetas';
import KpiHero from '@/components/ventas/KpiHero';
import IngresosChart from '@/components/ventas/IngresosChart';
import MetasTabla from '@/components/ventas/MetasTabla';
import PipelineCards from '@/components/ventas/PipelineCards';

const NOW = new Date();
const MES_ACTUAL  = NOW.getMonth() + 1;
const ANIO_ACTUAL = NOW.getFullYear();

export default function VentasDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ingresosPorMes, setIngresosPorMes] = useState({});
  const [cotizaciones, setCotizaciones]     = useState([]);
  const [prospectos, setProspectos]         = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pagosRes, cotRes, prospRes] = await Promise.all([
        // Pagos/ingresos reales desde proyecto_pagos
        supabase
          .from('proyecto_pagos')
          .select('monto, fecha_pago')
          .gte('fecha_pago', '2026-01-01'),

        // Cotizaciones activas (excluyendo Historial y Obsoleta)
        supabase
          .from('cotizaciones')
          .select('estatus, total, fecha')
          .not('estatus', 'in', '("Historial","Obsoleta")'),

        // Prospectos no eliminados
        supabase
          .from('prospectos')
          .select('id, estatus')
          .eq('eliminado', false),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (cotRes.error)   throw cotRes.error;
      if (prospRes.error) throw prospRes.error;

      // Agrupar pagos por "YYYY-MM"
      const mapa = {};
      for (const pago of pagosRes.data || []) {
        if (!pago.fecha_pago) continue;
        const key = pago.fecha_pago.slice(0, 7); // "2026-05"
        mapa[key] = (mapa[key] || 0) + Number(pago.monto || 0);
      }
      setIngresosPorMes(mapa);
      setCotizaciones(cotRes.data || []);
      setProspectos(prospRes.data || []);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al cargar dashboard', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const metaMes   = useMemo(() => getMetaMes(MES_ACTUAL, ANIO_ACTUAL), []);
  const ingresoMes = useMemo(() => {
    const key = `${ANIO_ACTUAL}-${String(MES_ACTUAL).padStart(2, '0')}`;
    return ingresosPorMes[key] ?? 0;
  }, [ingresosPorMes]);

  // Progreso anual 2026
  const totalReal2026 = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k]) => k.startsWith('2026-'))
      .reduce((s, [, v]) => s + v, 0),
    [ingresosPorMes]
  );
  const pctAnual2026 = META_ANUAL_2026 > 0
    ? Math.min(100, Math.round((totalReal2026 / META_ANUAL_2026) * 100))
    : 0;

  return (
    <>
      <Helmet>
        <title>Dashboard Ventas – IIHEMSA Peninsular</title>
      </Helmet>

      <div className="space-y-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard de Ventas</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Seguimiento de metas · Meta anual 2026: {fmtMXNFull(META_ANUAL_2026)}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </Button>
        </div>

        {/* Barra de progreso anual 2026 */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Avance anual 2026</p>
            <p className="text-sm font-bold text-gray-900">
              {fmtMXNFull(totalReal2026)} / {fmtMXNFull(META_ANUAL_2026)} · <span className={pctAnual2026 >= 100 ? 'text-green-700' : 'text-blue-700'}>{pctAnual2026}%</span>
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-blue-500 to-indigo-600"
              style={{ width: `${pctAnual2026}%` }}
            />
          </div>
        </div>

        {/* KPI Hero del mes */}
        <KpiHero metaMes={metaMes} ingresoReal={ingresoMes} loading={loading} />

        {/* Gráfica */}
        <IngresosChart ingresosPorMes={ingresosPorMes} anio={2026} />

        {/* Pipeline */}
        <PipelineCards cotizaciones={cotizaciones} prospectos={prospectos} loading={loading} />

        {/* Tabla completa */}
        <MetasTabla ingresosPorMes={ingresosPorMes} />
      </div>
    </>
  );
}
