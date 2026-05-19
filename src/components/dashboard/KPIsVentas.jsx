import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

function formatKPIValue(valor, unidad) {
  const n = Number(valor);
  const safe = Number.isFinite(n) ? n : 0;

  if (unidad === 'MXN') {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(safe);
  }
  if (unidad === '%') {
    return `${safe}%`;
  }
  if (unidad === 'número' || unidad === 'numero') {
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Math.round(safe));
  }
  return String(safe);
}

function getRagStatus(definition, valor) {
  if (definition.meta == null || definition.meta === undefined) {
    return null;
  }
  const meta = Number(definition.meta);
  if (!Number.isFinite(meta) || meta === 0) {
    return null;
  }
  const pct = (Number(valor) / meta) * 100;
  const amarillo = Number(definition.umbral_amarillo);
  const rojo = Number(definition.umbral_rojo);

  if (pct >= amarillo) return 'green';
  if (pct >= rojo) return 'yellow';
  return 'red';
}

const RAG_DOT = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

const RAG_LINE = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

const formatMinutesAgo = (dateIso) => {
  if (!dateIso) return null;
  const diffMs = Date.now() - new Date(dateIso).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return 'Actualizado hace menos de 1 minuto';
  if (mins === 1) return 'Actualizado hace 1 minuto';
  return `Actualizado hace ${mins} minutos`;
};

const KPICardSkeleton = () => (
  <motion.div
    className="h-[220px] rounded-xl bg-gray-200 animate-pulse"
    initial={{ opacity: 0.6 }}
    animate={{ opacity: [0.6, 1, 0.6] }}
    transition={{ duration: 1.5, repeat: Infinity }}
  />
);

const MiniSparkline = ({ data, color }) => {
  if (!data?.length) {
    return <motion.div className="h-10 w-full bg-gray-100 rounded" />;
  }

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 4 }}>
        <Line
          type="monotone"
          dataKey="valor"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

const KPICard = ({ definition, valueRow, snapshots }) => {
  const valor = valueRow?.valor_actual ?? 0;
  const rag = getRagStatus(definition, valor);
  const lineColor = rag ? RAG_LINE[rag] : '#94a3b8';
  const hasError = Boolean(valueRow?.error_msg);

  const sparkData = useMemo(() => {
    const points = (snapshots || [])
      .filter((s) => s.kpi_id === definition.id)
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .map((s) => ({ valor: Number(s.valor) || 0, fecha: s.fecha }));
    return points;
  }, [snapshots, definition.id]);

  const showGrowthMeta =
    definition.unidad === '%' &&
    definition.meta != null &&
    Number(definition.meta) === 10;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold leading-tight">
                {definition.nombre}
              </CardTitle>
              {hasError && (
                <Badge variant="destructive" className="text-[10px] shrink-0">
                  Error de cálculo
                </Badge>
              )}
            </div>
            {definition.descripcion && (
              <p className="text-xs text-muted-foreground mt-1">{definition.descripcion}</p>
            )}
          </div>
          {rag && (
            <span
              className={cn('w-3 h-3 rounded-full shrink-0 mt-1', RAG_DOT[rag])}
              title={rag === 'green' ? 'En meta' : rag === 'yellow' ? 'Atención' : 'Bajo umbral'}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {formatKPIValue(valor, definition.unidad)}
          </p>
          {showGrowthMeta && (
            <p className="text-xs text-muted-foreground mt-1">
              Meta: +{definition.meta}% vs promedio
            </p>
          )}
        </div>
        <MiniSparkline data={sparkData} color={lineColor} />
      </CardContent>
    </Card>
  );
};

const KPIsVentas = () => {
  const { toast } = useToast();
  const [definitions, setDefinitions] = useState([]);
  const [valuesByKpiId, setValuesByKpiId] = useState({});
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: defs, error: defsError } = await supabase
        .from('kpi_definitions')
        .select('*')
        .eq('modulo', 'ventas')
        .eq('activo', true)
        .order('orden', { ascending: true });

      if (defsError) throw defsError;

      const kpiList = defs || [];
      setDefinitions(kpiList);

      if (kpiList.length === 0) {
        setValuesByKpiId({});
        setSnapshots([]);
        setLoading(false);
        return;
      }

      const kpiIds = kpiList.map((d) => d.id);

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const sinceStr = since.toISOString().split('T')[0];

      const [valuesRes, snapshotsRes] = await Promise.all([
        supabase
          .from('kpi_values')
          .select('kpi_id, valor_actual, calculado_at, error_msg')
          .in('kpi_id', kpiIds),
        supabase
          .from('kpi_snapshots')
          .select('kpi_id, valor, fecha')
          .in('kpi_id', kpiIds)
          .gte('fecha', sinceStr)
          .order('fecha', { ascending: true }),
      ]);

      if (valuesRes.error) throw valuesRes.error;
      if (snapshotsRes.error) throw snapshotsRes.error;

      const map = {};
      (valuesRes.data || []).forEach((row) => {
        const existing = map[row.kpi_id];
        if (
          !existing ||
          !existing.calculado_at ||
          (row.calculado_at && new Date(row.calculado_at) > new Date(existing.calculado_at))
        ) {
          map[row.kpi_id] = row;
        }
      });
      setValuesByKpiId(map);
      setSnapshots(snapshotsRes.data || []);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Error al cargar KPIs',
        description: error.message,
      });
      setDefinitions([]);
      setValuesByKpiId({});
      setSnapshots([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const mesAnioLabel = useMemo(
    () => format(new Date(), 'MMMM yyyy', { locale: es }),
    []
  );

  const latestCalculadoAt = useMemo(() => {
    const times = Object.values(valuesByKpiId)
      .map((v) => v?.calculado_at)
      .filter(Boolean)
      .map((t) => new Date(t).getTime());
    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [valuesByKpiId]);

  const totalConsolidado = useMemo(() => {
    const first = definitions[0];
    if (!first) return null;
    const row = valuesByKpiId[first.id];
    return formatKPIValue(row?.valor_actual ?? 0, 'MXN');
  }, [definitions, valuesByKpiId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground capitalize">{mesAnioLabel}</p>
          {loading ? (
            <motion.div className="h-10 w-48 bg-gray-200 rounded mt-1 animate-pulse" />
          ) : (
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {totalConsolidado ?? '—'}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">Total consolidado</p>
        </div>
        {!loading && latestCalculadoAt && (
          <Badge variant="secondary" className="w-fit shrink-0">
            {formatMinutesAgo(latestCalculadoAt)}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KPICardSkeleton key={i} />
          ))}
        </div>
      ) : definitions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No hay KPIs de ventas configurados.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {definitions.map((def, index) => (
            <motion.div
              key={def.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <KPICard
                definition={def}
                valueRow={valuesByKpiId[def.id]}
                snapshots={snapshots}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default KPIsVentas;
