# Entregas masivas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar varios proyectos del mismo cliente en un solo acto de confirmación (recibe/firma/foto/comentarios), permitiendo completa o parcial por proyecto, registrando una `entregas` por proyecto (mismo `grupo_id`) de forma transaccional.

**Architecture:** Selección múltiple en la tabla de Proyectos → barra de acción → `EntregaMasivaModal` (desktop + móvil) que reutiliza la lógica por partida de `EntregaModal`. El guardado sube firma+foto una sola vez y llama la RPC transaccional `registrar_entrega_masiva(jsonb)`; el trigger `trigger_validar_entrega` ya impide sobre-entrega y revierte toda la transacción si algo excede el pendiente.

**Tech Stack:** Supabase (Postgres 17, RPC plpgsql, trigger existente `validar_entrega`), React 19 + Vite, Tailwind, `react`/hooks, `@/lib/customSupabaseClient`, `@/lib/entregaUpload` (`uploadEntregaImage`), `TelegramService`.

**Hechos verificados del esquema:**
- `entregas`: `id uuid default gen_random_uuid()`, `proyecto_id int NOT NULL`, `cotizacion_id int NOT NULL`, `recibe_nombre text NOT NULL`, `firma_url`/`foto_url`/`comentarios` nullable, `estado text default 'activa'`, `fecha timestamptz default now()`. **No tiene `grupo_id` (se agrega).**
- `entregas_items`: `id uuid`, `entrega_id uuid`, `cotizacion_item_id int`, `cantidad_entregada numeric`. Trigger `trigger_validar_entrega` BEFORE INSERT impide que la suma entregada supere `cotizaciones_items.cantidad`.
- `proyectos` **no tiene columna `estado`**, solo `estatus text` (valores: `Entregado`, `Terminado`, `Por Iniciar`, `Solicitud de Materiales`, …). La masiva solo escribe `estatus`.
- RPC existente `get_items_con_pendiente(cotizacion_id_input integer)` devuelve `pendiente` por partida (cuenta solo entregas `estado='activa'`).
- `sync_proyecto_estado_entregas` **no existe** en la BD (el front la llama y falla en silencio); no dependemos de ella.

**Verificación (este repo no tiene test runner):** `npm run lint` + `npm run build` + SQL directo + verificación manual en navegador. project_id Supabase: `czbmqzimjlwwgcglubey`. Migraciones manuales en SQL Editor.

---

## File Structure

- **Create:** `supabase/migrations/2026-06-16_entregas_masivas.sql` — `ALTER TABLE entregas ADD grupo_id` + RPC `registrar_entrega_masiva`.
- **Create:** `src/components/proyectos/SignaturePad.jsx` — extraído de `EntregaModal.jsx` para reuso (firma por canvas).
- **Modify:** `src/components/EntregaModal.jsx` — importar `SignaturePad` desde el nuevo archivo (eliminar la definición local duplicada).
- **Create:** `src/components/proyectos/EntregaMasivaModal.jsx` — modal multi-proyecto (desktop + móvil) + guardado.
- **Modify:** `src/components/proyectos/ProyectosList.jsx` — columna de selección + props de selección.
- **Modify:** `src/pages/Proyectos.jsx` — estado de selección, barra de acción, montaje del modal.

---

## Task 1: Migración — `grupo_id` + RPC `registrar_entrega_masiva`

**Files:**
- Create: `supabase/migrations/2026-06-16_entregas_masivas.sql`

- [ ] **Step 1: Escribir el SQL**

```sql
-- supabase/migrations/2026-06-16_entregas_masivas.sql

-- 1) Columna para agrupar las entregas de un mismo acto de confirmación
alter table public.entregas add column if not exists grupo_id uuid;
create index if not exists idx_entregas_grupo_id on public.entregas (grupo_id);

-- 2) RPC transaccional
create or replace function public.registrar_entrega_masiva(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo_id     uuid := coalesce((payload->>'grupo_id')::uuid, gen_random_uuid());
  v_recibe       text := nullif(payload->>'recibe_nombre', '');
  v_comentarios  text := nullif(payload->>'comentarios', '');
  v_firma_url    text := nullif(payload->>'firma_url', '');
  v_foto_url     text := nullif(payload->>'foto_url', '');
  v_proy         jsonb;
  v_item         jsonb;
  v_proyecto_id  integer;
  v_cot_id       integer;
  v_entrega_id   uuid;
  v_qty          numeric;
  v_inserto_item boolean;
  v_completo     boolean;
  v_resultado    jsonb := '[]'::jsonb;
begin
  if v_recibe is null then
    raise exception 'recibe_nombre es obligatorio';
  end if;
  if jsonb_typeof(payload->'proyectos') <> 'array' or jsonb_array_length(payload->'proyectos') = 0 then
    raise exception 'Debe incluir al menos un proyecto';
  end if;

  for v_proy in select * from jsonb_array_elements(payload->'proyectos')
  loop
    v_proyecto_id := (v_proy->>'proyecto_id')::integer;
    v_cot_id      := (v_proy->>'cotizacion_id')::integer;
    v_inserto_item := false;

    insert into public.entregas
      (proyecto_id, cotizacion_id, recibe_nombre, firma_url, foto_url, comentarios, estado, grupo_id)
    values
      (v_proyecto_id, v_cot_id, v_recibe, v_firma_url, v_foto_url, v_comentarios, 'activa', v_grupo_id)
    returning id into v_entrega_id;

    for v_item in select * from jsonb_array_elements(v_proy->'items')
    loop
      v_qty := (v_item->>'cantidad_entregada')::numeric;
      if v_qty is not null and v_qty > 0 then
        -- trigger_validar_entrega revierte TODA la transacción si excede el pendiente
        insert into public.entregas_items (entrega_id, cotizacion_item_id, cantidad_entregada)
        values (v_entrega_id, (v_item->>'cotizacion_item_id')::integer, v_qty);
        v_inserto_item := true;
      end if;
    end loop;

    if not v_inserto_item then
      raise exception 'El proyecto % no tiene cantidades a entregar', v_proyecto_id;
    end if;

    -- ¿quedó completo? (la RPC de pendientes ya considera estado=activa)
    select coalesce(bool_and(pendiente <= 0), false)
      into v_completo
    from public.get_items_con_pendiente(v_cot_id);

    if v_completo then
      update public.proyectos set estatus = 'Entregado' where id = v_proyecto_id;
    end if;

    v_resultado := v_resultado || jsonb_build_object(
      'proyecto_id', v_proyecto_id,
      'entrega_id', v_entrega_id,
      'completo', v_completo
    );
  end loop;

  return jsonb_build_object('grupo_id', v_grupo_id, 'entregas', v_resultado);
end;
$$;

grant execute on function public.registrar_entrega_masiva(jsonb) to authenticated;
```

- [ ] **Step 2: Aplicar manualmente** en el SQL Editor de Supabase (proyecto ADMINPROYECTOS).

- [ ] **Step 3: Verificar (dry-run con rollback) que el over-entrega revienta toda la transacción**

Ejecutar (sustituir IDs por un proyecto con cotización y una partida; pon una cantidad imposible para forzar el error):

```sql
begin;
select public.registrar_entrega_masiva(jsonb_build_object(
  'recibe_nombre','PRUEBA',
  'proyectos', jsonb_build_array(jsonb_build_object(
    'proyecto_id', <PID>, 'cotizacion_id', <CID>,
    'items', jsonb_build_array(jsonb_build_object('cotizacion_item_id', <IID>, 'cantidad_entregada', 999999))
  ))
));
rollback;
```

Esperado: error `No puedes entregar más de lo disponible` (del trigger). Nada se persiste por el `rollback`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-06-16_entregas_masivas.sql
git commit -m "feat(db): grupo_id + RPC registrar_entrega_masiva (entregas masivas)"
```

---

## Task 2: Extraer `SignaturePad` a archivo propio

`EntregaMasivaModal` necesita la firma por canvas que hoy vive embebida en `EntregaModal.jsx` (función `SignaturePad`, líneas ~50-194). Se extrae para reuso sin duplicar.

**Files:**
- Create: `src/components/proyectos/SignaturePad.jsx`
- Modify: `src/components/EntregaModal.jsx`

- [ ] **Step 1: Crear `SignaturePad.jsx`**

Mover **íntegra** la función `SignaturePad` actual de `EntregaModal.jsx` a este archivo, como export por defecto, conservando los imports que usa (`React`, `useCallback`, `useEffect`, `useRef`, `Button`, `Eraser`, `cn`).

```jsx
// src/components/proyectos/SignaturePad.jsx
import React, { useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';

// (Cuerpo idéntico al SignaturePad que estaba en EntregaModal.jsx:
//  props { open, className, apiRef, tall = false }; expone apiRef.current = { clear, isEmpty, toDataURL }.)
export default function SignaturePad({ open, className, apiRef, tall = false }) {
  // ... mover aquí el cuerpo exacto existente ...
}
```

- [ ] **Step 2: En `EntregaModal.jsx`, eliminar la función local y volver a importarla**

Borrar la definición local `function SignaturePad(...) { ... }` y añadir en los imports:

```jsx
import SignaturePad from '@/components/proyectos/SignaturePad';
```

- [ ] **Step 3: Lint + build (regresión de EntregaModal)**

Run: `npm run lint && npm run build`
Expected: sin errores; `EntregaModal` sigue compilando.

- [ ] **Step 4: Verificación manual rápida**

Abrir una entrega parcial normal (un proyecto) y confirmar que la firma sigue funcionando (dibujar, borrar, guardar).

- [ ] **Step 5: Commit**

```bash
git add src/components/proyectos/SignaturePad.jsx src/components/EntregaModal.jsx
git commit -m "refactor(entregas): extraer SignaturePad para reuso"
```

---

## Task 3: Selección múltiple en la tabla de Proyectos

**Files:**
- Modify: `src/components/proyectos/ProyectosList.jsx`

Helper de elegibilidad (un proyecto es entregable si tiene cotización y no está `Entregado`):

```js
// Reglas: tiene cotizacion_id y su estatus no es 'Entregado'.
const esEntregable = (p) => Boolean(p.cotizacion_id) && p.estatus !== 'Entregado';
```

- [ ] **Step 1: Ampliar props del componente**

Cambiar la firma:

```jsx
const ProyectosList = ({
  proyectos = [],
  onDeleteRequest,
  onSort,
  sortConfig = {},
  seleccionActiva = false,
  seleccionados = [],          // array de ids
  onToggleSeleccion,           // (id) => void
  onToggleSeleccionTodos,      // (ids) => void
}) => {
```

- [ ] **Step 2: Añadir helper y cálculo de ids elegibles visibles**

Dentro del componente, antes del `return`:

```jsx
  const esEntregable = (p) => Boolean(p.cotizacion_id) && p.estatus !== 'Entregado';
  const idsElegibles = proyectos.filter(esEntregable).map((p) => p.id);
  const todosMarcados = idsElegibles.length > 0 && idsElegibles.every((id) => seleccionados.includes(id));
```

- [ ] **Step 3: Columna de cabecera con "seleccionar todos"**

Como primer hijo del `<TableRow className="bg-gray-50">` (antes de `Prioridad`), insertar:

```jsx
                        {seleccionActiva && (
                          <TableHead className="w-[44px]">
                            <input
                              type="checkbox"
                              aria-label="Seleccionar todos los elegibles"
                              className="h-4 w-4 rounded border-gray-300 text-blue-600"
                              checked={todosMarcados}
                              onChange={() => onToggleSeleccionTodos(idsElegibles)}
                            />
                          </TableHead>
                        )}
```

- [ ] **Step 4: Celda de checkbox por fila**

Como primera celda dentro del `map` (antes de la celda de Prioridad), insertar:

```jsx
                            {seleccionActiva && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label={`Seleccionar ${proyecto.folio}`}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 disabled:opacity-40"
                                  disabled={!esEntregable(proyecto)}
                                  checked={seleccionados.includes(proyecto.id)}
                                  onChange={() => onToggleSeleccion(proyecto.id)}
                                />
                              </TableCell>
                            )}
```

(El `stopPropagation` evita navegar al detalle al marcar.)

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add src/components/proyectos/ProyectosList.jsx
git commit -m "feat(proyectos): columna de selección múltiple en la lista"
```

---

## Task 4: Estado de selección + barra de acción en `Proyectos.jsx`

**Files:**
- Modify: `src/pages/Proyectos.jsx`

- [ ] **Step 1: Imports y estado**

Añadir imports (junto a los existentes):

```jsx
import { useMemo, useState } from 'react'; // si no están ya
import EntregaMasivaModal from '@/components/proyectos/EntregaMasivaModal';
import { PackageCheck, X } from 'lucide-react';
```

Añadir estado (junto a los demás `useState` del componente):

```jsx
  const [seleccionActiva, setSeleccionActiva] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]); // ids
  const [masivaOpen, setMasivaOpen] = useState(false);
```

- [ ] **Step 2: Handlers de selección**

Añadir dentro del componente:

```jsx
  const toggleSeleccion = (id) =>
    setSeleccionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleSeleccionTodos = (idsElegibles) =>
    setSeleccionados((prev) =>
      idsElegibles.every((id) => prev.includes(id))
        ? prev.filter((id) => !idsElegibles.includes(id))
        : Array.from(new Set([...prev, ...idsElegibles]))
    );

  const salirSeleccion = () => {
    setSeleccionActiva(false);
    setSeleccionados([]);
  };

  // Proyectos seleccionados (objetos completos) a partir de la lista cargada
  const proyectosSeleccionados = useMemo(
    () => proyectos.filter((p) => seleccionados.includes(p.id)),
    [proyectos, seleccionados]
  );

  // Validación: todos del mismo cliente registrado (cliente_id no nulo y único)
  const clienteIdsSeleccion = useMemo(
    () => Array.from(new Set(proyectosSeleccionados.map((p) => p.cliente_id ?? null))),
    [proyectosSeleccionados]
  );
  const mismaSeleccionValida =
    proyectosSeleccionados.length > 0 &&
    clienteIdsSeleccion.length === 1 &&
    clienteIdsSeleccion[0] != null;
```

- [ ] **Step 3: Botón para activar el modo selección**

En la barra de acciones del header (junto a "Nuevo Proyecto", línea ~341), añadir:

```jsx
                        <Button
                            variant={seleccionActiva ? 'secondary' : 'outline'}
                            onClick={() => (seleccionActiva ? salirSeleccion() : setSeleccionActiva(true))}
                            className="gap-2"
                        >
                            <PackageCheck className="w-4 h-4" />
                            {seleccionActiva ? 'Cancelar selección' : 'Entrega masiva'}
                        </Button>
```

- [ ] **Step 4: Pasar props de selección a `ProyectosList`**

Reemplazar el render de `<ProyectosList ... />` (línea ~425) por:

```jsx
                        <ProyectosList
                            proyectos={sortedAndFilteredProyectos}
                            onDeleteRequest={handleDeleteRequest}
                            onSort={handleSort}
                            sortConfig={sortConfig}
                            seleccionActiva={seleccionActiva}
                            seleccionados={seleccionados}
                            onToggleSeleccion={toggleSeleccion}
                            onToggleSeleccionTodos={toggleSeleccionTodos}
                        />
```

- [ ] **Step 5: Barra flotante de acción**

Antes de `<NuevoProyectoDialog ... />` (línea ~435), añadir:

```jsx
            {seleccionActiva && seleccionados.length > 0 && (
              <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
                <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-semibold">{seleccionados.length}</span> proyecto(s) seleccionado(s)
                    {!mismaSeleccionValida && (
                      <span className="ml-2 text-red-600">— deben ser del mismo cliente registrado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={salirSeleccion} className="gap-1">
                      <X className="h-4 w-4" /> Cancelar
                    </Button>
                    <Button
                      disabled={!mismaSeleccionValida}
                      onClick={() => setMasivaOpen(true)}
                      className="gap-2 bg-teal-600 hover:bg-teal-700"
                    >
                      <PackageCheck className="h-4 w-4" />
                      Entregar seleccionados ({seleccionados.length})
                    </Button>
                  </div>
                </div>
              </div>
            )}
```

- [ ] **Step 6: Montar el modal (al final del JSX, junto a los otros modales)**

```jsx
            <EntregaMasivaModal
              open={masivaOpen}
              onOpenChange={setMasivaOpen}
              proyectos={proyectosSeleccionados}
              onSuccess={() => {
                setMasivaOpen(false);
                salirSeleccion();
                fetchProyectos();
              }}
            />
```

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: sin errores nuevos. (El modal aún no existe → crear en Task 5 antes del build.)

- [ ] **Step 8: Commit**

```bash
git add src/pages/Proyectos.jsx
git commit -m "feat(proyectos): modo selección + barra de entrega masiva"
```

---

## Task 5: `EntregaMasivaModal` — estructura, carga de partidas y editor por proyecto

**Files:**
- Create: `src/components/proyectos/EntregaMasivaModal.jsx`

Reutiliza `mapEntregaItemRow` (ya **exportado** desde `EntregaModal.jsx`) y `SignaturePad` (Task 2). Carga el pendiente por proyecto con `get_items_con_pendiente`.

- [ ] **Step 1: Crear el archivo con carga de partidas y estado por proyecto**

```jsx
// src/components/proyectos/EntregaMasivaModal.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { uploadEntregaImage } from '@/lib/entregaUpload';
import { notifyProjectFinishedOrDelivered } from '@/services/TelegramService';
import { mapEntregaItemRow } from '@/components/EntregaModal';
import SignaturePad from '@/components/proyectos/SignaturePad';
import { Loader2, Camera } from 'lucide-react';

const sanitizeFilename = (f) => f.replace(/[^a-zA-Z0-9-_\.]/g, '_');

// Editor de cantidades de UN proyecto (completa/parcial), reutilizando mapEntregaItemRow.
function ProyectoEditor({ proyecto, rows, loading, tipo, setTipo, cantidades, setCantidades }) {
  const setQty = (itemId, max, value) => {
    if (value === '') return setCantidades((p) => ({ ...p, [itemId]: '' }));
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > max) return;
    setCantidades((p) => ({ ...p, [itemId]: n }));
  };
  const marcarCompleto = () => {
    const next = {};
    rows.forEach((r) => { if (r.pendiente > 0) next[r.id] = r.pendiente; });
    setCantidades(next);
  };

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-800">{proyecto.folio} · {proyecto.descripcion}</p>
        </div>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={tipo === 'completa' ? 'default' : 'outline'}
            onClick={() => { setTipo('completa'); marcarCompleto(); }}>Completa</Button>
          <Button type="button" size="sm" variant={tipo === 'parcial' ? 'default' : 'outline'}
            onClick={() => { setTipo('parcial'); setCantidades({}); }}>Parcial</Button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-teal-600" /></div>
      ) : rows.length === 0 ? (
        <p className="py-2 text-sm text-gray-500">Sin partidas pendientes.</p>
      ) : (
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-gray-500">
            <th className="text-left">Descripción</th><th className="w-20 text-right">Pend.</th><th className="w-24 text-right">Entregar</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className="border-t">
                <td className="py-1">{r.descripcion}</td>
                <td className="py-1 text-right font-mono text-amber-800">{r.pendiente}</td>
                <td className="py-1">
                  <Input type="number" min={0} max={r.pendiente} className="h-8 text-right font-mono"
                    value={cantidades[r.id] ?? ''} disabled={tipo === 'completa' || r.pendiente <= 0}
                    onChange={(e) => setQty(r.id, r.pendiente, e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EntregaMasivaModal({ open, onOpenChange, proyectos = [], onSuccess }) {
  const { toast } = useToast();
  const [porProyecto, setPorProyecto] = useState({}); // { [proyectoId]: { rows, loading, tipo, cantidades } }
  const [recibe, setRecibe] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const sigApiRef = useRef(null);
  const fotoInputRef = useRef(null);

  // Cargar pendiente de cada proyecto al abrir
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const init = {};
    proyectos.forEach((p) => { init[p.id] = { rows: [], loading: true, tipo: 'completa', cantidades: {} }; });
    setPorProyecto(init);
    setRecibe(''); setComentarios(''); setFotoFile(null);
    setFotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });

    (async () => {
      for (const p of proyectos) {
        const { data, error } = await supabase.rpc('get_items_con_pendiente', { cotizacion_id_input: p.cotizacion_id });
        if (cancelled) return;
        const rows = (error || !Array.isArray(data) ? [] : data.map(mapEntregaItemRow)).filter((r) => r.pendiente > 0);
        const cantidades = {};
        rows.forEach((r) => { cantidades[r.id] = r.pendiente; }); // default completa
        setPorProyecto((prev) => ({ ...prev, [p.id]: { rows, loading: false, tipo: 'completa', cantidades } }));
      }
    })();
    return () => { cancelled = true; };
  }, [open, proyectos]);

  const setTipo = useCallback((pid, tipo) =>
    setPorProyecto((prev) => ({ ...prev, [pid]: { ...prev[pid], tipo } })), []);
  const setCantidades = useCallback((pid, updater) =>
    setPorProyecto((prev) => ({ ...prev, [pid]: { ...prev[pid], cantidades: typeof updater === 'function' ? updater(prev[pid].cantidades) : updater } })), []);

  const onFoto = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    setFotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(f); });
    setFotoFile(f);
  };

  // (handleSave se implementa en Task 6)
  const handleSave = async () => {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4">
        <DialogHeader><DialogTitle>Entrega masiva ({proyectos.length} proyectos)</DialogTitle></DialogHeader>

        <div className="flex-1 space-y-3 overflow-y-auto py-1">
          {proyectos.map((p) => {
            const st = porProyecto[p.id] || { rows: [], loading: true, tipo: 'completa', cantidades: {} };
            return (
              <ProyectoEditor
                key={p.id}
                proyecto={p}
                rows={st.rows}
                loading={st.loading}
                tipo={st.tipo}
                setTipo={(t) => setTipo(p.id, t)}
                cantidades={st.cantidades}
                setCantidades={(u) => setCantidades(p.id, u)}
              />
            );
          })}

          <div className="grid grid-cols-1 gap-3 rounded-lg border bg-gray-50/60 p-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="recibe-masiva">Quién recibe *</Label>
              <Input id="recibe-masiva" value={recibe} onChange={(e) => setRecibe(e.target.value)} placeholder="Nombre completo" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="com-masiva">Comentarios</Label>
              <textarea id="com-masiva" value={comentarios} onChange={(e) => setComentarios(e.target.value)}
                className="min-h-[60px] w-full rounded-md border px-3 py-2 text-sm" placeholder="Opcional" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="foto-masiva">Foto de entrega *</Label>
              <label htmlFor="foto-masiva" className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/30 px-4 py-3 text-sm font-medium text-teal-900">
                <Camera className="h-5 w-5" /> Tomar o elegir foto
                <input id="foto-masiva" ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFoto} />
              </label>
              {fotoPreview && <img src={fotoPreview} alt="Vista previa" className="mt-2 max-h-40 w-full max-w-xs rounded-lg border object-cover" />}
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label>Firma de recibido *</Label>
              <SignaturePad open={open} apiRef={sigApiRef} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: compila (el `handleSave` vacío es temporal).

- [ ] **Step 3: Commit**

```bash
git add src/components/proyectos/EntregaMasivaModal.jsx
git commit -m "feat(proyectos): EntregaMasivaModal — editores por proyecto + confirmación"
```

---

## Task 6: Guardado transaccional en `EntregaMasivaModal`

**Files:**
- Modify: `src/components/proyectos/EntregaMasivaModal.jsx`

- [ ] **Step 1: Implementar `handleSave`**

Reemplazar `const handleSave = async () => {};` por:

```jsx
  const handleSave = async () => {
    if (saving) return;
    if (!recibe.trim()) {
      toast({ variant: 'destructive', title: 'Datos', description: 'Indica quién recibe la mercancía.' });
      return;
    }
    // Construir proyectos con al menos una cantidad > 0
    const proyectosPayload = proyectos
      .map((p) => {
        const st = porProyecto[p.id];
        const items = (st?.rows || [])
          .map((r) => ({ cotizacion_item_id: r.id, cantidad_entregada: Number(st.cantidades[r.id] || 0) }))
          .filter((it) => it.cantidad_entregada > 0);
        return { proyecto_id: p.id, cotizacion_id: p.cotizacion_id, items, folio: p.folio };
      })
      .filter((p) => p.items.length > 0);

    if (proyectosPayload.length === 0) {
      toast({ variant: 'destructive', title: 'Cantidades', description: 'Ningún proyecto tiene cantidades a entregar.' });
      return;
    }
    if (!fotoFile) {
      toast({ variant: 'destructive', title: 'Foto requerida', description: 'Agrega una foto de la entrega.' });
      return;
    }
    const sig = sigApiRef.current;
    if (!sig || sig.isEmpty()) {
      toast({ variant: 'destructive', title: 'Firma requerida', description: 'Se necesita la firma de recibido.' });
      return;
    }

    setSaving(true);
    try {
      // Subir foto y firma UNA sola vez (carpeta del primer proyecto)
      const refId = proyectosPayload[0].proyecto_id;
      const fotoUrl = await uploadEntregaImage(fotoFile, refId, sanitizeFilename);

      const dataUrl = sig.toDataURL();
      if (!dataUrl) throw new Error('No se pudo leer la firma.');
      const blob = await (await fetch(dataUrl)).blob();
      const firmaPath = `entregas/masiva/${Date.now()}_firma.png`;
      const { error: firmaErr } = await supabase.storage.from('proyecto_archivos').upload(firmaPath, blob, { contentType: 'image/png' });
      if (firmaErr) throw new Error(`Error al subir la firma: ${firmaErr.message}`);
      const firmaUrl = supabase.storage.from('proyecto_archivos').getPublicUrl(firmaPath).data.publicUrl;

      const payload = {
        recibe_nombre: recibe.trim(),
        comentarios: comentarios.trim() || null,
        firma_url: firmaUrl,
        foto_url: fotoUrl,
        proyectos: proyectosPayload.map(({ proyecto_id, cotizacion_id, items }) => ({ proyecto_id, cotizacion_id, items })),
      };

      const { data, error } = await supabase.rpc('registrar_entrega_masiva', { payload });
      if (error) throw new Error(error.message);

      // Notificar Telegram por cada proyecto que quedó completo
      const completos = (data?.entregas || []).filter((e) => e.completo);
      completos.forEach((e) => {
        const p = proyectos.find((x) => x.id === e.proyecto_id);
        notifyProjectFinishedOrDelivered({
          folio: p?.folio || 'Sin folio',
          cliente_nombre: p?.cliente_nombre || 'Sin cliente',
          estatus: 'Entregado',
        });
      });

      toast({ title: 'Entrega masiva registrada', description: `${proyectosPayload.length} proyecto(s) actualizados.` });
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Error al guardar', description: err?.message ?? 'No se pudo completar.' });
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Verificación manual (camino feliz)**

`npm run dev` → Proyectos → "Entrega masiva" → seleccionar 2-3 proyectos del **mismo cliente** con cotización → "Entregar seleccionados" → dejar uno en Parcial (bajar una cantidad), otros Completa → llenar recibe, foto, firma → Guardar.
Esperado: toast de éxito; en cada proyecto (ProyectoDetalle → Historial de entregas) aparece la entrega con la misma firma/foto/recibe; los completos quedan `Entregado`.

- [ ] **Step 4: Verificar el `grupo_id` compartido en BD**

```sql
select grupo_id, count(*) from public.entregas
where grupo_id is not null group by grupo_id order by max(fecha) desc limit 3;
```

Esperado: el grupo recién creado tiene tantas filas como proyectos entregados.

- [ ] **Step 5: Commit**

```bash
git add src/components/proyectos/EntregaMasivaModal.jsx
git commit -m "feat(proyectos): guardado transaccional de entrega masiva"
```

---

## Task 7: Paridad móvil del modal

**Files:**
- Modify: `src/components/proyectos/EntregaMasivaModal.jsx`

El móvil reusa el mismo contenido pero a pantalla completa y con tipografías/controles más grandes (el lienzo de `SignaturePad` ya bloquea el scroll para firmar). Se evita un wizard separado: en móvil el `DialogContent` ocupa todo el alto y el contenido es scrolleable (cada `ProyectoEditor`, luego la confirmación, luego firma).

- [ ] **Step 1: Detectar móvil y ajustar el `DialogContent`**

Añadir el hook (copiar el patrón `useIsMobile` de `EntregaModal.jsx`, líneas ~15-27) al inicio del archivo y aplicarlo:

```jsx
function useIsMobile() {
  const [m, setM] = React.useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => setM(mq.matches);
    apply(); mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return m;
}
```

En el componente: `const isMobile = useIsMobile();` y cambiar el `className` del `DialogContent`:

```jsx
      <DialogContent
        className={isMobile
          ? 'flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-3 !overflow-hidden !p-3 !left-0 !top-0 !translate-x-0 !translate-y-0 rounded-none border-0'
          : 'flex max-h-[90vh] max-w-3xl flex-col gap-4'}
      >
```

- [ ] **Step 2: Agrandar controles táctiles en móvil**

En `ProyectoEditor`, cuando aplique, usar inputs de mayor altura en móvil (pasar `isMobile` como prop y aplicar `h-11 text-base` al `<Input>` de cantidad). Aplicar el mismo criterio al botón "Guardar entrega" del footer (`h-12 text-base` en móvil).

```jsx
// Ejemplo del Input de cantidad:
<Input ... className={`text-right font-mono ${isMobile ? 'h-11 text-base' : 'h-8'}`} ... />
```

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: compila sin errores.

- [ ] **Step 4: Verificación manual en móvil (DevTools responsive ~390px)**

Repetir el flujo de entrega masiva en viewport móvil: cada editor es usable, foto por cámara, firma con el dedo sin desplazar la pantalla, guardar.

- [ ] **Step 5: Commit**

```bash
git add src/components/proyectos/EntregaMasivaModal.jsx
git commit -m "feat(proyectos): paridad móvil de EntregaMasivaModal"
```

---

## Despliegue (al cerrar la feature)

- [ ] `npm run build`, commit del `dist/`, push a `origin/main` (despliegue manual a Hostinger/tesey.com.mx).

---

## Self-Review (cobertura del spec)

- Selección múltiple mismo cliente → Task 3 (elegibilidad) + Task 4 (`mismaSeleccionValida`). ✓
- Editor parcial/completa por proyecto → Task 5 `ProyectoEditor`. ✓
- Confirmación única (recibe/foto/firma/comentarios) → Task 5 bloque inferior. ✓
- Una entrega por proyecto con `grupo_id` compartido + atómico → Task 1 RPC + Task 6 payload. ✓
- Sobre-entrega revierte todo → Task 1 (trigger `validar_entrega`) + Task 1 Step 3 (verificación). ✓
- Cada proyecto muestra su confirmación → filas `entregas` por proyecto → visibles en `EntregaHistorial` (sin cambios). ✓
- `Entregado` + notificación Telegram en completos → Task 1 (update estatus) + Task 6 (notify). ✓
- Paridad móvil → Task 7. ✓
- Usa sistema `entregas`/`entregas_items` (no `proyecto_entregas`) → Tasks 1, 5, 6. ✓

**Type consistency:** props `seleccionActiva/seleccionados/onToggleSeleccion/onToggleSeleccionTodos` idénticas entre Task 3 y Task 4; `porProyecto[pid] = { rows, loading, tipo, cantidades }` consistente entre Tasks 5 y 6; payload `{ proyecto_id, cotizacion_id, items:[{cotizacion_item_id, cantidad_entregada}] }` idéntico entre Task 1 (SQL) y Task 6 (JS). ✓
