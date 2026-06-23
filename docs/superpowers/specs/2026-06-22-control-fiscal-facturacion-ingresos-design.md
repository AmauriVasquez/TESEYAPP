# Diseño: Control fiscal y facturación en el módulo de Ingresos

- **Fecha:** 2026-06-22
- **Estado:** Aprobado (validado con council + abogado del diablo)
- **Módulo:** Finanzas / Ingresos (`src/pages/Finanzas.jsx`, `src/services/finanzasService.js`, `src/components/proyectos/RegistrarPagoDialog.jsx`)
- **Decisión de modelo:** factura anclada al **cobro**, con **vista por proyecto** como flujo por defecto.

---

## 1. Problema y objetivo

Hoy la tabla general de Ingresos (`finanzas_ingresos` = vista sobre `proyecto_pagos`) muestra solo Fecha, Cliente, Proyecto y Monto. No hay forma de saber, desde el sistema:

- A qué **empresa/entidad fiscal** (TESEY o IIHEMSA Peninsular / "IPE") y a qué **marca comercial** (TESEY/KUTRA/ARKEO) pertenece cada ingreso.
- Por qué **cuenta** entró el dinero, ni si esa cuenta permite emitir factura.
- Si un trabajo **ya se facturó**, con qué **número de factura**, o si la facturación está **pendiente**.

**Objetivo:** que sea fácil llevar el control del estatus fiscal de cada ingreso y darle seguimiento a la factura, sin corromper datos ni construir un riesgo de auditoría.

### Datos de partida (verificados en producción, 2026-06-22)
- `proyecto_pagos`: 151 pagos. Métodos actuales: `Transferencia` (77), `Efectivo` (71), `Tarjeta de Crédito/Débito` (3). **Sin nulls ni basura.**
- Los 151 pagos tienen `cotizacion_id` → todos heredan `branding`, `marca_comercial` y `aplica_iva`.
- `cotizaciones` ya tiene: `branding` (entidad fiscal), `marca_comercial`, `aplica_iva`, `total`.
- `proyecto_pagos` hoy: `id, proyecto_id, fecha_pago, monto, metodo_pago (texto libre), url_cfdi, comentarios, created_at`.
- Métodos de pago hoy **hardcodeados en dos lugares**: `Finanzas.jsx` (diálogo "Registrar Movimiento") y `RegistrarPagoDialog.jsx`.

---

## 2. Decisiones de diseño (tomadas con el usuario)

| # | Tema | Decisión |
|---|------|----------|
| 1 | Modelo de facturación | Factura por **proyecto/monto final** como flujo por defecto, pero el dato **anclado al cobro** para soportar anticipos/parciales. |
| 2 | Disparador "requiere factura" | El **IVA en la aprobación** (`aplica_iva`). El método de pago **no** dispara la factura. |
| 3 | Empresa emisora | Default del **`branding`** de la cotización, pero **editable** al facturar (no read-only). |
| 4 | Métodos de pago | **Cuentas con nombre neutral** (banco + últimos 4). La facturabilidad y la entidad viven **solo en la config/lógica**, nunca como palabra guardada. |
| 5 | Reglas R2/R3 | **Advertencias, no bloqueos.** Nunca impiden registrar la realidad. Se agrega la alerta inversa. |
| 6 | Folio de factura | **Captura manual.** `numero` **único global** (no se repite ni entre empresas). Carga/extracción de XML = fase futura. |
| 7 | Dato "no fiscal" | **No se etiqueta ni se agrega** "ingreso no fiscal" como categoría/reporte. Solo se marca lo facturable vía la lógica de cuentas. |

---

## 3. Modelo de datos

### 3.1 Config de cuentas de pago — `src/config/cuentasPago.js`
Fuente única de verdad para los dos diálogos de cobro. **Seed con placeholders; el usuario los edita.**

```js
// Placeholders — el usuario reemplaza con sus cuentas reales.
export const CUENTAS_PAGO = [
  { value: 'efectivo',        label: 'Efectivo',                 entidad: null,    facturable: true  },
  { value: 'cuenta_a',        label: 'BBVA Tesey ··1234',        entidad: 'tesey', facturable: true  },
  { value: 'cuenta_b',        label: 'Santander IPE ··5678',     entidad: 'ipe',   facturable: true  },
  { value: 'cuenta_personal', label: 'Cuenta personal ··9012',   entidad: null,    facturable: false },
  { value: 'tarjeta_a',       label: 'TPV Tesey ··3456',         entidad: 'tesey', facturable: true  },
  { value: 'tarjeta_b',       label: 'TPV no fiscal ··7890',     entidad: null,    facturable: false },
];

// Compatibilidad con datos históricos (texto libre actual)
export const CUENTAS_HISTORICAS = [
  { value: 'Transferencia',              label: 'Transferencia (histórica)',  entidad: null, facturable: null },
  { value: 'Efectivo',                   label: 'Efectivo (histórico)',       entidad: null, facturable: true },
  { value: 'Tarjeta de Crédito/Débito',  label: 'Tarjeta (histórica)',        entidad: null, facturable: null },
];
```
- `facturable: null` = histórico no clasificable (no se inventa).
- La palabra "fiscal/no fiscal" **no aparece** en `label`. La regla usa `facturable`/`entidad`.

### 3.2 Cambios en tablas (migración SQL manual)

**`proyectos`**
- `requiere_cfdi boolean NOT NULL DEFAULT false` — se pone `true` al aprobar la cotización si `aplica_iva = true`. Editable.
- `factura_descartada boolean NOT NULL DEFAULT false` — el usuario marcó explícitamente "No se facturará" (cierra el pendiente sin emitir CFDI). Solo aplica cuando `requiere_cfdi = true`.
- Backfill: `UPDATE proyectos p SET requiere_cfdi = COALESCE(c.aplica_iva, false) FROM cotizaciones c WHERE c.id = p.cotizacion_id;`

**`proyecto_pagos`**
- `cuenta_value text` — valor estructurado de la cuenta (de `CUENTAS_PAGO`). Convive con `metodo_pago` (texto libre histórico, se conserva como respaldo).
- `factura_id integer NULL REFERENCES facturas(id) ON DELETE SET NULL` — el cobro que quedó amparado por una factura.

**Tabla nueva `facturas`** (una fila por CFDI emitido)
```sql
CREATE TABLE facturas (
  id              serial PRIMARY KEY,
  proyecto_id     integer NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  empresa_emisora text NOT NULL,            -- 'tesey' | 'ipe' (default branding, editable)
  numero          text NOT NULL,            -- folio capturado a mano
  fecha_emision   date NOT NULL,
  monto           numeric,
  uuid            text NULL,                -- futuro: del XML del CFDI
  url_cfdi        text NULL,                -- futuro: PDF/XML adjunto
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facturas_numero_unico UNIQUE (numero),   -- folio único GLOBAL (ni entre empresas)
  CONSTRAINT facturas_uuid_unico   UNIQUE (uuid)
);
```
- `UNIQUE (numero)` global por decisión #6 (evitar duplicados de captura). Nota: fiscalmente distintos RFCs pueden compartir folio; es una regla de negocio deliberada, relajable a `UNIQUE (empresa_emisora, numero)` si el usuario lo pide.
- Relación con cobros vía `proyecto_pagos.factura_id` (una factura ampara 1..N cobros).
- RLS: escritura/lectura bajo `tiene_permiso('finanzas', accion)` (patrón del proyecto). Recordar `SET search_path = pg_catalog` en cualquier función nueva.

### 3.3 Empresa y Marca en la tabla de Ingresos
Derivadas por join `proyecto → cotización` (`branding` → Empresa, `marca_comercial` → Marca). Solo lectura. Se obtienen extendiendo el fetch que `Finanzas.jsx` ya hace a `proyectos`, o ampliando la vista `finanzas_ingresos`.

---

## 4. Reglas de negocio — `validarCobro()` (función compartida)

Una sola función pura, usada por **ambos** diálogos (crear y editar), para evitar desincronización. Devuelve avisos; **nunca bloquea**.

Entrada: `{ requiere_cfdi, cuenta (de CUENTAS_PAGO), branding }`.

| Regla | Condición | Aviso (amarillo, no bloquea) |
|-------|-----------|------------------------------|
| A1 | `requiere_cfdi` y `cuenta.facturable === false` | "Este cobro entró a una cuenta que no factura; no podrás emitir CFDI desde aquí." |
| A2 | `requiere_cfdi` y `cuenta.entidad` y `cuenta.entidad !== branding` | "La cuenta es de otra entidad que la empresa emisora." |
| A3 (inversa) | `!requiere_cfdi` y `cuenta.facturable === true` | "Depósito en cuenta facturable de un trabajo marcado sin factura." |

`efectivo` y cuentas con `entidad: null` no disparan A2.

---

## 5. UI

### 5.1 Tabla de Ingresos (`Finanzas.jsx`)
- **8 columnas:** Fecha, Cliente, Proyecto, **Empresa**, **Marca**, **Método (cuenta)**, Monto, **Factura**.
- **Bandera Factura:**
  - ✓ `Facturado · <folio>` — cobro con `factura_id`.
  - ⊘ `No se facturará` — `requiere_cfdi` y `factura_descartada = true`.
  - ⏳ `Facturación pendiente` — `requiere_cfdi`, `!factura_descartada` y sin factura.
  - `—` — `requiere_cfdi = false` (sin IVA).

  (Orden de evaluación: Facturado → No se facturará → Pendiente → sin IVA.)
- **Filtros:** estatus (Todas / Pendientes / Facturadas / No se facturará / Sin IVA) + por Empresa + por Marca.
- **Móvil:** tarjetas (`sm:hidden`) + tabla (`hidden sm:block`), fila clickable. (Regla obligatoria del proyecto.)
- La bandera "Pendiente" es un botón → abre el panel de captura.

### 5.2 Panel "Registrar Factura" (reutilizable)
Disponible desde la tabla de Ingresos **y** desde `ProyectoDetalle`.
- Empresa emisora: default del `branding`, **editable** (Tesey/IPE).
- Alcance: ⦿ "Todo el proyecto (monto final)" (liga los cobros facturables del proyecto) / ○ "Un ingreso específico" (liga 1 cobro).
- Número * (valida unicidad global, error claro si se repite), Fecha *, Monto, opción de pegar URL/UUID (futuro).
- Acción extra: marcar el proyecto como **"No se facturará"** (cierra el pendiente con honestidad).
- Guardar → inserta en `facturas`, setea `proyecto_pagos.factura_id`, refresca bandera.

### 5.3 Diálogos de cobro (RegistrarPagoDialog + "Registrar Movimiento")
- Reemplazar el `Select` de método por la lista de `CUENTAS_PAGO`.
- Al elegir cuenta, ejecutar `validarCobro()` y mostrar el aviso correspondiente (no bloquea Guardar).

---

## 6. Fuera de alcance (YAGNI)
- Timbrado / conexión a PAC o SAT automática.
- Extracción de datos desde el XML del CFDI (el modelo ya guarda `uuid`/`url_cfdi` para que sea un **upgrade**, no un rebuild).
- Complementos de pago (PPD), notas de crédito, anticipos CFDI automáticos.
- Reporte agregado de "ingreso no fiscal" (decisión #7).

---

## 7. Fases de entrega
- **F0 — Cimiento (sin BD):** crear `cuentasPago.js`; reemplazar los 2 hardcodeos de método por el import. Desplegar y validar que ambos diálogos siguen funcionando.
- **F1 — MVP:** migración (`proyectos.requiere_cfdi` + backfill, `proyecto_pagos.cuenta_value`); escribir `cuenta_value` desde los diálogos; enriquecer la lectura de ingresos con Empresa/Marca/Método; columnas + filtros en la tabla; `validarCobro()` con avisos en ambos diálogos.
- **F2 — Facturación:** tabla `facturas` + `proyecto_pagos.factura_id`; panel "Registrar Factura" reutilizable; bandera Factura en la tabla; estado "No se facturará"; tarjetas móviles.

---

## 8. Riesgos vivos (del pressure-test — vigilar)
1. **Abandono de la captura manual** (la causa de muerte #1 del abogado): la factura se emite fuera de la app. Mitigación: un solo flujo de captura, estado "No se facturará" para cerrar pendientes, y bandera que distingue pendiente / no aplica / facturado. La carga de XML (futuro) reduce el trabajo manual.
2. **Conciliación monto facturado vs cobrado vs total de cotización:** con anticipos/parciales no cuadra al centavo. F2 debe reconciliar contra lo **cobrado**, no contra el total de la cotización.
3. **Dato histórico de método** no clasificable en facturable: se conserva como `facturable: null`, no se inventa.
4. **Doble conteo de facturas:** un cobro tiene a lo más un `factura_id`; el panel debe impedir ligar dos veces el mismo cobro.

---

## 9. Notas de implementación (entorno)
- Build/despliegue **manual**: `npm run build` → commit de `dist/` (incluyendo `dist/index.html`) → push a `origin/main` → subir a Hostinger.
- Migraciones **manuales**: el usuario pega el SQL en el SQL Editor de Supabase (el harness bloquea `apply_migration` a prod).
- RLS por módulo vía `tiene_permiso('finanzas', accion)`; funciones nuevas con `SET search_path = pg_catalog`.
