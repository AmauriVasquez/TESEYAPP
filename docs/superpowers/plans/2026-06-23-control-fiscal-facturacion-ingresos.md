# Control Fiscal y Facturación en Ingresos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la tabla de Ingresos muestre Empresa/Marca/Método y el estatus de facturación de cada cobro, con captura manual del folio, reglas como avisos (no bloqueo) y el dato de factura anclado al cobro.

**Architecture:** Config central de cuentas de pago (`cuentasPago.js`) consumida por los dos diálogos de cobro; migración que agrega `requiere_cfdi`/`factura_descartada` a `proyectos`, `cuenta_value`/`factura_id` a `proyecto_pagos`, y una tabla `facturas` (1 fila por CFDI, ligada a 1..N cobros). La facturabilidad/entidad viven solo en la config, nunca como dato guardado. Entrega en 3 fases independientes.

**Tech Stack:** Vite + React 19, Supabase/Postgres (migraciones SQL manuales en el SQL Editor), TailwindCSS, shadcn/radix UI. **Sin framework de pruebas** → verificación por tarea = `npm run lint` + `npm run build` + checks manuales en `npm run dev` + queries SQL de verificación.

**Convenciones del repo (recordatorio):**
- Despliegue manual: `npm run build` → commit de `dist/` (incluido `dist/index.html`) → push a `origin/main` → subir a Hostinger. **No** se hace build/deploy en cada tarea; se hace al cerrar cada fase.
- Migraciones: el SQL se entrega aquí; **el usuario lo pega en el SQL Editor de Supabase** (project ref `czbmqzimjlwwgcglubey`). El agente no aplica DDL a prod.
- Listas/tablas: tarjetas en móvil (`sm:hidden`) + tabla en web (`hidden sm:block`).
- Funciones SQL nuevas: `SET search_path = pg_catalog`. RLS por `tiene_permiso('finanzas', accion)`.

**Valores de referencia:**
- `cotizaciones.branding` ∈ {`'tesey'`, `'iihemsa_peninsular'`, `'iihemsa'`}. Entidad de cuenta ∈ {`'tesey'`, `'ipe'`}. Mapeo: `tesey→tesey`, `iihemsa_peninsular`/`iihemsa→ipe`.
- `cotizaciones.marca_comercial` ∈ {`'tesey'`,`'kutra'`,`'arkeo'`} (de `MARCAS_COMERCIALES`).
- Métodos históricos en `proyecto_pagos.metodo_pago`: `'Transferencia'` (77), `'Efectivo'` (71), `'Tarjeta de Crédito/Débito'` (3).

---

## FASE 0 — Cimiento (sin BD)

### Task 1: Config central de cuentas de pago + `validarCobro`

**Files:**
- Create: `src/config/cuentasPago.js`

- [ ] **Step 1: Crear el archivo de config con datos placeholder y helpers**

```js
// src/config/cuentasPago.js
// Cuentas de pago (placeholders — el USUARIO los reemplaza con sus cuentas reales).
// La facturabilidad y la entidad viven SOLO aquí; nunca se guardan como etiqueta.
export const CUENTAS_PAGO = [
  { value: 'efectivo',        label: 'Efectivo',               entidad: null,    facturable: true  },
  { value: 'cuenta_a',        label: 'BBVA Tesey ··1234',      entidad: 'tesey', facturable: true  },
  { value: 'cuenta_b',        label: 'Santander IPE ··5678',   entidad: 'ipe',   facturable: true  },
  { value: 'cuenta_personal', label: 'Cuenta personal ··9012', entidad: null,    facturable: false },
  { value: 'tpv_a',           label: 'TPV Tesey ··3456',       entidad: 'tesey', facturable: true  },
  { value: 'tpv_personal',    label: 'TPV personal ··7890',    entidad: null,    facturable: false },
];

// Valores históricos en texto libre (solo para mostrar/migrar; facturable: null = desconocido).
export const CUENTAS_HISTORICAS = [
  { value: 'Transferencia',             label: 'Transferencia (histórica)', entidad: null, facturable: null },
  { value: 'Efectivo',                  label: 'Efectivo (histórico)',      entidad: null, facturable: true },
  { value: 'Tarjeta de Crédito/Débito', label: 'Tarjeta (histórica)',       entidad: null, facturable: null },
];

export function getCuenta(value) {
  return (
    CUENTAS_PAGO.find((c) => c.value === value) ||
    CUENTAS_HISTORICAS.find((c) => c.value === value) ||
    null
  );
}

export function getCuentaLabel(value) {
  return getCuenta(value)?.label ?? (value || '—');
}

// Mapea el branding de la cotización a la entidad fiscal de las cuentas.
export function brandingToEntidad(branding) {
  if (branding === 'tesey') return 'tesey';
  if (branding === 'iihemsa_peninsular' || branding === 'iihemsa') return 'ipe';
  return null;
}

/**
 * Reglas como AVISOS (nunca bloquean). Devuelve { nivel, mensaje }.
 * nivel: 'ok' | 'aviso'. mensaje: string | null.
 */
export function validarCobro({ requiereCfdi, cuentaValue, branding }) {
  const cuenta = getCuenta(cuentaValue);
  if (!cuenta) return { nivel: 'ok', mensaje: null };
  const entidadEsperada = brandingToEntidad(branding);

  if (requiereCfdi && cuenta.facturable === false) {
    return { nivel: 'aviso', mensaje: 'Este cobro entró a una cuenta que no factura; no podrás emitir CFDI desde aquí.' };
  }
  if (requiereCfdi && cuenta.entidad && entidadEsperada && cuenta.entidad !== entidadEsperada) {
    return { nivel: 'aviso', mensaje: 'La cuenta es de otra entidad que la empresa emisora.' };
  }
  if (!requiereCfdi && cuenta.facturable === true && cuenta.entidad) {
    return { nivel: 'aviso', mensaje: 'Depósito en cuenta facturable de un trabajo marcado sin factura.' };
  }
  return { nivel: 'ok', mensaje: null };
}
```

- [ ] **Step 2: Verificar lint**

Run: `npm run lint`
Expected: sin errores nuevos en `src/config/cuentasPago.js`.

- [ ] **Step 3: Commit**

```bash
git add src/config/cuentasPago.js
git commit -m "feat(finanzas): config central de cuentas de pago + validarCobro"
```

---

### Task 2: Usar la config en RegistrarPagoDialog

**Files:**
- Modify: `src/components/proyectos/RegistrarPagoDialog.jsx`

- [ ] **Step 1: Importar la config**

Tras los imports existentes (cerca de la línea con `import { Switch } ...`), agregar:

```jsx
import { CUENTAS_PAGO, getCuentaLabel } from '@/config/cuentasPago';
```

- [ ] **Step 2: Reemplazar el `<SelectContent>` del Método de Pago**

Localizar el bloque (≈ líneas 386-395) que contiene los `<SelectItem value="Transferencia">…</SelectItem>` hardcodeados y reemplazar SOLO los items por:

```jsx
                  <SelectContent>
                    {CUENTAS_PAGO.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
```

(Nota: el estado `metodoPago` ahora guardará el `value` de la cuenta. En modo edición, si `pagoEditar.metodo_pago` es un valor histórico, el Select quedará vacío; es aceptable — al guardar se escribirá el nuevo valor. No cambiar más lógica en esta tarea.)

- [ ] **Step 3: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: build OK.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev` → abrir un proyecto → "Registrar Pago" → el desplegable de Método muestra las cuentas de `CUENTAS_PAGO` (Efectivo, BBVA Tesey ··1234, …).

- [ ] **Step 5: Commit**

```bash
git add src/components/proyectos/RegistrarPagoDialog.jsx
git commit -m "feat(finanzas): RegistrarPagoDialog usa cuentas de config"
```

---

### Task 3: Usar la config en el diálogo "Registrar Movimiento" de Finanzas

**Files:**
- Modify: `src/pages/Finanzas.jsx`

- [ ] **Step 1: Importar la config**

Agregar junto a los imports:

```jsx
import { CUENTAS_PAGO } from '@/config/cuentasPago';
```

- [ ] **Step 2: Reemplazar los `<SelectItem>` hardcodeados del método**

Localizar el bloque (≈ líneas 894-900) con `<SelectItem value="Transferencia">…` dentro del diálogo de movimiento y reemplazar los items por:

```jsx
                <SelectContent>
                  {CUENTAS_PAGO.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
```

- [ ] **Step 3: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: build OK.

- [ ] **Step 4: Verificación manual**

Run: `npm run dev` → Finanzas → "Registrar Movimiento" → Método muestra las cuentas de config.

- [ ] **Step 5: Commit + build/deploy de cierre de fase**

```bash
git add src/pages/Finanzas.jsx
git commit -m "feat(finanzas): diálogo Registrar Movimiento usa cuentas de config"
npm run build
git add dist
git commit -m "build: F0 config de cuentas de pago"
```
(Push a `origin/main` y subida a Hostinger cuando el usuario lo indique.)

---

## FASE 1 — MVP: columnas, estructura y avisos

### Task 4: Migración SQL — flags en proyectos y cuenta estructurada en pagos

**Files:**
- Create: `supabase/migrations/2026-06-23_fiscal_f1.sql` (registro del SQL aplicado)

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- 2026-06-23_fiscal_f1.sql  (FASE 1)
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS requiere_cfdi boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS factura_descartada boolean NOT NULL DEFAULT false;

ALTER TABLE proyecto_pagos
  ADD COLUMN IF NOT EXISTS cuenta_value text;

-- Backfill: requiere_cfdi desde aplica_iva de la cotización.
UPDATE proyectos p
SET requiere_cfdi = COALESCE(c.aplica_iva, false)
FROM cotizaciones c
WHERE c.id = p.cotizacion_id;

-- Backfill best-effort de cuenta_value desde el texto libre histórico.
UPDATE proyecto_pagos SET cuenta_value = 'efectivo'      WHERE cuenta_value IS NULL AND metodo_pago = 'Efectivo';
-- 'Transferencia' y 'Tarjeta de Crédito/Débito' NO se reclasifican (facturabilidad histórica desconocida): quedan NULL.
```

- [ ] **Step 2: El usuario aplica la migración**

Acción del usuario: pegar el contenido en el SQL Editor de Supabase y ejecutarlo.

- [ ] **Step 3: Verificar en SQL**

Run (SQL Editor):
```sql
SELECT count(*) FILTER (WHERE requiere_cfdi) AS con_cfdi,
       count(*) FILTER (WHERE NOT requiere_cfdi) AS sin_cfdi FROM proyectos;
SELECT cuenta_value, count(*) FROM proyecto_pagos GROUP BY 1;
```
Expected: `con_cfdi` > 0; `efectivo` = 71, resto NULL.

- [ ] **Step 4: Commit del archivo de migración**

```bash
git add supabase/migrations/2026-06-23_fiscal_f1.sql
git commit -m "feat(db): F1 requiere_cfdi/factura_descartada + cuenta_value (migración)"
```

---

### Task 5: Guardar `cuenta_value` al registrar/editar cobros

**Files:**
- Modify: `src/components/proyectos/RegistrarPagoDialog.jsx`
- Modify: `src/pages/Finanzas.jsx`

- [ ] **Step 1: En RegistrarPagoDialog, escribir `cuenta_value` en insert y update**

En `doSave()`, en el objeto del INSERT (`supabase.from('proyecto_pagos').insert({…})`, ≈ línea 254) agregar la propiedad:

```jsx
        cuenta_value: metodoPago,
```
Y en el `payload` del UPDATE (modo edición, ≈ línea 243) agregar:

```jsx
          cuenta_value: metodoPago,
```
(Se mantiene `metodo_pago: metodoPago` para no romper el histórico/comprobantes.)

- [ ] **Step 2: En Finanzas `handleRegistrarIngreso`, escribir `cuenta_value`**

En el insert de `proyecto_pagos` (≈ línea 345) agregar:

```jsx
        cuenta_value: ingresoForm.metodoPago,
```

- [ ] **Step 3: Verificar lint + build**

Run: `npm run lint && npm run build`
Expected: build OK.

- [ ] **Step 4: Verificación manual + SQL**

Registrar un pago de prueba con cuenta "Efectivo"; luego:
```sql
SELECT id, metodo_pago, cuenta_value FROM proyecto_pagos ORDER BY id DESC LIMIT 1;
```
Expected: `cuenta_value = 'efectivo'`.

- [ ] **Step 5: Commit**

```bash
git add src/components/proyectos/RegistrarPagoDialog.jsx src/pages/Finanzas.jsx
git commit -m "feat(finanzas): persistir cuenta_value en cobros"
```

---

### Task 6: Setear `requiere_cfdi` al aprobar la cotización

**Files:**
- Modify: `src/pages/Cotizaciones.jsx` (y/o el hook que inserta en `proyectos`)

- [ ] **Step 1: Localizar la creación del proyecto**

Run: `grep -n "from('proyectos').insert" src/pages/Cotizaciones.jsx src/hooks/*.js src/hooks/*.jsx`
La aprobación llama `handleCreateProjectFromQuote(cotizacionResuelta)` / `handleCreateOrUpdateProjectFromQuote(...)`. Identificar el objeto pasado a `supabase.from('proyectos').insert({...})`.

- [ ] **Step 2: Agregar `requiere_cfdi` al insert del proyecto**

En ese objeto de inserción agregar:

```jsx
        requiere_cfdi: cotizacionResuelta.aplica_iva !== false,
```

- [ ] **Step 3: Cubrir el caso "actualizar proyecto existente"**

En `handleConfirmApproval` (Cotizaciones.jsx ≈ línea 362, rama `isDirty`) y en el update de proyecto existente (≈ línea 514), agregar `requiere_cfdi: cotizacionResuelta.aplica_iva !== false` al `.update({...})` de `proyectos` correspondiente, para que aprobar con/ sin IVA sincronice la bandera.

- [ ] **Step 4: Verificar lint + build**

Run: `npm run lint && npm run build`

- [ ] **Step 5: Verificación manual + SQL**

Aprobar una cotización con IVA → crear proyecto → revisar:
```sql
SELECT id, folio, requiere_cfdi FROM proyectos ORDER BY id DESC LIMIT 1;
```
Expected: `requiere_cfdi = true`. Repetir con una cotización sin IVA → `false`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Cotizaciones.jsx
git commit -m "feat(finanzas): requiere_cfdi se establece al aprobar (desde aplica_iva)"
```

---

### Task 7: Enriquecer la lectura de ingresos con Empresa/Marca/Método

**Files:**
- Modify: `src/pages/Finanzas.jsx` (efecto `ingresosConProyecto`, ≈ líneas 171-209)

- [ ] **Step 1: Ampliar el SELECT de proyectos y el mapeo**

Reemplazar el `.select(...)` del efecto que arma `mapProy` por uno que traiga branding/marca/flags de la cotización y el proyecto:

```jsx
    supabase
      .from('proyectos')
      .select('id, folio, descripcion, requiere_cfdi, factura_descartada, cliente:cliente_id(nombre), cliente_nombre_externo, cotizacion:cotizacion_id(branding, marca_comercial)')
      .in('id', proyectoIds)
      .then(({ data: proyData }) => {
        const mapProy = (proyData || []).reduce(
          (acc, p) => ({
            ...acc,
            [p.id]: {
              nombre: p?.cliente?.nombre ?? p?.cliente_nombre_externo ?? 'Cliente Desconocido',
              descripcion: p?.descripcion ?? '',
              folio: p?.folio ?? '',
              empresa: p?.cotizacion?.branding ?? null,
              marca: p?.cotizacion?.marca_comercial ?? null,
              requiere_cfdi: !!p?.requiere_cfdi,
              factura_descartada: !!p?.factura_descartada,
            },
          }),
          {}
        );
        setIngresosConProyecto(
          list.map((i) => {
            const p = mapProy[i?.proyecto_id];
            return {
              ...i,
              cliente: p?.nombre ?? '-',
              proyecto: p ? `${p.folio} – ${p.descripcion}` : '-',
              empresa: p?.empresa ?? null,
              marca: p?.marca ?? null,
              requiere_cfdi: p?.requiere_cfdi ?? false,
              factura_descartada: p?.factura_descartada ?? false,
            };
          })
        );
      });
```

- [ ] **Step 2: Verificar lint + build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Verificación manual**

`npm run dev` → Finanzas → en React DevTools o un `console.log` temporal confirmar que cada ingreso trae `empresa`, `marca`, `requiere_cfdi`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Finanzas.jsx
git commit -m "feat(finanzas): ingresos traen empresa/marca/requiere_cfdi por join"
```

---

### Task 8: Columnas Empresa/Marca/Método en la tabla + helpers de display

**Files:**
- Create: `src/lib/facturacionDisplay.js`
- Modify: `src/pages/Finanzas.jsx`

- [ ] **Step 1: Crear helpers de presentación**

```js
// src/lib/facturacionDisplay.js
const EMPRESA_LABEL = { tesey: 'Tesey', iihemsa_peninsular: 'IPE', iihemsa: 'IPE' };
const MARCA_LABEL = { tesey: 'TESEY', kutra: 'KUTRA', arkeo: 'ARKEO' };

export function empresaLabel(branding) {
  return EMPRESA_LABEL[branding] ?? (branding ? String(branding) : '—');
}
export function marcaLabel(marca) {
  return MARCA_LABEL[marca] ?? (marca ? String(marca) : '—');
}

/**
 * Estatus de facturación de un ingreso. Orden: facturado → descartado → pendiente → sin IVA.
 * ingreso requiere: { requiere_cfdi, factura_descartada, factura_numero }
 */
export function estatusFactura(ingreso) {
  if (ingreso?.factura_numero) return { key: 'facturado', label: `Facturado · ${ingreso.factura_numero}`, tone: 'green' };
  if (ingreso?.requiere_cfdi && ingreso?.factura_descartada) return { key: 'descartado', label: 'No se facturará', tone: 'gray' };
  if (ingreso?.requiere_cfdi) return { key: 'pendiente', label: 'Facturación pendiente', tone: 'amber' };
  return { key: 'sin_iva', label: '—', tone: 'muted' };
}
```
(`factura_numero` se conecta en F2; hasta entonces siempre será pendiente/descartado/sin-IVA.)

- [ ] **Step 2: Importar helpers en Finanzas**

```jsx
import { empresaLabel, marcaLabel, estatusFactura } from '@/lib/facturacionDisplay';
import { getCuentaLabel } from '@/config/cuentasPago';
```

- [ ] **Step 3: Agregar encabezados de columna (tabla web)**

En el `<TableHeader>` de Ingresos (≈ líneas 538-580), tras el `<TableHead>` de "Proyecto" y antes del de "Monto", insertar tres `<TableHead>` simples (no ordenables):

```jsx
                        <TableHead>Empresa</TableHead>
                        <TableHead>Marca</TableHead>
                        <TableHead>Método</TableHead>
```

- [ ] **Step 4: Agregar las celdas en cada fila**

En el `map` de `sortedIngresos` (≈ líneas 588-595), entre la celda de Proyecto y la de Monto, insertar:

```jsx
                            <TableCell>{empresaLabel(i.empresa)}</TableCell>
                            <TableCell>{marcaLabel(i.marca)}</TableCell>
                            <TableCell className="whitespace-nowrap">{getCuentaLabel(i.cuenta_value || i.metodo_pago)}</TableCell>
```
Actualizar el `colSpan` del estado vacío de 4 → 7.

- [ ] **Step 5: Tarjetas en móvil**

Si la tabla de ingresos no tiene aún versión móvil, envolver la tabla actual en `hidden sm:block` y agregar, antes, un bloque `sm:hidden` que renderee cada ingreso como tarjeta:

```jsx
                <div className="sm:hidden space-y-2">
                  {sortedIngresos.length === 0 ? (
                    <p className="text-center py-6 text-gray-500">No hay ingresos en el periodo.</p>
                  ) : sortedIngresos.map((i, idx) => (
                    <div key={i?.id ?? `ingm-${idx}`} className="rounded-lg border p-3 bg-white">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">{i.cliente}</span>
                        <span className="text-sm font-semibold text-green-700">${Number(i.monto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-xs text-gray-500">{i.proyecto}</p>
                      <p className="text-xs mt-1">{empresaLabel(i.empresa)} · {marcaLabel(i.marca)} · {getCuentaLabel(i.cuenta_value || i.metodo_pago)}</p>
                      <p className="text-xs text-gray-400">{formatDateTable(i.fecha || i.fecha_pago)}</p>
                    </div>
                  ))}
                </div>
```

- [ ] **Step 6: Verificar lint + build + manual**

Run: `npm run lint && npm run build`; luego `npm run dev` → Finanzas → la tabla muestra Empresa/Marca/Método; en móvil (DevTools responsive) se ven tarjetas.

- [ ] **Step 7: Commit**

```bash
git add src/lib/facturacionDisplay.js src/pages/Finanzas.jsx
git commit -m "feat(finanzas): columnas Empresa/Marca/Método + tarjetas móvil"
```

---

### Task 9: Avisos `validarCobro` en ambos diálogos

**Files:**
- Modify: `src/components/proyectos/RegistrarPagoDialog.jsx`
- Modify: `src/pages/Finanzas.jsx`

- [ ] **Step 1: En RegistrarPagoDialog, calcular y mostrar el aviso**

Importar: `import { validarCobro } from '@/config/cuentasPago';`
El componente ya tiene `aplicaIva` y `proyecto`. Agregar un `useMemo`:

```jsx
  const avisoCobro = useMemo(
    () => validarCobro({
      requiereCfdi: tieneCotizacion ? aplicaIva : !!proyecto?.requiere_cfdi,
      cuentaValue: metodoPago,
      branding: proyecto?.cotizacion?.branding ?? proyecto?.branding ?? null,
    }),
    [aplicaIva, metodoPago, tieneCotizacion, proyecto]
  );
```
Bajo el `<Select>` de Método de Pago (tras su `</div>` de cierre), renderizar:

```jsx
              {avisoCobro.mensaje && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                  ⚠️ {avisoCobro.mensaje}
                </div>
              )}
```
(No condicionar `handleSave`/`doSave` al aviso: nunca bloquea.)

- [ ] **Step 2: En Finanzas (Registrar Movimiento), mostrar el aviso**

`handleOpenMovimiento` ya carga proyectos; ampliar ese `.select` a `'id, folio, descripcion, requiere_cfdi, cotizacion:cotizacion_id(branding)'` y guardar el proyecto elegido. Agregar memo:

```jsx
  const proyectoMovSeleccionado = useMemo(
    () => proyectosOptions.find((o) => o.value === selectedProyectoId)?.raw ?? null,
    [proyectosOptions, selectedProyectoId]
  );
  const avisoMovimiento = useMemo(
    () => validarCobro({
      requiereCfdi: !!proyectoMovSeleccionado?.requiere_cfdi,
      cuentaValue: ingresoForm.metodoPago,
      branding: proyectoMovSeleccionado?.cotizacion?.branding ?? null,
    }),
    [proyectoMovSeleccionado, ingresoForm.metodoPago]
  );
```
(Para que `.raw` exista, en `handleOpenMovimiento` mapear las opciones como `{ value: String(p.id), label: ..., raw: p }`.)
Importar `validarCobro` y renderizar el mismo bloque amarillo bajo el Select de método del diálogo de movimiento.

- [ ] **Step 3: Verificar lint + build + manual**

Run: `npm run lint && npm run build`; `npm run dev` → en un proyecto con IVA, elegir una cuenta "no facturable" → aparece el aviso amarillo y **sí** deja guardar.

- [ ] **Step 4: Commit + build/deploy de cierre de fase**

```bash
git add src/components/proyectos/RegistrarPagoDialog.jsx src/pages/Finanzas.jsx
git commit -m "feat(finanzas): avisos validarCobro (no bloqueantes) en ambos diálogos"
npm run build
git add dist
git commit -m "build: F1 control fiscal en Ingresos"
```

---

## FASE 2 — Facturación: tabla `facturas`, captura y bandera

### Task 10: Migración SQL — tabla `facturas` + enlace al cobro + RLS

**Files:**
- Create: `supabase/migrations/2026-06-23_fiscal_f2.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 2026-06-23_fiscal_f2.sql  (FASE 2)
CREATE TABLE IF NOT EXISTS facturas (
  id              serial PRIMARY KEY,
  proyecto_id     integer NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  empresa_emisora text NOT NULL,             -- 'tesey' | 'ipe'
  numero          text NOT NULL,
  fecha_emision   date NOT NULL,
  monto           numeric,
  uuid            text NULL,
  url_cfdi        text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturas_numero_unico UNIQUE (numero),
  CONSTRAINT facturas_uuid_unico   UNIQUE (uuid)
);

ALTER TABLE proyecto_pagos
  ADD COLUMN IF NOT EXISTS factura_id integer NULL REFERENCES facturas(id) ON DELETE SET NULL;

ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY facturas_select ON facturas FOR SELECT
  USING (tiene_permiso('finanzas', 'ver'));
CREATE POLICY facturas_insert ON facturas FOR INSERT
  WITH CHECK (tiene_permiso('finanzas', 'crear'));
CREATE POLICY facturas_update ON facturas FOR UPDATE
  USING (tiene_permiso('finanzas', 'editar'));
```

- [ ] **Step 2: El usuario aplica la migración** (SQL Editor). Confirmar acciones válidas de `tiene_permiso` revisando una policy existente del módulo finanzas; ajustar los nombres de acción (`'ver'`/`'crear'`/`'editar'`) a los que el proyecto ya use.

- [ ] **Step 3: Verificar**

```sql
SELECT to_regclass('public.facturas');                       -- no nulo
SELECT column_name FROM information_schema.columns
  WHERE table_name='proyecto_pagos' AND column_name='factura_id';  -- 1 fila
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026-06-23_fiscal_f2.sql
git commit -m "feat(db): F2 tabla facturas + proyecto_pagos.factura_id + RLS (migración)"
```

---

### Task 11: Servicio de facturas

**Files:**
- Create: `src/services/facturasService.js`

- [ ] **Step 1: Crear el servicio**

```js
// src/services/facturasService.js
import { supabase } from '@/lib/customSupabaseClient';

/** Crea una factura y liga los cobros indicados. cobroIds = [] => factura del proyecto sin ligar cobros aún. */
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

/** Marca el proyecto como "No se facturará". */
export async function descartarFacturacion(proyectoId) {
  const { error } = await supabase
    .from('proyectos')
    .update({ factura_descartada: true })
    .eq('id', proyectoId);
  return { error };
}

/** Cobros facturables (con cuenta facturable) de un proyecto, sin factura aún. */
export async function getCobrosProyecto(proyectoId) {
  const { data, error } = await supabase
    .from('proyecto_pagos')
    .select('id, monto, fecha_pago, cuenta_value, metodo_pago, factura_id')
    .eq('proyecto_id', proyectoId)
    .order('fecha_pago', { ascending: false });
  return { data, error };
}
```

- [ ] **Step 2: Lint + commit**

```bash
npm run lint
git add src/services/facturasService.js
git commit -m "feat(finanzas): facturasService (registrar/descartar/listar cobros)"
```

---

### Task 12: Diálogo reutilizable `RegistrarFacturaDialog`

**Files:**
- Create: `src/components/finanzas/RegistrarFacturaDialog.jsx`

- [ ] **Step 1: Crear el componente**

```jsx
// src/components/finanzas/RegistrarFacturaDialog.jsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { registrarFactura, descartarFacturacion, getCobrosProyecto } from '@/services/facturasService';
import { brandingToEntidad } from '@/config/cuentasPago';
import { format } from 'date-fns';

const ENTIDADES = [{ value: 'tesey', label: 'TESEY' }, { value: 'ipe', label: 'IIHEMSA Peninsular (IPE)' }];

export default function RegistrarFacturaDialog({ open, onOpenChange, proyecto, onSaved }) {
  const { toast } = useToast();
  const [emisora, setEmisora] = useState('tesey');
  const [alcance, setAlcance] = useState('proyecto'); // 'proyecto' | 'ingreso'
  const [cobros, setCobros] = useState([]);
  const [cobroId, setCobroId] = useState('');
  const [numero, setNumero] = useState('');
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [monto, setMonto] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !proyecto) return;
    setEmisora(brandingToEntidad(proyecto?.cotizacion?.branding ?? proyecto?.branding) ?? 'tesey');
    setAlcance('proyecto'); setCobroId(''); setNumero(''); setMonto('');
    setFecha(format(new Date(), 'yyyy-MM-dd'));
    getCobrosProyecto(proyecto.id).then(({ data }) => setCobros((data || []).filter((c) => !c.factura_id)));
  }, [open, proyecto]);

  const handleGuardar = async () => {
    if (!numero.trim() || !fecha) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'Número de factura y fecha son obligatorios.' });
      return;
    }
    const cobroIds = alcance === 'ingreso' && cobroId ? [Number(cobroId)] : cobros.map((c) => c.id);
    setSaving(true);
    const { error } = await registrarFactura({
      proyectoId: proyecto.id,
      empresaEmisora: emisora,
      numero: numero.trim(),
      fechaEmision: fecha,
      monto: monto ? parseFloat(monto) : null,
      cobroIds,
    });
    setSaving(false);
    if (error) {
      const dup = /facturas_numero_unico|duplicate key/i.test(error.message);
      toast({ variant: 'destructive', title: 'Error', description: dup ? `El folio "${numero}" ya existe.` : error.message });
      return;
    }
    toast({ title: '✅ Factura registrada' });
    onSaved?.(); onOpenChange(false);
  };

  const handleDescartar = async () => {
    if (!window.confirm('¿Marcar este proyecto como "No se facturará"?')) return;
    setSaving(true);
    const { error } = await descartarFacturacion(proyecto.id);
    setSaving(false);
    if (error) { toast({ variant: 'destructive', title: 'Error', description: error.message }); return; }
    toast({ title: 'Marcado como no facturable' });
    onSaved?.(); onOpenChange(false);
  };

  if (!proyecto) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:w-full">
        <DialogHeader><DialogTitle>Registrar Factura · {proyecto.folio}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Empresa emisora</Label>
            <Select value={emisora} onValueChange={setEmisora}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENTIDADES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 text-sm">
            <label className="flex items-center gap-2"><input type="radio" checked={alcance === 'proyecto'} onChange={() => setAlcance('proyecto')} /> Todo el proyecto (liga {cobros.length} cobro(s))</label>
            <label className="flex items-center gap-2"><input type="radio" checked={alcance === 'ingreso'} onChange={() => setAlcance('ingreso')} /> Un ingreso específico</label>
          </div>
          {alcance === 'ingreso' && (
            <div className="space-y-2">
              <Label>Ingreso</Label>
              <Select value={cobroId} onValueChange={setCobroId}>
                <SelectTrigger><SelectValue placeholder="Elige el cobro..." /></SelectTrigger>
                <SelectContent>{cobros.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fecha_pago} · ${Number(c.monto).toLocaleString('es-MX')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Número de factura *</Label><Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="A-1009" /></div>
            <div className="space-y-2"><Label>Fecha *</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Monto (opcional)</Label><Input type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></div>
        </div>
        <DialogFooter className="flex-row justify-between">
          <Button variant="ghost" className="text-gray-600" onClick={handleDescartar} disabled={saving}>No se facturará</Button>
          <div className="flex gap-2">
            <DialogClose asChild><Button variant="outline" disabled={saving}>Cancelar</Button></DialogClose>
            <Button onClick={handleGuardar} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Marcar como Facturado
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`

- [ ] **Step 3: Commit**

```bash
git add src/components/finanzas/RegistrarFacturaDialog.jsx
git commit -m "feat(finanzas): RegistrarFacturaDialog reutilizable"
```

---

### Task 13: Bandera de Factura en la tabla de Ingresos + apertura del diálogo

**Files:**
- Modify: `src/pages/Finanzas.jsx`

- [ ] **Step 1: Traer `factura_numero` en la lectura de ingresos**

Ampliar el join del cobro→factura. En `getIngresos` (`src/services/finanzasService.js`) el SELECT es `'*'` sobre la vista `finanzas_ingresos` (no incluye `factura_id`). En su lugar, en el efecto de `Finanzas.jsx` que ya consulta `proyecto_pagos` no aplica directo; por simplicidad, en Task 7 el `map` se hace por proyecto. Para el folio, agregar una consulta de facturas por proyecto:

```jsx
// dentro del efecto de ingresosConProyecto, tras obtener proyData:
const { data: facturasData } = await supabase
  .from('proyecto_pagos')
  .select('id, factura_id, factura:factura_id(numero)')
  .in('proyecto_id', proyectoIds);
const facturaPorPago = (facturasData || []).reduce((acc, r) => {
  acc[r.id] = r?.factura?.numero ?? null; return acc;
}, {});
```
Y en el `map(list...)` agregar `factura_numero: facturaPorPago[i.id] ?? null`. (Convertir el `.then(...)` del efecto en una función `async` para poder usar `await`.)

- [ ] **Step 2: Agregar la columna "Factura" (header + celda + tarjeta)**

Header (tras "Monto" o al final): `<TableHead className="text-center">Factura</TableHead>`. Celda en cada fila:

```jsx
                            <TableCell className="text-center">
                              {(() => {
                                const e = estatusFactura(i);
                                const toneCls = { green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800 cursor-pointer', gray: 'bg-gray-100 text-gray-600', muted: 'text-gray-400' }[e.tone];
                                const clickable = e.key === 'pendiente';
                                return (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-xs ${toneCls}`}
                                    onClick={clickable ? () => abrirFactura(i.proyecto_id) : undefined}
                                  >{e.label}{clickable ? ' ▸' : ''}</span>
                                );
                              })()}
                            </TableCell>
```
Actualizar el `colSpan` del vacío (7 → 8). Agregar el mismo badge a la tarjeta móvil.

- [ ] **Step 3: Estado y handler para abrir el diálogo**

```jsx
import RegistrarFacturaDialog from '@/components/finanzas/RegistrarFacturaDialog';
// ...
const [facturaProyecto, setFacturaProyecto] = useState(null);
const abrirFactura = async (proyectoId) => {
  const { data } = await supabase.from('proyectos')
    .select('id, folio, descripcion, cotizacion:cotizacion_id(branding)').eq('id', proyectoId).single();
  setFacturaProyecto(data || null);
};
```
Renderizar al final del componente:

```jsx
<RegistrarFacturaDialog
  open={!!facturaProyecto}
  onOpenChange={(o) => { if (!o) setFacturaProyecto(null); }}
  proyecto={facturaProyecto}
  onSaved={() => { setFacturaProyecto(null); fetchDatos(); }}
/>
```

- [ ] **Step 4: Filtro por estatus de factura + Empresa/Marca**

Agregar estado `const [filtroFactura, setFiltroFactura] = useState('todas');` y un grupo de botones encima de la tabla:

```jsx
<div className="flex gap-2 flex-wrap text-xs">
  {[['todas','Todas'],['pendiente','Pendientes'],['facturado','Facturadas'],['descartado','No se facturará'],['sin_iva','Sin IVA']].map(([k,l]) => (
    <button key={k} onClick={() => setFiltroFactura(k)} className={`px-3 py-1 rounded-full border ${filtroFactura===k?'bg-blue-600 text-white':'bg-white'}`}>{l}</button>
  ))}
</div>
```
Filtrar `sortedIngresos` antes de render: `const ingresosFiltrados = filtroFactura==='todas' ? sortedIngresos : sortedIngresos.filter((i) => estatusFactura(i).key === filtroFactura);` y usar `ingresosFiltrados` en el map (web y móvil).

- [ ] **Step 5: Lint + build + manual**

Run: `npm run lint && npm run build`; `npm run dev` → un proyecto con IVA muestra "Facturación pendiente ▸"; clic abre el diálogo; registrar folio → la fila pasa a "Facturado · <folio>"; filtros funcionan; folio repetido → error claro.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Finanzas.jsx
git commit -m "feat(finanzas): bandera de factura + captura + filtros en Ingresos"
```

---

### Task 14: Botón de factura en ProyectoDetalle

**Files:**
- Modify: `src/pages/ProyectoDetalle.jsx`

- [ ] **Step 1: Importar el diálogo y agregar estado**

```jsx
import RegistrarFacturaDialog from '@/components/finanzas/RegistrarFacturaDialog';
// junto a los otros useState:
const [facturaDialogOpen, setFacturaDialogOpen] = useState(false);
```

- [ ] **Step 2: Botón en la sección de pagos**

Junto al botón "Registrar Pago" (≈ línea 1094), agregar (solo si `proyecto.requiere_cfdi`):

```jsx
{proyecto?.requiere_cfdi && (
  <Button size="sm" variant="outline" className="gap-2" onClick={() => setFacturaDialogOpen(true)}>
    <FileText className="w-4 h-4" /> Registrar Factura
  </Button>
)}
```

- [ ] **Step 3: Renderizar el diálogo**

Cerca del `<RegistrarPagoDialog ... />` (≈ línea 1256):

```jsx
{proyecto && (
  <RegistrarFacturaDialog
    open={facturaDialogOpen}
    onOpenChange={setFacturaDialogOpen}
    proyecto={proyecto}
    onSaved={() => { setFacturaDialogOpen(false); fetchProyectoData(true); }}
  />
)}
```
(Verificar que el objeto `proyecto` incluya `cotizacion.branding`; si no, ampliar su SELECT de carga para traer `cotizacion:cotizacion_id(branding)`.)

- [ ] **Step 4: Lint + build + manual**

Run: `npm run lint && npm run build`; `npm run dev` → abrir un proyecto con IVA → aparece "Registrar Factura"; capturar folio → se refleja.

- [ ] **Step 5: Commit + build/deploy de cierre de fase**

```bash
git add src/pages/ProyectoDetalle.jsx
git commit -m "feat(finanzas): registrar factura desde ProyectoDetalle"
npm run build
git add dist
git commit -m "build: F2 facturación de Ingresos"
```

---

## Verificación final (toda la feature)
- [ ] Aprobar cotización con IVA → proyecto con `requiere_cfdi=true` → ingreso aparece "Facturación pendiente".
- [ ] Registrar factura "todo el proyecto" → todos sus cobros muestran "Facturado · folio".
- [ ] Registrar factura "un ingreso" → solo ese cobro cambia.
- [ ] Folio repetido (aunque sea de otra empresa) → error de unicidad.
- [ ] Cuenta no facturable en proyecto con IVA → aviso amarillo, **no** bloquea.
- [ ] "No se facturará" → bandera ⊘ y sale de "Pendientes".
- [ ] Móvil: tarjetas en Ingresos y en pagos del proyecto.
- [ ] Cotización sin IVA → ingreso "—", sin bandera.

## Riesgos vivos (del pressure-test, vigilar en QA)
1. Abandono de captura manual → la bandera distingue pendiente/no-aplica/facturado y existe "No se facturará".
2. Conciliación monto facturado vs cobrado: F2 liga cobros reales, no el total de la cotización.
3. Histórico `Transferencia`/`Tarjeta` queda `cuenta_value=NULL` (no se inventa facturabilidad).
4. Un cobro a lo más una factura (`factura_id` único por cobro; el diálogo liga solo cobros sin factura).
