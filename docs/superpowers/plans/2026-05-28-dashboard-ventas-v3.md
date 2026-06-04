# Dashboard Ventas v3 – Premium Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el Dashboard de Ventas con estética dark premium estilo Stripe/Linear. Tab Anual: 4 KPIs + gráfica tendencia + cards TESEY/KUTRA/ARKEO. Tab Mensual: objetivo+ventas+pipeline + funnel comercial + cards marca + tabla oportunidades.

**Architecture:** VentasDashboard.jsx maneja el fetch expandido (cotizaciones con `marca_comercial`, prospectos con `etapa`+`marca_origen`). Dos componentes de tab reescritos con dark theme usando clases Tailwind con colores CSS variables. Nuevos componentes: `MarcaCards`, `FunnelComercial`, `OportunidadesTabla`. Los charts usan colores dark inline en Recharts.

**Tech Stack:** React, Recharts v3.7, Framer Motion, Tailwind CSS (inline dark colors), Supabase.

---

## Paleta dark (usar como literals de Tailwind o inline styles)

```js
// Usar inline style o bg-[#...] en Tailwind
BG       = '#0F1115'   // fondo exterior
CARD     = '#171A21'   // cards
BORDER   = '#262B36'   // bordes
MUTED    = '#8892A4'   // texto secundario
PRIMARY  = '#4F8CFF'   // azul principal
SUCCESS  = '#35C759'   // verde
WARNING  = '#FFB547'   // amarillo
DANGER   = '#FF5C5C'   // rojo
TEXT     = '#E8EDF5'   // texto principal
```

---

## Datos reales confirmados

- **`cotizaciones`**: `id`, `folio`, `estatus`, `total`, `fecha`, `marca_comercial` (tesey|kutra|arkeo), `cliente_id`, `cliente_nombre_externo`, `es_ultima_version`
- **`prospectos`**: `id`, `etapa` (nuevo|contactado|propuesta_enviada|en_negociacion|convertido|descartado), `marca_origen`, `nombre`, `eliminado`
- **`proyecto_pagos`**: `monto`, `fecha_pago`
- **Gastos**: NO EXISTE → la segunda gráfica será "Ingresos reales vs Meta mensual" (misma data que ya tenemos)
- **Marcas**: `tesey`, `kutra`, `arkeo`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/pages/VentasDashboard.jsx` | **Modificar** | Expandir query (marca_comercial en cotizaciones, nombre+marca_origen en prospectos), dark bg wrapper |
| `src/components/ventas/DashboardAnual.jsx` | **Reescribir** | Layout dark: 4 KPIs + 2 charts + MarcaCards |
| `src/components/ventas/DashboardMensual.jsx` | **Reescribir** | Layout dark: 4 KPIs mensuales + FunnelComercial + MarcaCards + OportunidadesTabla |
| `src/components/ventas/MarcaCards.jsx` | **Crear** | Cards TESEY/KUTRA/ARKEO con ventas, crecimiento y % participación |
| `src/components/ventas/FunnelComercial.jsx` | **Crear** | Funnel visual con 5 etapas, tasas de conversión y valor |
| `src/components/ventas/OportunidadesTabla.jsx` | **Crear** | Tabla de cotizaciones activas: cliente, monto, estatus, fecha, marca |

---

## Task 1: Actualizar VentasDashboard – query expandida + dark wrapper

**Files:**
- Modify: `src/pages/VentasDashboard.jsx`

Cambios:
1. Expandir query cotizaciones: agregar `marca_comercial`, `cliente:cliente_id(nombre)`, `fecha`
2. Expandir query prospectos: agregar `nombre`, `marca_origen`
3. Envolver el `<div className="space-y-5">` con dark bg usando negative margins para full bleed
4. Sin cambios en los componentes hijos (eso viene en Tasks 2-6)

- [ ] **Step 1.1: Reemplazar VentasDashboard.jsx**

```jsx
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
```

- [ ] **Step 1.2: Commit**

```bash
git add src/pages/VentasDashboard.jsx
git commit -m "feat(ventas): dark wrapper + query expandida con marca_comercial y nombre prospecto"
```

---

## Task 2: Crear MarcaCards – Cards TESEY / KUTRA / ARKEO

**Files:**
- Create: `src/components/ventas/MarcaCards.jsx`

Cards para las 3 marcas comerciales. Recibe `cotizaciones` y `mode` ('anual'|'mensual'). Muestra para cada marca: valor de cotizaciones aprobadas, número de cotizaciones activas, % participación del total.

- [ ] **Step 2.1: Crear el componente**

```jsx
// src/components/ventas/MarcaCards.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const MARCAS = [
  { id: 'tesey', nombre: 'TESEY',  accent: '#35C759' },
  { id: 'kutra', nombre: 'KUTRA',  accent: '#4F8CFF' },
  { id: 'arkeo', nombre: 'ARKEO',  accent: '#FFB547' },
];

function fmtK(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

/**
 * @param {{
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string, fecha?: string}>,
 *   loading: boolean,
 *   mes?: number,
 *   anio?: number,
 * }} props
 * Si mes/anio se proveen, filtra por mes actual (modo mensual).
 */
export default function MarcaCards({ cotizaciones = [], loading, mes, anio }) {
  const stats = useMemo(() => {
    // Filtrar por mes si se pasa modo mensual
    let cots = cotizaciones;
    if (mes != null && anio != null) {
      const prefix = `${anio}-${String(mes).padStart(2, '0')}`;
      cots = cotizaciones.filter(c => c.fecha && c.fecha.startsWith(prefix));
    }

    const totalValor = cots.reduce((s, c) => s + (Number(c.total) || 0), 0) || 1;

    return MARCAS.map(m => {
      const propias = cots.filter(c => c.marca_comercial === m.id);
      const aprobadas = propias.filter(c => c.estatus === 'Aprobada');
      const activas   = propias.filter(c => ['Borrador', 'Enviada'].includes(c.estatus));
      const valorMarca = propias.reduce((s, c) => s + (Number(c.total) || 0), 0);
      const pct = Math.round((valorMarca / totalValor) * 100);

      return {
        ...m,
        aprobadas:    aprobadas.length,
        activas:      activas.length,
        valor:        valorMarca,
        pct,
        total:        propias.length,
      };
    });
  }, [cotizaciones, mes, anio]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {MARCAS.map(m => (
          <div key={m.id} className="h-32 animate-pulse rounded-xl"
            style={{ background: '#171A21' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {stats.map((m, i) => (
        <motion.div
          key={m.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.07, duration: 0.3 }}
          className="rounded-xl p-5 space-y-4"
          style={{ background: '#171A21', border: '1px solid #262B36' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full" style={{ background: m.accent }} />
              <span className="text-sm font-bold tracking-widest" style={{ color: '#E8EDF5' }}>
                {m.nombre}
              </span>
            </div>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: `${m.accent}20`, color: m.accent }}>
              {m.pct}% del total
            </span>
          </div>

          {/* Valor principal */}
          <div>
            <p className="text-2xl font-bold" style={{ color: '#E8EDF5' }}>
              {fmtK(m.valor)}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#8892A4' }}>
              Valor en cotizaciones
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: '#35C759' }}>
                {m.aprobadas}
              </p>
              <p className="text-xs" style={{ color: '#8892A4' }}>Aprobadas</p>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#4F8CFF' }}>
                {m.activas}
              </p>
              <p className="text-xs" style={{ color: '#8892A4' }}>Activas</p>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#8892A4' }}>
                {m.total}
              </p>
              <p className="text-xs" style={{ color: '#8892A4' }}>Total</p>
            </div>
          </div>

          {/* Barra de participación */}
          <div className="h-1 w-full rounded-full" style={{ background: '#262B36' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${m.pct}%`, background: m.accent }} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2.2: Commit**

```bash
git add src/components/ventas/MarcaCards.jsx
git commit -m "feat(ventas): MarcaCards dark para TESEY/KUTRA/ARKEO con participación"
```

---

## Task 3: Crear FunnelComercial – Funnel visual de prospectos

**Files:**
- Create: `src/components/ventas/FunnelComercial.jsx`

Funnel CSS horizontal que muestra las 5 etapas activas de prospectos. Cada etapa muestra: nombre, conteo, % conversión desde etapa anterior. Excluye `descartado`.

- [ ] **Step 3.1: Crear el componente**

```jsx
// src/components/ventas/FunnelComercial.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const ETAPAS = [
  { id: 'nuevo',            label: 'Prospectos',   color: '#4F8CFF' },
  { id: 'contactado',       label: 'Contactados',  color: '#8B7CF8' },
  { id: 'propuesta_enviada', label: 'Propuesta',   color: '#FFB547' },
  { id: 'en_negociacion',   label: 'Negociación',  color: '#FF8547' },
  { id: 'convertido',       label: 'Convertidos',  color: '#35C759' },
];

/**
 * @param {{
 *   prospectos: Array<{etapa: string}>,
 *   loading: boolean,
 * }} props
 */
export default function FunnelComercial({ prospectos = [], loading }) {
  const data = useMemo(() => {
    return ETAPAS.map(e => ({
      ...e,
      count: prospectos.filter(p => p.etapa === e.id).length,
    }));
  }, [prospectos]);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  if (loading) {
    return (
      <div className="rounded-xl p-6 animate-pulse"
        style={{ background: '#171A21', border: '1px solid #262B36', height: 160 }} />
    );
  }

  return (
    <div className="rounded-xl p-5 space-y-4"
      style={{ background: '#171A21', border: '1px solid #262B36' }}>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: '#E8EDF5' }}>
          Funnel Comercial
        </h3>
        <span className="text-xs" style={{ color: '#8892A4' }}>
          {prospectos.filter(p => p.etapa !== 'descartado').length} prospectos activos
        </span>
      </div>

      {/* Funnel bars */}
      <div className="space-y-2.5">
        {data.map((e, i) => {
          const widthPct = maxCount > 0 ? Math.max(15, Math.round((e.count / maxCount) * 100)) : 15;
          const prevCount = i > 0 ? data[i - 1].count : e.count;
          const convPct = prevCount > 0 && i > 0
            ? Math.round((e.count / prevCount) * 100)
            : null;

          return (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-center gap-3"
            >
              {/* Label */}
              <div className="w-24 shrink-0">
                <p className="text-xs font-medium" style={{ color: '#E8EDF5' }}>{e.label}</p>
                {convPct !== null && (
                  <p className="text-[10px]" style={{ color: '#8892A4' }}>
                    {convPct}% conv.
                  </p>
                )}
              </div>

              {/* Bar + count */}
              <div className="flex flex-1 items-center gap-3">
                <div className="flex-1 h-8 rounded-md overflow-hidden"
                  style={{ background: '#262B36' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ delay: i * 0.06 + 0.2, duration: 0.5, ease: 'easeOut' }}
                    className="h-full rounded-md flex items-center pl-3"
                    style={{ background: e.color }}
                  >
                    <span className="text-xs font-bold text-white">
                      {e.count > 0 ? e.count : ''}
                    </span>
                  </motion.div>
                </div>
                <span className="w-6 text-right text-sm font-bold shrink-0"
                  style={{ color: e.color }}>
                  {e.count}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="flex gap-6 pt-1 border-t" style={{ borderColor: '#262B36' }}>
        <div>
          <p className="text-xs" style={{ color: '#8892A4' }}>Tasa global</p>
          <p className="text-sm font-bold" style={{ color: '#35C759' }}>
            {prospectos.length > 0
              ? `${Math.round((data[4].count / prospectos.length) * 100)}%`
              : '—'
            }
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: '#8892A4' }}>Descartados</p>
          <p className="text-sm font-bold" style={{ color: '#FF5C5C' }}>
            {prospectos.filter(p => p.etapa === 'descartado').length}
          </p>
        </div>
        <div>
          <p className="text-xs" style={{ color: '#8892A4' }}>Total en CRM</p>
          <p className="text-sm font-bold" style={{ color: '#E8EDF5' }}>
            {prospectos.length}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Commit**

```bash
git add src/components/ventas/FunnelComercial.jsx
git commit -m "feat(ventas): FunnelComercial dark con 5 etapas y tasas de conversión"
```

---

## Task 4: Crear OportunidadesTabla – Tabla de cotizaciones activas

**Files:**
- Create: `src/components/ventas/OportunidadesTabla.jsx`

Tabla de cotizaciones con estatus Borrador, Enviada o Aprobada. Columnas: Cliente, Folio, Monto, Estatus, Marca, Fecha. Máximo 10 filas. Sin paginación.

- [ ] **Step 4.1: Crear el componente**

```jsx
// src/components/ventas/OportunidadesTabla.jsx
import React, { useMemo } from 'react';

const ESTATUS_STYLE = {
  Borrador: { color: '#8892A4', bg: '#8892A420' },
  Enviada:  { color: '#4F8CFF', bg: '#4F8CFF20' },
  Aprobada: { color: '#35C759', bg: '#35C75920' },
};

const MARCA_STYLE = {
  tesey: { label: 'TESEY', color: '#35C759' },
  kutra: { label: 'KUTRA', color: '#4F8CFF' },
  arkeo: { label: 'ARKEO', color: '#FFB547' },
};

function fmtMXN(n) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

function fmtFecha(str) {
  if (!str) return '—';
  try {
    return new Date(str + 'T00:00:00').toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: '2-digit',
    });
  } catch { return str; }
}

/**
 * @param {{
 *   cotizaciones: Array<{
 *     id: number, folio: string, estatus: string, total: number,
 *     fecha: string, marca_comercial: string, cliente_nombre: string
 *   }>,
 *   loading: boolean,
 * }} props
 */
export default function OportunidadesTabla({ cotizaciones = [], loading }) {
  const activas = useMemo(() =>
    cotizaciones
      .filter(c => ['Borrador', 'Enviada', 'Aprobada'].includes(c.estatus))
      .sort((a, b) => (b.total || 0) - (a.total || 0))
      .slice(0, 10),
    [cotizaciones]
  );

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: '#171A21', border: '1px solid #262B36' }}>

      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: '1px solid #262B36' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#E8EDF5' }}>
          Oportunidades activas
        </h3>
        <span className="text-xs" style={{ color: '#8892A4' }}>
          {activas.length} cotizaciones
        </span>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded animate-pulse"
              style={{ background: '#262B36' }} />
          ))}
        </div>
      ) : activas.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm" style={{ color: '#8892A4' }}>
            No hay oportunidades activas
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ borderBottom: '1px solid #262B36' }}>
                {['Cliente', 'Folio', 'Monto', 'Estatus', 'Marca', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide"
                    style={{ color: '#8892A4' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activas.map((c, i) => {
                const estStyle  = ESTATUS_STYLE[c.estatus] || ESTATUS_STYLE.Borrador;
                const marcaStyle = MARCA_STYLE[c.marca_comercial] || { label: c.marca_comercial?.toUpperCase() || '—', color: '#8892A4' };
                return (
                  <tr key={c.id}
                    className="transition-colors"
                    style={{
                      borderBottom: i < activas.length - 1 ? '1px solid #262B36' : 'none',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1E2330'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: '#E8EDF5' }}>
                      {c.cliente_nombre || '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: '#8892A4' }}>
                      {c.folio || `#${c.id}`}
                    </td>
                    <td className="px-4 py-3 font-semibold font-mono" style={{ color: '#E8EDF5' }}>
                      {fmtMXN(c.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ background: estStyle.bg, color: estStyle.color }}>
                        {c.estatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold" style={{ color: marcaStyle.color }}>
                        {marcaStyle.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#8892A4' }}>
                      {fmtFecha(c.fecha)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4.2: Commit**

```bash
git add src/components/ventas/OportunidadesTabla.jsx
git commit -m "feat(ventas): OportunidadesTabla dark con cotizaciones activas"
```

---

## Task 5: Reescribir DashboardAnual – Layout dark premium

**Files:**
- Modify: `src/components/ventas/DashboardAnual.jsx`

Layout:
- Fila 1: 4 KPI cards (ventas acumuladas, promedio mensual, crecimiento mensual, tasa conversión)
- Fila 2: Gráfica tendencia anual (12 meses, área azul) — full width
- Fila 3: `MarcaCards` (TESEY/KUTRA/ARKEO)

El gráfico de tendencia lo implementamos inline usando Recharts con colores dark. Ya NO usamos `IngresosChart` (light) aquí — creamos uno dark inline.

- [ ] **Step 5.1: Reescribir el componente completo**

```jsx
// src/components/ventas/DashboardAnual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, Area, AreaChart,
} from 'recharts';
import { METAS_VENTAS, META_ANUAL_2026, fmtMXN, fmtMXNFull } from '@/config/ventasMetas';
import MarcaCards from '@/components/ventas/MarcaCards';

const DARK = {
  card:    '#171A21',
  border:  '#262B36',
  muted:   '#8892A4',
  text:    '#E8EDF5',
  primary: '#4F8CFF',
  success: '#35C759',
  warning: '#FFB547',
  danger:  '#FF5C5C',
};

function DarkKpiCard({ label, value, sub, accent = DARK.primary, delay = 0, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{ background: DARK.card, border: `1px solid ${DARK.border}` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: DARK.muted }}>
        {label}
      </p>
      {loading
        ? <div className="h-7 w-28 rounded animate-pulse" style={{ background: DARK.border }} />
        : <p className="text-2xl font-bold" style={{ color: DARK.text }}>{value}</p>
      }
      {sub && <p className="text-xs" style={{ color: DARK.muted }}>{sub}</p>}
    </motion.div>
  );
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg p-3 text-xs space-y-1 shadow-xl"
      style={{ background: '#1E2330', border: `1px solid ${DARK.border}`, color: DARK.text }}>
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {fmtMXN(p.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string}>,
 *   prospectos: Array<{etapa: string}>,
 *   loading: boolean,
 *   anio: number,
 * }} props
 */
export default function DashboardAnual({ ingresosPorMes, cotizaciones, prospectos, loading, anio }) {
  const NOW_MES = new Date().getMonth() + 1;

  // Totales
  const totalReal = useMemo(
    () => Object.entries(ingresosPorMes)
      .filter(([k]) => k.startsWith(`${anio}-`))
      .reduce((s, [, v]) => s + v, 0),
    [ingresosPorMes, anio]
  );
  const pctAnual = META_ANUAL_2026 > 0
    ? Math.min(100, Math.round((totalReal / META_ANUAL_2026) * 100))
    : 0;

  // Promedio mensual (solo meses con datos)
  const mesesConDatos = useMemo(
    () => Object.entries(ingresosPorMes).filter(([k, v]) => k.startsWith(`${anio}-`) && v > 0).length,
    [ingresosPorMes, anio]
  );
  const promedioMensual = mesesConDatos > 0 ? Math.round(totalReal / mesesConDatos) : 0;

  // Crecimiento vs mes anterior
  const crecimientoMes = useMemo(() => {
    const mesKey = `${anio}-${String(NOW_MES).padStart(2, '0')}`;
    const prevMes = NOW_MES === 1 ? 12 : NOW_MES - 1;
    const prevAnio = NOW_MES === 1 ? anio - 1 : anio;
    const prevKey = `${prevAnio}-${String(prevMes).padStart(2, '0')}`;
    const actual   = ingresosPorMes[mesKey] ?? 0;
    const anterior = ingresosPorMes[prevKey] ?? 0;
    if (anterior === 0) return null;
    return Math.round(((actual - anterior) / anterior) * 100);
  }, [ingresosPorMes, anio, NOW_MES]);

  // Tasa de conversión
  const convertidos = prospectos.filter(p => p.etapa === 'convertido');
  const tasaConv = prospectos.length > 0
    ? Math.round((convertidos.length / prospectos.length) * 100)
    : 0;

  // Data para gráfica anual (AreaChart)
  const chartData = useMemo(() =>
    METAS_VENTAS
      .filter(m => m.anio === anio)
      .map(m => {
        const key = `${m.anio}-${String(m.mes).padStart(2, '0')}`;
        const real = ingresosPorMes[key] ?? null;
        const esPasado = m.mes <= NOW_MES;
        return {
          label: m.label,
          real:  esPasado ? (real ?? 0) : null,
          meta:  m.meta_ingresos,
        };
      }),
    [ingresosPorMes, anio, NOW_MES]
  );

  return (
    <div className="space-y-5">
      {/* ── Fila 1: 4 KPI cards ──────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <DarkKpiCard
          label="Ventas acumuladas"
          value={fmtMXNFull(totalReal)}
          sub={`${pctAnual}% de la meta anual`}
          accent={DARK.primary}
          delay={0}
          loading={loading}
        />
        <DarkKpiCard
          label="Promedio mensual"
          value={fmtMXNFull(promedioMensual)}
          sub={`${mesesConDatos} meses con datos`}
          accent={DARK.primary}
          delay={0.07}
          loading={loading}
        />
        <DarkKpiCard
          label="Crecimiento mensual"
          value={crecimientoMes === null ? '—' : `${crecimientoMes > 0 ? '+' : ''}${crecimientoMes}%`}
          sub="vs mes anterior"
          accent={crecimientoMes === null ? DARK.muted : crecimientoMes >= 0 ? DARK.success : DARK.danger}
          delay={0.14}
          loading={loading}
        />
        <DarkKpiCard
          label="Tasa de conversión"
          value={`${tasaConv}%`}
          sub={`${convertidos.length} de ${prospectos.length} prospectos`}
          accent={DARK.success}
          delay={0.21}
          loading={loading}
        />
      </div>

      {/* ── Fila 2: Tendencia anual ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl p-5"
        style={{ background: DARK.card, border: `1px solid ${DARK.border}` }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: DARK.text }}>
              Tendencia anual {anio}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: DARK.muted }}>
              Ingresos reales vs meta mensual
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs" style={{ color: DARK.muted }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: DARK.primary }} />
              Real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ background: '#6366f1', borderTop: '2px dashed #6366f1' }} />
              Meta
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradAnual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={DARK.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={DARK.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262B36" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: DARK.muted }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtMXN} tick={{ fontSize: 9, fill: DARK.muted }} width={50} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            <ReferenceLine y={250000} stroke={DARK.warning} strokeDasharray="5 5"
              label={{ value: 'PE', position: 'insideTopRight', fontSize: 9, fill: DARK.warning }} />
            <Area dataKey="real" name="Ingreso real" stroke={DARK.primary} fill="url(#gradAnual)"
              strokeWidth={2} dot={{ r: 3, fill: DARK.primary }} activeDot={{ r: 4 }} />
            <Line dataKey="meta" name="Meta" stroke="#6366f1" strokeDasharray="4 4"
              strokeWidth={1.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Fila 3: Cards por marca ───────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <MarcaCards cotizaciones={cotizaciones} loading={loading} />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 5.2: Commit**

```bash
git add src/components/ventas/DashboardAnual.jsx
git commit -m "feat(ventas): DashboardAnual dark premium con KPIs, tendencia y marcas"
```

---

## Task 6: Reescribir DashboardMensual – Layout dark premium

**Files:**
- Modify: `src/components/ventas/DashboardMensual.jsx`

Layout:
- Fila 1: 4 cards (Objetivo mensual con progress bar, Ventas del mes, Cotizaciones activas, Pipeline monetario)
- Fila 2: `FunnelComercial` (full width)
- Fila 3: `MarcaCards` con `mes` y `anio` para filtrar por mes actual
- Fila 4: `OportunidadesTabla`

- [ ] **Step 6.1: Reescribir el componente completo**

```jsx
// src/components/ventas/DashboardMensual.jsx
import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { getMetaMes, PE_MENSUAL, fmtMXNFull } from '@/config/ventasMetas';
import FunnelComercial from '@/components/ventas/FunnelComercial';
import MarcaCards from '@/components/ventas/MarcaCards';
import OportunidadesTabla from '@/components/ventas/OportunidadesTabla';

const DARK = {
  card:    '#171A21',
  border:  '#262B36',
  muted:   '#8892A4',
  text:    '#E8EDF5',
  primary: '#4F8CFF',
  success: '#35C759',
  warning: '#FFB547',
  danger:  '#FF5C5C',
};

function MensualKpiCard({ label, value, sub, progress, progressColor, delay, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl p-5 flex flex-col gap-2"
      style={{ background: DARK.card, border: `1px solid ${DARK.border}` }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: DARK.muted }}>
        {label}
      </p>
      {loading
        ? <div className="h-7 w-28 rounded animate-pulse" style={{ background: DARK.border }} />
        : <p className="text-2xl font-bold" style={{ color: DARK.text }}>{value}</p>
      }
      {sub && <p className="text-xs" style={{ color: DARK.muted }}>{sub}</p>}
      {progress != null && (
        <div className="mt-1 space-y-1">
          <div className="h-1.5 w-full rounded-full" style={{ background: DARK.border }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, progress)}%`, background: progressColor || DARK.primary }} />
          </div>
          <p className="text-[10px]" style={{ color: DARK.muted }}>{Math.min(100, progress)}% del objetivo</p>
        </div>
      )}
    </motion.div>
  );
}

/**
 * @param {{
 *   ingresosPorMes: Record<string, number>,
 *   cotizaciones: Array<{estatus: string, total: number, marca_comercial: string, fecha: string, cliente_nombre: string}>,
 *   prospectos: Array<{etapa: string, marca_origen: string}>,
 *   loading: boolean,
 *   mes: number,
 *   anio: number,
 * }} props
 */
export default function DashboardMensual({ ingresosPorMes, cotizaciones, prospectos, loading, mes, anio }) {
  const metaMes = useMemo(() => getMetaMes(mes, anio), [mes, anio]);

  const ingresoMes = useMemo(() => {
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    return ingresosPorMes[key] ?? 0;
  }, [ingresosPorMes, mes, anio]);

  const meta = metaMes?.meta_ingresos ?? 0;
  const pctMeta = meta > 0 ? Math.min(100, Math.round((ingresoMes / meta) * 100)) : 0;
  const progressColor = ingresoMes >= meta ? DARK.success : pctMeta >= 50 ? DARK.primary : DARK.warning;

  // Cotizaciones activas (Borrador + Enviada)
  const activas  = cotizaciones.filter(c => ['Borrador', 'Enviada'].includes(c.estatus));
  const pipeline = cotizaciones
    .filter(c => ['Borrador', 'Enviada', 'Aprobada'].includes(c.estatus))
    .reduce((s, c) => s + (Number(c.total) || 0), 0);

  return (
    <div className="space-y-5">
      {/* ── Fila 1: 4 KPIs mensuales ─────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MensualKpiCard
          label="Objetivo del mes"
          value={fmtMXNFull(meta)}
          sub={metaMes ? `${metaMes.vs_pe}% del PE` : '—'}
          progress={pctMeta}
          progressColor={progressColor}
          delay={0}
          loading={false}
        />
        <MensualKpiCard
          label="Ventas del mes"
          value={fmtMXNFull(ingresoMes)}
          sub={`PE: ${fmtMXNFull(PE_MENSUAL)}`}
          delay={0.07}
          loading={loading}
        />
        <MensualKpiCard
          label="Cotizaciones activas"
          value={activas.length}
          sub="Borrador + Enviadas"
          delay={0.14}
          loading={loading}
        />
        <MensualKpiCard
          label="Pipeline monetario"
          value={fmtMXNFull(pipeline)}
          sub="Borrador + Enviadas + Aprobadas"
          delay={0.21}
          loading={loading}
        />
      </div>

      {/* ── Fila 2: Funnel comercial ─────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <FunnelComercial prospectos={prospectos} loading={loading} />
      </motion.div>

      {/* ── Fila 3: Cards por marca (filtradas por mes) ─ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <MarcaCards cotizaciones={cotizaciones} loading={loading} mes={mes} anio={anio} />
      </motion.div>

      {/* ── Fila 4: Tabla oportunidades ──────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <OportunidadesTabla cotizaciones={cotizaciones} loading={loading} />
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 6.2: Commit**

```bash
git add src/components/ventas/DashboardMensual.jsx
git commit -m "feat(ventas): DashboardMensual dark premium con funnel, marcas y tabla"
```

---

## Task 7: Build + push

- [ ] **Step 7.1: Build**

```bash
npm run build
```

Resultado esperado: `✓ built` sin errores de código. Las advertencias de CSS y bundle size son pre-existentes.

- [ ] **Step 7.2: Push**

```bash
git push origin main
```

- [ ] **Step 7.3: Verificar en browser**

1. `/ventas/dashboard` → fondo dark #0F1115 en toda la pantalla
2. Tab "Anual 2026": 4 KPI cards + gráfica área azul + 3 cards TESEY/KUTRA/ARKEO
3. Tab "Mayo 2026": 4 KPIs + funnel con 5 etapas + cards marca + tabla oportunidades
4. No hay errores de consola
5. El resto de la app (Layout, sidebar, otras páginas) siguen siendo light mode

---

## Checklist de spec coverage

| Requisito | Task |
|---|---|
| Dark mode premium (Stripe/Linear) | Task 1 (wrapper) + Tasks 5-6 |
| KPI: ventas acum, promedio, crecimiento, conversión | Task 5 |
| Tendencia anual AreaChart | Task 5 |
| Cards TESEY/KUTRA/ARKEO con % participación | Task 2 |
| Funnel comercial visual 5 etapas | Task 3 |
| KPIs mensuales: objetivo+barra, ventas, cotizaciones, pipeline | Task 6 |
| Tabla oportunidades activas | Task 4 |
| Query expandida con marca_comercial y nombre | Task 1 |
| Build + push | Task 7 |
