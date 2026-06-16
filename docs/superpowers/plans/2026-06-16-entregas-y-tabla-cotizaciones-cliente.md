# Entregas desde Clientes + Tabla de cotizaciones enriquecida — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En el modal `ClienteDetalle`, agregar un botón "Entregas" (reusando `EntregaMasivaModal`) y enriquecer la pestaña Cotizaciones con folios hipervinculados y, en cotizaciones Aprobadas, los estatus de proyecto y de pago — con experiencia **móvil-first** (tarjetas) sin degradar la web (tabla).

**Architecture:** Una RPC `get_cliente_cotizaciones_detalle` agrega cotización+proyecto+pago en un solo round-trip. El frontend la consume en `ClienteDetalle`, renderiza un componente presentacional `ClienteCotizacionesTabla` que decide tarjetas (móvil) vs tabla (escritorio), y monta `EntregaMasivaModal` ya existente con los proyectos elegibles del cliente.

**Tech Stack:** Supabase (Postgres 17, RPC), React 19 + Vite, Tailwind, `react-router-dom` (`useNavigate`), `@/lib/customSupabaseClient`.

**Verificación (este repo no tiene test runner):** cada tarea de código termina con `npm run lint` (sin errores nuevos en los archivos tocados) y, en la última de código, `npm run build`. Las RPC se verifican con SQL directo. project_id Supabase: `czbmqzimjlwwgcglubey`. **La RPC la aplica el propio asistente con `apply_migration` (ya tiene acceso a la BD de producción).**

---

## File Structure

- **Create:** `supabase/migrations/2026-06-16_get_cliente_cotizaciones_detalle.sql` — la RPC (referencia + aplicada en BD).
- **Create:** `src/components/clientes/ClienteCotizacionesTabla.jsx` — presentacional: tarjetas (móvil) / tabla (escritorio), hipervínculos y estatus apilado.
- **Modify:** `src/components/clientes/ClienteDetalle.jsx` — botón Entregas + montaje de `EntregaMasivaModal` + carga de proyectos elegibles + consumo de la RPC + refresco.

---

## Task 1: RPC `get_cliente_cotizaciones_detalle`

**Files:**
- Create: `supabase/migrations/2026-06-16_get_cliente_cotizaciones_detalle.sql`

- [ ] **Step 1: Escribir el SQL de la función**

```sql
-- supabase/migrations/2026-06-16_get_cliente_cotizaciones_detalle.sql
create or replace function public.get_cliente_cotizaciones_detalle(p_cliente_id integer)
returns table (
  id integer,
  folio text,
  descripcion text,
  fecha date,
  total numeric,
  estatus text,
  proyecto_id integer,
  proyecto_folio text,
  proyecto_estatus text,
  pagado numeric,
  pago_estatus text
)
language sql
stable
security definer
set search_path = public
as $$
  with cot as (
    select c.id, c.folio, c.descripcion, c.fecha, c.total, c.estatus
    from cotizaciones c
    where c.cliente_id = p_cliente_id and c.es_ultima_version = true
  ),
  proy as (
    select distinct on (cot.id)
      cot.id        as cot_id,
      pr.id         as proyecto_id,
      pr.folio      as proyecto_folio,
      pr.estatus    as proyecto_estatus
    from cot
    join proyectos pr
      on pr.cotizacion_id = cot.id
      or (
        pr.cotizacion_folio is not null and cot.folio is not null
        and regexp_replace(pr.cotizacion_folio, '-V[0-9]+$', '')
            = regexp_replace(cot.folio, '-V[0-9]+$', '')
      )
    where pr.cliente_id = p_cliente_id
    order by cot.id, pr.id
  ),
  pag as (
    select proy.proyecto_id, coalesce(sum(pg.monto), 0)::numeric as pagado
    from proy
    left join proyecto_pagos pg on pg.proyecto_id = proy.proyecto_id
    group by proy.proyecto_id
  )
  select
    cot.id, cot.folio, cot.descripcion, cot.fecha, cot.total, cot.estatus,
    proy.proyecto_id, proy.proyecto_folio, proy.proyecto_estatus,
    coalesce(pag.pagado, 0)::numeric as pagado,
    case
      when cot.total > 0 and coalesce(pag.pagado, 0) >= cot.total then 'Pagado'
      when coalesce(pag.pagado, 0) > 0 then 'Parcial'
      else 'Pendiente'
    end as pago_estatus
  from cot
  left join proy on proy.cot_id = cot.id
  left join pag  on pag.proyecto_id = proy.proyecto_id
  order by cot.fecha desc nulls last, cot.id desc;
$$;

grant execute on function public.get_cliente_cotizaciones_detalle(integer) to anon, authenticated;
```

Notas de diseño:
- Empareja proyecto por `cotizacion_id` directo, con respaldo por familia de folio
  (`CTZ-050-V2` → `CTZ-050`), guardando contra nulos para evitar match espurio.
- `distinct on (cot.id) ... order by cot.id, pr.id` toma un solo proyecto por cotización
  (el de menor `id`).
- `pago_estatus` derivado de pagos vs `total`; `Pendiente` cubre total=0 o sin proyecto.

- [ ] **Step 2: Aplicar la RPC en producción**

El asistente la aplica con `apply_migration` (name: `get_cliente_cotizaciones_detalle`,
project_id: `czbmqzimjlwwgcglubey`) usando el SQL anterior.

- [ ] **Step 3: Verificar con un cliente real (SQL Editor o execute_sql)**

```sql
select * from public.get_cliente_cotizaciones_detalle(<ID_con_proyectos>);
```
Esperado: filas con `proyecto_folio`/`proyecto_estatus` para cotizaciones Aprobadas con
proyecto; `pago_estatus` coherente (Pagado/Parcial/Pendiente).

- [ ] **Step 4: Verificar un cliente sin proyectos**

```sql
select * from public.get_cliente_cotizaciones_detalle(<ID_sin_proyectos>);
```
Esperado: filas con `proyecto_id = null`, `pagado = 0`, `pago_estatus = 'Pendiente'`, sin error.

- [ ] **Step 5: Commit del archivo de migración**

```bash
git add supabase/migrations/2026-06-16_get_cliente_cotizaciones_detalle.sql
git commit -m "feat(db): get_cliente_cotizaciones_detalle (proyecto + pago por cotizacion)"
```

---

## Task 2: Botón "Entregas" + montaje de `EntregaMasivaModal` en `ClienteDetalle`

**Files:**
- Modify: `src/components/clientes/ClienteDetalle.jsx`

- [ ] **Step 1: Añadir imports (navegación, modal, iconos)**

En `src/components/clientes/ClienteDetalle.jsx`, en la zona de imports:

```jsx
import { useNavigate } from 'react-router-dom';
import EntregaMasivaModal from '@/components/proyectos/EntregaMasivaModal';
import { PackageCheck } from 'lucide-react';
```

(Conserva el import existente de `lucide-react`; agrega `PackageCheck` a esa línea o
añade la línea separada como arriba — ambas válidas, sin duplicar `PackageCheck`.)

- [ ] **Step 2: Añadir estado de entregas y de proyectos elegibles**

Después de la línea `const { toast } = useToast();` (dentro del componente), añadir:

```jsx
  const navigate = useNavigate();
  const [proyectosCliente, setProyectosCliente] = useState([]);
  const [entregaOpen, setEntregaOpen] = useState(false);
```

- [ ] **Step 3: Cargar proyectos del cliente al abrir el modal**

Después del `useEffect` del resumen (el que llama `get_cliente_resumen`), añadir:

```jsx
  useEffect(() => {
    if (!open || !cliente?.id) {
      setProyectosCliente([]);
      return;
    }
    let cancelled = false;
    supabase
      .from('proyectos')
      .select('id, folio, descripcion, cotizacion_id, estatus')
      .eq('cliente_id', cliente.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        setProyectosCliente(error ? [] : (data || []));
      });
    return () => {
      cancelled = true;
    };
  }, [open, cliente?.id]);
```

- [ ] **Step 4: Calcular proyectos elegibles (misma regla que la página Proyectos)**

Antes del `return` del componente (después de `if (!cliente) return null;`), añadir:

```jsx
  const proyectosElegibles = proyectosCliente.filter(
    (p) => Boolean(p.cotizacion_id) && p.estatus !== 'Entregado'
  );
```

- [ ] **Step 5: Añadir el botón "Entregas" en el header (táctil en móvil)**

En `DialogHeader`, junto al botón "Editar", reemplazar el bloque del botón Editar por un
contenedor con ambos botones:

```jsx
          <div className="mt-2 flex flex-wrap gap-2">
            {onEdit && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2 h-11 sm:h-9"
                onClick={() => onEdit(cliente)}
              >
                <Pencil className="w-4 h-4" />
                Editar
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="gap-2 h-11 sm:h-9 bg-teal-600 hover:bg-teal-700"
              disabled={proyectosElegibles.length === 0}
              title={
                proyectosElegibles.length === 0
                  ? 'Sin proyectos por entregar'
                  : undefined
              }
              onClick={() => setEntregaOpen(true)}
            >
              <PackageCheck className="w-4 h-4" />
              Entregas
            </Button>
          </div>
```

- [ ] **Step 6: Montar `EntregaMasivaModal` antes de cerrar el componente**

Justo antes de `</Dialog>` (al final del JSX), añadir:

```jsx
        <EntregaMasivaModal
          open={entregaOpen}
          onOpenChange={setEntregaOpen}
          proyectos={proyectosElegibles}
          onSuccess={() => {
            setEntregaOpen(false);
            // Refrescar proyectos del cliente (estatus pudo cambiar a Entregado)
            if (cliente?.id) {
              supabase
                .from('proyectos')
                .select('id, folio, descripcion, cotizacion_id, estatus')
                .eq('cliente_id', cliente.id)
                .then(({ data, error }) => setProyectosCliente(error ? [] : (data || [])));
            }
          }}
        />
```

(En la Task 3 se amplía `onSuccess` para refrescar también la tabla y los KPIs.)

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: sin errores nuevos en `ClienteDetalle.jsx`.

- [ ] **Step 8: Commit**

```bash
git add src/components/clientes/ClienteDetalle.jsx
git commit -m "feat(clientes): boton Entregas en perfil de cliente (entrega masiva)"
```

---

## Task 3: Componente `ClienteCotizacionesTabla` + consumo de la RPC

**Files:**
- Create: `src/components/clientes/ClienteCotizacionesTabla.jsx`
- Modify: `src/components/clientes/ClienteDetalle.jsx`

- [ ] **Step 1: Crear el componente presentacional (tarjetas móvil / tabla escritorio)**

```jsx
// src/components/clientes/ClienteCotizacionesTabla.jsx
import React from 'react';
import { Loader2 } from 'lucide-react';

const ESTATUS_COT_BADGE = {
  Borrador: 'bg-gray-100 text-gray-800',
  Enviada: 'bg-blue-100 text-blue-800',
  Aprobada: 'bg-green-100 text-green-800',
  Rechazada: 'bg-red-100 text-red-800',
  Historial: 'bg-slate-200 text-slate-700',
  Obsoleta: 'bg-slate-200 text-slate-600',
};

const ESTATUS_PROY_BADGE = {
  'Por Iniciar': 'bg-gray-100 text-gray-700',
  'Solicitud de Materiales': 'bg-amber-100 text-amber-800',
  Terminado: 'bg-blue-100 text-blue-800',
  Entregado: 'bg-green-100 text-green-800',
};

const PAGO_BADGE = {
  Pagado: 'bg-green-100 text-green-800',
  Parcial: 'bg-amber-100 text-amber-800',
  Pendiente: 'bg-red-100 text-red-800',
};

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(
    value + (String(value).includes('T') ? '' : 'T00:00:00')
  ).toLocaleDateString('es-MX');
};

const formatMXN = (value) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(value) || 0);

const Badge = ({ text, className }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${className ?? 'bg-gray-100 text-gray-800'}`}>
    {text}
  </span>
);

const FolioLink = ({ children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="font-mono text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 min-h-[32px]"
  >
    {children}
  </button>
);

// Bloque de estatus apilado: cotización + (si Aprobada) proyecto + pago.
const EstatusStack = ({ row }) => (
  <div className="flex flex-col items-start gap-1">
    <Badge text={row.estatus} className={ESTATUS_COT_BADGE[row.estatus]} />
    {row.estatus === 'Aprobada' && (
      <>
        <Badge
          text={row.proyecto_estatus || 'Sin proyecto'}
          className={row.proyecto_estatus ? ESTATUS_PROY_BADGE[row.proyecto_estatus] : 'bg-gray-100 text-gray-500'}
        />
        <Badge text={`Pago: ${row.pago_estatus}`} className={PAGO_BADGE[row.pago_estatus]} />
      </>
    )}
  </div>
);

const ClienteCotizacionesTabla = ({ rows, loading, onAbrirCotizacion, onAbrirProyecto }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <p className="text-sm">Sin cotizaciones registradas para este cliente.</p>
      </div>
    );
  }

  return (
    <>
      {/* Móvil: tarjetas apiladas */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <FolioLink onClick={() => onAbrirCotizacion(row.id)}>{row.folio}</FolioLink>
              <span className="text-right font-semibold text-gray-900 whitespace-nowrap">
                {formatMXN(row.total)}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-700 break-words">{row.descripcion}</p>
            <p className="mt-0.5 text-xs text-gray-500">{formatDate(row.fecha)}</p>
            {row.proyecto_id ? (
              <p className="mt-1 text-xs text-gray-600">
                Proyecto:{' '}
                <FolioLink onClick={() => onAbrirProyecto(row.proyecto_id)}>
                  {row.proyecto_folio}
                </FolioLink>
              </p>
            ) : null}
            <div className="mt-2">
              <EstatusStack row={row} />
            </div>
          </div>
        ))}
      </div>

      {/* Escritorio: tabla */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left py-2 px-2 font-semibold">Folio</th>
              <th className="text-left py-2 px-2 font-semibold">Descripción</th>
              <th className="text-left py-2 px-2 font-semibold">Fecha</th>
              <th className="text-right py-2 px-2 font-semibold">Total</th>
              <th className="text-left py-2 px-2 font-semibold">Proyecto</th>
              <th className="text-left py-2 px-2 font-semibold">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 align-top">
                <td className="py-2 px-2">
                  <FolioLink onClick={() => onAbrirCotizacion(row.id)}>{row.folio}</FolioLink>
                </td>
                <td className="py-2 px-2 text-gray-700 max-w-[160px]">
                  <span className="block truncate" title={row.descripcion}>{row.descripcion}</span>
                </td>
                <td className="py-2 px-2 text-gray-500 whitespace-nowrap">{formatDate(row.fecha)}</td>
                <td className="py-2 px-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                  {formatMXN(row.total)}
                </td>
                <td className="py-2 px-2">
                  {row.proyecto_id ? (
                    <FolioLink onClick={() => onAbrirProyecto(row.proyecto_id)}>
                      {row.proyecto_folio}
                    </FolioLink>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="py-2 px-2"><EstatusStack row={row} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default ClienteCotizacionesTabla;
```

- [ ] **Step 2: Lint del nuevo componente**

Run: `npm run lint`
Expected: sin errores nuevos en `ClienteCotizacionesTabla.jsx`.

- [ ] **Step 3: Importar el componente en `ClienteDetalle`**

En `src/components/clientes/ClienteDetalle.jsx`, en la zona de imports:

```jsx
import ClienteCotizacionesTabla from '@/components/clientes/ClienteCotizacionesTabla';
```

- [ ] **Step 4: Cambiar el fetch de la pestaña a la RPC**

Reemplazar el cuerpo de `fetchCotizaciones` (el `select` de la tabla `cotizaciones`) por
la llamada a la RPC, conservando el manejo de loading/loaded/toast:

```jsx
  const fetchCotizaciones = useCallback(async () => {
    if (!cliente?.id) return;
    setLoadingCotizaciones(true);
    const { data, error } = await supabase.rpc('get_cliente_cotizaciones_detalle', {
      p_cliente_id: cliente.id,
    });
    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron cargar las cotizaciones.',
      });
      setCotizaciones([]);
      // No marcar cotizacionesLoaded — permite reintento al volver a la pestaña
    } else {
      setCotizaciones(Array.isArray(data) ? data : []);
      setCotizacionesLoaded(true);
    }
    setLoadingCotizaciones(false);
  }, [cliente?.id, toast]);
```

- [ ] **Step 5: Reemplazar el render de la tabla por el componente y añadir handlers de navegación**

En `TabsContent value="cotizaciones"`, reemplazar todo el bloque condicional
(`loadingCotizaciones ? ... : cotizaciones.length === 0 ? ... : <table>...`) por:

```jsx
          <TabsContent value="cotizaciones" className="mt-4">
            <ClienteCotizacionesTabla
              rows={cotizaciones}
              loading={loadingCotizaciones}
              onAbrirCotizacion={(id) => {
                onOpenChange(false);
                navigate('/cotizaciones', { state: { openCotizacionId: id } });
              }}
              onAbrirProyecto={(id) => {
                onOpenChange(false);
                navigate(`/proyectos/${id}`);
              }}
            />
          </TabsContent>
```

- [ ] **Step 6: Eliminar código muerto en `ClienteDetalle`**

Quitar de `ClienteDetalle.jsx` lo que ahora vive en el componente o quedó sin uso:
- La constante `ESTATUS_COT_BADGE` (movida al nuevo componente).
- Los helpers `formatDate` y `formatMXN` **solo si** ya no se usan en el archivo
  (verificar: si `InfoRow`/KPIs no los usan, eliminarlos; si se usan, conservarlos).
- Imports de `lucide-react` que queden sin uso tras los cambios (p. ej. si `FileText`/`Loader2`
  ya no se referencian). Ejecutar `npm run lint` para detectarlos.

- [ ] **Step 7: Ampliar `onSuccess` de `EntregaMasivaModal` para refrescar tabla y KPIs**

Reemplazar el `onSuccess` añadido en Task 2 por uno que refresque proyectos, tabla y resumen:

```jsx
          onSuccess={() => {
            setEntregaOpen(false);
            if (!cliente?.id) return;
            // Proyectos del cliente (estatus pudo cambiar a Entregado)
            supabase
              .from('proyectos')
              .select('id, folio, descripcion, cotizacion_id, estatus')
              .eq('cliente_id', cliente.id)
              .then(({ data, error }) => setProyectosCliente(error ? [] : (data || [])));
            // Tabla de cotizaciones
            fetchCotizaciones();
            // KPIs
            supabase
              .rpc('get_cliente_resumen', { p_cliente_id: cliente.id })
              .then(({ data, error }) => {
                if (error) { setResumenError(true); setResumen(null); }
                else setResumen(Array.isArray(data) ? data[0] ?? null : data);
              });
          }}
```

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: sin errores nuevos en `ClienteDetalle.jsx` ni `ClienteCotizacionesTabla.jsx`.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 10: Verificación manual (móvil y escritorio)**

Run: `npm run dev`.
- **Móvil (~390px)**: abrir un cliente → pestaña Cotizaciones se ve como tarjetas; tocar
  folio de cotización abre la cotización; tocar folio de proyecto abre el proyecto; una
  cotización Aprobada muestra los 3 badges (cotización, proyecto, pago). Botón "Entregas"
  abre el flujo por pasos; entregar uno completo y otro parcial; al cerrar, la tabla y los
  KPIs reflejan el cambio.
- **Escritorio**: misma información en formato tabla, con la columna Proyecto enlazada.

- [ ] **Step 11: Commit**

```bash
git add src/components/clientes/ClienteCotizacionesTabla.jsx src/components/clientes/ClienteDetalle.jsx
git commit -m "feat(clientes): tabla de cotizaciones con proyecto/pago e hipervinculos (movil-first)"
```

---

## Despliegue (al cerrar la feature)

- [ ] `npm run build`, commit del `dist/`, push a `origin/main` (despliegue manual a Hostinger/tesey.com.mx).

---

## Self-Review (cobertura del spec)

- Botón Entregas en perfil de cliente → Task 2. ✓
- Reuso de `EntregaMasivaModal` con proyectos elegibles (regla `cotizacion_id` y `≠ Entregado`) → Task 2 Step 4. ✓
- Botón deshabilitado sin proyectos elegibles → Task 2 Step 5. ✓
- Refresco de tabla + KPIs tras entregar → Task 3 Step 7. ✓
- Folio cotización hipervínculo (`openCotizacionId`) → Task 3 Step 5. ✓
- Folio proyecto hipervínculo (`/proyectos/:id`) → Task 3 Step 5. ✓
- Estatus apilado (cotización + proyecto + pago) solo si Aprobada → Task 3 Step 1 (`EstatusStack`). ✓
- Estatus de pago derivado (Pagado/Parcial/Pendiente) → Task 1 (RPC). ✓
- Respaldo por familia de folio para versionado → Task 1 (RPC). ✓
- Móvil-first (tarjetas) + web (tabla) → Task 3 Step 1 (`sm:hidden` / `hidden sm:block`). ✓
- Cotización Aprobada sin proyecto → "Sin proyecto" + Pago Pendiente → Task 1 + Task 3. ✓
