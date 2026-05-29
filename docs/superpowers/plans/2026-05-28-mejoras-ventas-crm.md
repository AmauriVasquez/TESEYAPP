# Mejoras de ventas/CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver 5 problemas de ventas/CRM: ventanas que se cierran al cambiar de pestaña / tomar foto en entregas móvil, flujo CRM completo (cotizar desde prospecto + auto-conversión + métricas), rediseño de Prospectos como tabla estilo Monday y validaciones del formulario de cliente.

**Architecture:** Cambios mínimos aprovechando que la BD ya tiene las columnas (`cotizaciones.prospecto_id`, `clientes.prospecto_id`, etc.). El bug de ventanas se arregla en una sola fuente (`SupabaseAuthContext`). La auto-conversión se hace con un trigger en `cotizaciones`. La UI sigue patrones existentes (shadcn/ui, light mode).

**Tech Stack:** React 19 + Vite, Tailwind, Supabase (Postgres), shadcn/ui, lucide-react.

**Verificación:** No hay framework de tests. Cada tarea verifica con `npm run build` (debe compilar) y `npm run lint`, más pasos manuales en navegador/móvil. NO commitear `dist/`.

---

## Subagente A — Puntos 1 + 2: Estabilizar sesión Supabase

**Files:**
- Modify: `src/contexts/SupabaseAuthContext.jsx`

### Task A1: Ignorar eventos de auth que no cambian la identidad

- [ ] **Step 1: Editar `SupabaseAuthContext.jsx`**

Agregar `useRef` al import de React (ya importa `useEffect, useState, useCallback, useMemo`):

```jsx
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
```

Dentro de `AuthProvider`, después de los `useState`, añadir un ref para recordar el usuario actual:

```jsx
  const currentUserIdRef = useRef(null);
```

Modificar `handleSession` para mantener el ref en sync:

```jsx
  const handleSession = useCallback(async (session) => {
    currentUserIdRef.current = session?.user?.id ?? null;
    setSession(session);
    setUser(session?.user ?? null);
    setLoading(false);
  }, []);
```

Reemplazar el bloque `onAuthStateChange` (dentro del `useEffect`) por:

```jsx
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const newUserId = session?.user?.id ?? null;
        // Eventos como TOKEN_REFRESHED / SIGNED_IN / INITIAL_SESSION se disparan al
        // cambiar de pestaña o al abrir la cámara (foto de entrega en móvil). Si el
        // usuario no cambió, NO actualizamos estado: evita re-render que desmonta los
        // modales abiertos (cotización, cliente, pedido, entrega).
        if (newUserId && newUserId === currentUserIdRef.current) {
          currentUserIdRef.current = newUserId;
          return;
        }
        handleSession(session);
      }
    );
```

- [ ] **Step 2: Verificar build y lint**

Run: `npm run build` → Expected: build OK sin errores.
Run: `npm run lint` → Expected: sin errores nuevos en `SupabaseAuthContext.jsx`.

- [ ] **Step 3: Verificación manual (escritorio)**

1. Abrir la app (`npm run dev`), iniciar sesión.
2. Abrir una ventana de cotización (o cliente nuevo) con datos a medio llenar.
3. Cambiar a otra pestaña del navegador y volver.
Expected: la ventana sigue abierta con los datos intactos.

- [ ] **Step 4: Verificación manual (móvil) — Punto 2**

1. En un celular, abrir un proyecto con cotización y abrir "Registrar entrega".
2. Elegir entrega parcial/completa → cantidades → datos → **tomar foto** → pasar a **firma**.
Expected: la ventana NO se cierra al pasar a firma; se puede firmar y "Guardar entrega" registra la entrega.
Nota: si el lienzo de firma aparece en blanco/mal dimensionado tras volver de la cámara, revisar que el `ResizeObserver` de `SignaturePad` re-dibuje (debería; reportar si no).

- [ ] **Step 5: Commit**

```bash
git add src/contexts/SupabaseAuthContext.jsx
git commit -m "fix(auth): no cerrar ventanas al refrescar sesión en cambio de pestaña/cámara"
```

---

## Subagente C — Punto 5: Validaciones del formulario de cliente

**Files:**
- Modify: `src/components/clientes/ClienteDialog.jsx`

### Task C1: RFC/Email "No aplica" y teléfono obligatorio

- [ ] **Step 1: Estado de las casillas "No aplica"**

En `ClienteDialog`, junto a los otros `useState`, agregar:

```jsx
  const [rfcNoAplica, setRfcNoAplica] = useState(false);
  const [emailNoAplica, setEmailNoAplica] = useState(false);
```

En el `useEffect` que resetea/llena el formulario, inicializar las casillas según los datos (al editar, marcar "No aplica" si el campo viene vacío; al crear, desmarcadas). Dentro del bloque `if (clienteToEdit) {` después de `setUsarMismoNombre(false);` agregar:

```jsx
        setRfcNoAplica(!clienteToEdit.rfc);
        setEmailNoAplica(!clienteToEdit.email);
```

Y en el bloque `else {` (nuevo cliente), después de `setUsarMismoNombre(false);` agregar:

```jsx
        setRfcNoAplica(false);
        setEmailNoAplica(false);
```

- [ ] **Step 2: Handlers de las casillas**

Agregar después de `handleCheckboxChange`:

```jsx
  const handleRfcNoAplica = (checked) => {
    setRfcNoAplica(checked);
    if (checked) setFormData((prev) => ({ ...prev, rfc: '' }));
  };

  const handleEmailNoAplica = (checked) => {
    setEmailNoAplica(checked);
    if (checked) setFormData((prev) => ({ ...prev, email: '' }));
  };
```

- [ ] **Step 3: Validar teléfono en `performSave`**

Al inicio de `performSave`, antes de `setLoading(true);`, agregar:

```jsx
    if (!String(formData.telefono).trim()) {
      toast({
        variant: 'destructive',
        title: 'Teléfono requerido',
        description: 'Captura un número de teléfono para guardar el cliente.',
      });
      return;
    }
```

- [ ] **Step 4: UI — RFC con casilla "No aplica"**

Reemplazar el bloque del campo RFC (el `<div className="grid gap-2">` que contiene `Label htmlFor="rfc"` y su `Input`) por:

```jsx
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rfc">RFC</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox id="rfcNoAplica" checked={rfcNoAplica} onCheckedChange={handleRfcNoAplica} />
                  <label htmlFor="rfcNoAplica" className="text-xs font-medium text-gray-500 cursor-pointer">
                    No aplica
                  </label>
                </div>
              </div>
              <Input
                id="rfc"
                value={formData.rfc}
                onChange={handleChange}
                placeholder="XAXX010101000"
                disabled={rfcNoAplica}
              />
            </div>
```

- [ ] **Step 5: UI — Teléfono obligatorio**

En el campo teléfono, marcar el label como requerido. Reemplazar `<Label htmlFor="telefono">Teléfono</Label>` por:

```jsx
              <Label htmlFor="telefono">Teléfono *</Label>
```

Y agregar `required` al `Input` de teléfono:

```jsx
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={handleChange}
                placeholder="(999) 123-4567"
                required
              />
```

- [ ] **Step 6: UI — Email con casilla "No aplica"**

Reemplazar el bloque del campo email (`<div className="grid gap-2">` con `Label htmlFor="email"`) por:

```jsx
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Correo Electrónico</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="emailNoAplica" checked={emailNoAplica} onCheckedChange={handleEmailNoAplica} />
                <label htmlFor="emailNoAplica" className="text-xs font-medium text-gray-500 cursor-pointer">
                  No aplica
                </label>
              </div>
            </div>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="contacto@empresa.com"
              disabled={emailNoAplica}
            />
          </div>
```

- [ ] **Step 7: Build + lint**

Run: `npm run build` → Expected: OK.
Run: `npm run lint` → Expected: sin errores nuevos.

- [ ] **Step 8: Verificación manual**

1. Nuevo cliente sin RFC: marcar "No aplica" en RFC → el campo se deshabilita → se puede guardar.
2. Nuevo cliente sin email: marcar "No aplica" en email → se puede guardar.
3. Intentar guardar sin teléfono → aparece toast "Teléfono requerido" y NO guarda.
4. Con teléfono → guarda correctamente.

- [ ] **Step 9: Commit**

```bash
git add src/components/clientes/ClienteDialog.jsx
git commit -m "feat(clientes): RFC/email 'No aplica' y teléfono obligatorio"
```

---

## Subagente B — Punto 3: Flujo CRM completo

**Files:**
- Migration (Supabase): trigger `crm_autoconvertir_al_aprobar` en `cotizaciones`
- Modify: `src/components/crm/ProspectoDetalle.jsx` (botón "Generar cotización")
- Modify: `src/components/cotizaciones/CotizacionDialog.jsx` (aceptar prospecto precargado)
- Modify: `src/pages/Prospectos.jsx` (tarjetas de métricas en el encabezado)

### Task B1: Trigger de auto-conversión al aprobar cotización

- [ ] **Step 1: Aplicar migración**

Usar la herramienta Supabase `apply_migration` (project_id `czbmqzimjlwwgcglubey`), nombre `crm_autoconvertir_al_aprobar`, con este SQL:

```sql
create or replace function public.crm_autoconvertir_al_aprobar()
returns trigger
language plpgsql
security definer
as $$
declare
  v_res jsonb;
begin
  if new.estatus = 'Aprobada'
     and (old.estatus is distinct from 'Aprobada')
     and new.prospecto_id is not null then
    if exists (
      select 1 from public.prospectos
      where id = new.prospecto_id and etapa <> 'convertido' and eliminado = false
    ) then
      v_res := public.crm_convertir_prospecto(new.prospecto_id, null);
      if coalesce((v_res->>'ok')::boolean, false) and new.cliente_id is null then
        new.cliente_id := (v_res->>'cliente_id')::integer;
      end if;
    elsif new.cliente_id is null then
      select p.cliente_id into new.cliente_id
      from public.prospectos p where p.id = new.prospecto_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_crm_autoconvertir on public.cotizaciones;
create trigger trg_crm_autoconvertir
before update on public.cotizaciones
for each row
execute function public.crm_autoconvertir_al_aprobar();
```

Nota: es un trigger BEFORE UPDATE; modifica `new.cliente_id` directamente (sin segundo UPDATE) para evitar recursión.

- [ ] **Step 2: Probar el trigger en la BD**

Con `execute_sql`, crear un prospecto de prueba y una cotización ligada, aprobarla y verificar:

```sql
-- 1. prospecto de prueba
insert into public.prospectos (nombre, marca_origen, etapa)
values ('PRUEBA TRIGGER', 'tesey', 'nuevo') returning id;
-- (usar el id devuelto como :pid)
-- 2. cotización ligada
insert into public.cotizaciones (folio, descripcion, total, estatus, marca_comercial, prospecto_id)
values ('TEST-TRG-1', 'prueba', 100, 'Enviada', 'tesey', ':pid') returning id;
-- 3. aprobar
update public.cotizaciones set estatus = 'Aprobada' where folio = 'TEST-TRG-1';
-- 4. verificar
select c.id, c.cliente_id, p.etapa, p.cliente_id as prosp_cli
from public.cotizaciones c join public.prospectos p on p.id = c.prospecto_id
where c.folio = 'TEST-TRG-1';
```

Expected: `p.etapa = 'convertido'`, `p.cliente_id` no nulo, `c.cliente_id = p.cliente_id`.

- [ ] **Step 3: Limpiar datos de prueba**

```sql
delete from public.cotizaciones where folio = 'TEST-TRG-1';
delete from public.clientes where nombre = 'PRUEBA TRIGGER';
delete from public.prospectos where nombre = 'PRUEBA TRIGGER';
```

(Commit no aplica para migraciones; quedan registradas en Supabase.)

### Task B2: Botón "Generar cotización" desde el prospecto

- [ ] **Step 1: Leer `CotizacionDialog.jsx`**

Abrir `src/components/cotizaciones/CotizacionDialog.jsx` y localizar: (a) sus props (`open`, `onOpenChange`, `onSave`, etc.), (b) el `useState` del `formData`/estado inicial, (c) el efecto que inicializa el formulario al abrir, (d) dónde se hace el `insert` en `cotizaciones`.

- [ ] **Step 2: Aceptar un prospecto precargado**

Agregar una prop `prospecto` (objeto o null) a `CotizacionDialog`. En el efecto de inicialización, cuando `prospecto` exista y NO haya `cotizacionToEdit`, precargar:
- `cliente_id`: null (sigue siendo prospecto).
- `cliente_nombre_externo`: `prospecto.nombre`.
- `marca_comercial` / `branding`: `prospecto.marca_origen`.
- guardar `prospecto.id` para incluirlo en el insert.

En el objeto que se hace `insert`/`update` en `cotizaciones`, agregar el campo `prospecto_id: prospecto?.id ?? null` (solo en creación; no sobrescribir en edición).

Seguir el patrón exacto del `formData` existente del archivo (no inventar nombres de campos: usar los que ya use el componente).

- [ ] **Step 3: Botón en `ProspectoDetalle.jsx`**

En `src/components/crm/ProspectoDetalle.jsx`:

Importar `CotizacionDialog` y el icono:

```jsx
import { FilePlus2 } from 'lucide-react';
import CotizacionDialog from '@/components/cotizaciones/CotizacionDialog';
```

Agregar estado para abrir el diálogo (junto a los otros `useState`):

```jsx
  const [cotizacionOpen, setCotizacionOpen] = useState(false);
```

Junto al botón "Convertir a cliente" (dentro del `DialogHeader`, donde está `puedeConvertir`), agregar un botón:

```jsx
            {puedeConvertir && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 ml-2 gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => setCotizacionOpen(true)}
              >
                <FilePlus2 className="w-4 h-4" />
                Generar cotización
              </Button>
            )}
```

Y al final, dentro del fragmento (junto a `InteraccionForm`/`CitaForm`/`MarcarRealizadaForm`), montar el diálogo:

```jsx
      <CotizacionDialog
        open={cotizacionOpen}
        onOpenChange={setCotizacionOpen}
        prospecto={prospecto}
        onSave={() => {
          setCotizacionOpen(false);
          onRefetch?.();
        }}
      />
```

Nota: ajustar las props (`onSave`/`onSaved`/`onSuccess`) a las que realmente exponga `CotizacionDialog` (verificado en B2 Step 1).

- [ ] **Step 4: Build + lint + verificación manual**

Run: `npm run build` y `npm run lint` → Expected: OK.
Manual: abrir un prospecto → "Generar cotización" → el formulario abre con el nombre del prospecto precargado → guardar → en la BD la cotización tiene `prospecto_id` seteado. Aprobar esa cotización (en el módulo de cotizaciones) → el prospecto pasa a "Convertido" y aparece como cliente.

- [ ] **Step 5: Commit**

```bash
git add src/components/crm/ProspectoDetalle.jsx src/components/cotizaciones/CotizacionDialog.jsx
git commit -m "feat(crm): generar cotización ligada desde el prospecto"
```

### Task B3: Métricas en el encabezado de Prospectos

- [ ] **Step 1: Cargar clientes nuevos del mes en `Prospectos.jsx`**

En `src/pages/Prospectos.jsx`, agregar estado:

```jsx
  const [clientesNuevosMes, setClientesNuevosMes] = useState(0);
```

Dentro de `refetch` (después de setear prospectos), o en un efecto aparte, consultar clientes convertidos del mes actual:

```jsx
  const fetchClientesNuevos = useCallback(async () => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from('clientes')
      .select('id', { count: 'exact', head: true })
      .eq('fuente_origen', 'prospecto_convertido')
      .gte('created_at', inicioMes);
    setClientesNuevosMes(count || 0);
  }, []);

  useEffect(() => {
    fetchClientesNuevos();
  }, [fetchClientesNuevos]);
```

- [ ] **Step 2: Calcular métricas derivadas**

Agregar `useMemo` (junto a `activosCount`):

```jsx
  const valorPipeline = useMemo(
    () =>
      prospectos
        .filter((p) => p.etapa !== 'convertido' && p.etapa !== 'descartado')
        .reduce((acc, p) => acc + (Number(p.valor_estimado) || 0), 0),
    [prospectos]
  );

  const tasaConversion = useMemo(() => {
    const convertidos = prospectos.filter((p) => p.etapa === 'convertido').length;
    const descartados = prospectos.filter((p) => p.etapa === 'descartado').length;
    const cerrados = convertidos + descartados;
    return cerrados === 0 ? null : Math.round((convertidos / cerrados) * 100);
  }, [prospectos]);
```

Agregar helper de formato MXN compacto arriba del componente:

```jsx
const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
```

- [ ] **Step 3: Renderizar tarjetas de métricas**

Justo después del header (el `<div className="flex flex-col sm:flex-row gap-4 ...">` con el título y el botón "Nuevo Prospecto"), insertar:

```jsx
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Prospectos activos', value: activosCount },
            { label: 'Valor en pipeline', value: fmtMXN(valorPipeline) },
            { label: 'Clientes nuevos (mes)', value: clientesNuevosMes },
            { label: 'Tasa de conversión', value: tasaConversion == null ? '—' : `${tasaConversion}%` },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{m.value}</p>
            </div>
          ))}
        </div>
```

- [ ] **Step 4: Build + lint + verificación manual**

Run: `npm run build` y `npm run lint` → Expected: OK.
Manual: en Prospectos se ven 4 tarjetas; "Tasa de conversión" muestra % o "—"; "Clientes nuevos (mes)" cuadra con los clientes convertidos este mes.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Prospectos.jsx
git commit -m "feat(crm): métricas de pipeline y conversión en encabezado de Prospectos"
```

---

## Subagente D — Punto 4: Tabla de Prospectos estilo Monday

> **Dependencia:** ejecutar DESPUÉS de B3 (ambos modifican `src/pages/Prospectos.jsx`). Hacer `git pull`/rebase mental: trabajar sobre el archivo ya con las métricas.

**Files:**
- Create: `src/components/crm/ProspectoTabla.jsx`
- Modify: `src/pages/Prospectos.jsx` (toggle Tabla/Kanban + render de la tabla)

### Task D1: Componente de tabla

- [ ] **Step 1: Crear `src/components/crm/ProspectoTabla.jsx`**

```jsx
import React from 'react';

const ETAPA_PILL = {
  nuevo: { label: 'Nuevo', cls: 'bg-orange-400 text-white' },
  contactado: { label: 'Contactado', cls: 'bg-rose-400 text-white' },
  propuesta_enviada: { label: 'Propuesta enviada', cls: 'bg-amber-400 text-white' },
  en_negociacion: { label: 'En negociación', cls: 'bg-yellow-400 text-white' },
  convertido: { label: 'Convertido', cls: 'bg-emerald-500 text-white' },
  descartado: { label: 'Descartado', cls: 'bg-gray-400 text-white' },
};

const FUENTE_PILL = {
  referido: { label: 'Referido', cls: 'bg-blue-500 text-white' },
  redes_sociales: { label: 'Redes sociales', cls: 'bg-fuchsia-500 text-white' },
  web: { label: 'Web', cls: 'bg-sky-500 text-white' },
  visita_directa: { label: 'Visita directa', cls: 'bg-teal-500 text-white' },
  feria: { label: 'Feria', cls: 'bg-indigo-500 text-white' },
  llamada_fria: { label: 'Llamada en frío', cls: 'bg-slate-500 text-white' },
  otro: { label: 'Otro', cls: 'bg-gray-400 text-white' },
};

const fmtMXN = (n) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);

const fmtFecha = (v) => {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const Pill = ({ def, fallback }) => {
  const d = def || { label: fallback || '—', cls: 'bg-gray-200 text-gray-700' };
  if (!def && !fallback) return <span className="text-gray-400">—</span>;
  return <span className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${d.cls}`}>{d.label}</span>;
};

const ProspectoTabla = ({ prospectos, onCardClick, ultimaInteraccion = {} }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left">
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Lead</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Estado</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Empresa</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Título</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">E-mail</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Teléfono</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Origen</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide">Última interacción</th>
            <th className="px-3 py-2 font-medium text-gray-500 text-xs uppercase tracking-wide text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {prospectos.map((p) => (
            <tr
              key={p.id}
              onClick={() => onCardClick(p)}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <td className="px-3 py-2.5">
                <p className="font-medium text-gray-900">{p.nombre}</p>
                {p.nombre_contacto && <p className="text-xs text-gray-400">{p.nombre_contacto}</p>}
              </td>
              <td className="px-3 py-2.5"><Pill def={ETAPA_PILL[p.etapa]} fallback={p.etapa} /></td>
              <td className="px-3 py-2.5 text-gray-700">{p.razon_social || p.nombre || '—'}</td>
              <td className="px-3 py-2.5 text-gray-600">{p.industria || '—'}</td>
              <td className="px-3 py-2.5">
                {p.email ? (
                  <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:underline break-all">{p.email}</a>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                {p.telefono ? (
                  <a href={`tel:${p.telefono}`} onClick={(e) => e.stopPropagation()} className="text-gray-700 hover:underline">
                    <span aria-hidden="true">🇲🇽</span> {p.telefono}
                  </a>
                ) : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-3 py-2.5"><Pill def={FUENTE_PILL[p.fuente]} fallback={p.fuente} /></td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{fmtFecha(ultimaInteraccion[p.id] || p.updated_at)}</td>
              <td className="px-3 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">{fmtMXN(p.valor_estimado)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ProspectoTabla;
```

### Task D2: Toggle Tabla/Kanban e integración en `Prospectos.jsx`

- [ ] **Step 1: Imports y estado**

En `src/pages/Prospectos.jsx`, importar el nuevo componente y los iconos:

```jsx
import { Plus, Loader2, Table2, Kanban } from 'lucide-react';
import ProspectoTabla from '@/components/crm/ProspectoTabla';
```

Agregar estado de vista y de últimas interacciones:

```jsx
  const [vista, setVista] = useState('tabla');
  const [ultimaInteraccion, setUltimaInteraccion] = useState({});
```

- [ ] **Step 2: Cargar últimas interacciones**

Agregar (y llamar desde un efecto):

```jsx
  const fetchUltimas = useCallback(async () => {
    const { data } = await supabase
      .from('crm_interacciones')
      .select('prospecto_id, fecha')
      .eq('eliminado', false)
      .order('fecha', { ascending: false });
    const map = {};
    (data || []).forEach((row) => {
      if (row.prospecto_id && !map[row.prospecto_id]) map[row.prospecto_id] = row.fecha;
    });
    setUltimaInteraccion(map);
  }, []);

  useEffect(() => {
    fetchUltimas();
  }, [fetchUltimas]);
```

- [ ] **Step 3: Botones de toggle**

En la fila de filtros (junto al switch "Mostrar convertidos/descartados"), agregar al final:

```jsx
          <div className="flex gap-1 ml-auto bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setVista('tabla')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${vista === 'tabla' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Table2 className="w-4 h-4" /> Tabla
            </button>
            <button
              type="button"
              onClick={() => setVista('kanban')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${vista === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Kanban className="w-4 h-4" /> Kanban
            </button>
          </div>
```

- [ ] **Step 4: Render condicional**

Reemplazar el bloque que renderiza `<ProspectoKanban ... />` (dentro del `else` de loading/empty) por:

```jsx
            vista === 'kanban' ? (
              <ProspectoKanban
                prospectos={filtrados}
                onCardClick={handleCardClick}
                onRefetch={refetch}
              />
            ) : (
              <ProspectoTabla
                prospectos={filtrados}
                onCardClick={handleCardClick}
                ultimaInteraccion={ultimaInteraccion}
              />
            )
```

- [ ] **Step 5: Build + lint + verificación manual**

Run: `npm run build` y `npm run lint` → Expected: OK.
Manual: Prospectos abre en vista Tabla con píldoras de color en Estado y Origen, bandera en teléfono, columnas como la imagen. El toggle cambia a Kanban. Click en fila abre el detalle. Filtros por marca y switch funcionan.

- [ ] **Step 6: Commit**

```bash
git add src/components/crm/ProspectoTabla.jsx src/pages/Prospectos.jsx
git commit -m "feat(crm): vista de Prospectos en tabla estilo Monday con toggle Kanban"
```

---

## Orden de ejecución y dependencias

1. **Paralelo:** Subagente A (puntos 1+2) y Subagente C (punto 5) — archivos independientes.
2. **Subagente B** (punto 3) — incluye migración; B3 modifica `Prospectos.jsx`.
3. **Subagente D** (punto 4) — DESPUÉS de B3 (ambos tocan `Prospectos.jsx`).

Al final: confirmar build limpio, hacer `npm run build` global y avisar al usuario para push a `main`.

## Self-Review (cobertura del spec)

- Punto 1 → Task A1. ✓
- Punto 2 → Task A1 (misma causa) + verificación móvil A1 Step 4. ✓
- Punto 3: cotizar desde prospecto → B2; auto-conversión + manual → B1 (+ botón manual ya existe); métricas → B3. ✓
- Punto 4 → D1 + D2. ✓
- Punto 5 → C1. ✓
- Sin placeholders: el único paso descriptivo (B2 Step 2) requiere leer `CotizacionDialog.jsx` porque sus nombres de campos no están en contexto; se dan el mapeo y la prop exactos. ✓
