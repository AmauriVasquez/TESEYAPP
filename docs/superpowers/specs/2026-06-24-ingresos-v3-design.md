# Diseño V3 — Ingresos: fiscalidad en el modal, cobro cliente-first, KPIs y preview de impresión

- **Fecha:** 2026-06-24
- **Estado:** Aprobado (validado con council + abogado del diablo)
- **Construye sobre:** V1 (`2026-06-22-…`) y V2 (`2026-06-23-…`), ambas en `main`.
- **Entrega en 3 fases:** F1 (seguro, KPIs + columna cotización + display/toggle en modal) → F2 (cobro cliente-first multi-select) → F3 (botón "Agregar IVA al precio", blindado).
- **Ejecución:** un solo agente individual (subagent-driven, tareas en orden).

---

## 1. Objetivo y contexto

Mejoras pedidas por el equipo tras usar el módulo: ver Cliente/Cotización en el modal de pago, decidir fiscalidad al cobrar, un flujo de cobro que arranque por cliente, totales de Subtotal/IVA del periodo, y la vista de impresión real de la cotización desde la tabla.

**El cambio sensible** (decidir IVA al pagar) reabre lo que V2 cerró por seguridad. El pressure-test lo reescribió así: **separar dos conceptos** que V1 ya tenía separados —`requiere_cfdi` (¿el cliente quiere CFDI?) vs el **precio** (`cotizaciones.aplica_iva`/`total`)— y blindar la única operación destructiva (subir el precio 16%).

### Decisiones (con el usuario)
| # | Tema | Decisión |
|---|------|----------|
| 1 | Control de fiscalidad | **Dos controles**: toggle "requiere factura" (solo `requiere_cfdi`) + acción aparte "Agregar IVA al precio (+16%)". |
| 2 | Cambio de precio +IVA | **Inline, blindado**: bloqueo si hay cobro facturado; solo si hoy sin IVA (anti-doble); confirmación antes→después; permiso; nota de registro. |
| 3 | Efecto del +IVA | Sube el total = `cotizaciones.total × 1.16`. Solo dirección "agregar" (quitar = re-cotizar, fuera de alcance). |
| 4 | Flujo Registrar Movimiento | Cliente primero → proyectos del cliente con saldo>0 (multi-select) → 1 abre modal normal, 2+ abre multi-proyecto. Se elimina el botón separado. |
| 5 | Etiqueta de proyecto | Descripción al frente: **"Descripción (COT-0246 / PRJ-0158)"**. Contador de selección "N · $X". |
| 6 | KPIs | Dos tarjetas arriba: **"Ingresos sin IVA (subtotal)"** e **"IVA del periodo"**. |
| 7 | Columna Cotización | Muestra el **folio**; clic abre `SeleccionarFormatoCotizacionDialog` (vista de impresión). |

---

## 2. F1 — Seguro: KPIs, columna cotización, display + toggle en el modal

### 2.1 KPIs Subtotal/IVA del periodo (`Finanzas.jsx`)
- Calcular sobre los ingresos del periodo ya cargados: `subtotalPeriodo = Σ desglosePago(i.monto, i.aplica_iva).subtotal`, `ivaPeriodo = Σ desglosePago(...).iva`.
- Agregar **dos tarjetas** a la grilla superior de KPIs (junto a "Cuentas por Cobrar"): **"Ingresos sin IVA (subtotal)"** y **"IVA del periodo"**. (Etiquetas explícitas para no confundir con "Ingresos del periodo".)

### 2.2 Columna Cotización = folio + vista de impresión (`Finanzas.jsx`)
- En el enriquecimiento de ingresos, traer también `cotizacion_folio` (del join de proyecto→cotización: agregar `folio` a `cotizacion:cotizacion_id(...)`… o de `proyectos.cotizacion_folio`).
- La celda muestra el **folio** (p. ej. `COT-2026-0246`) como botón; clic → abre `SeleccionarFormatoCotizacionDialog` con `cotizacionId={i.cotizacion_id}`, `modoProyecto={true}`, callbacks que navegan a `/cotizaciones` (o no-op). Reemplaza el uso del `CotizacionPreviewDialog` mínimo de V2 (el archivo puede quedar sin uso o eliminarse).
- Móvil: la tarjeta muestra el folio igual.

### 2.3 Modal de pago: mostrar Cliente y Cotización + toggle "requiere factura" (`RegistrarPagoDialog.jsx`)
- En el bloque "Estatus del Proyecto" (junto a Empresa + Cuenta receptora), agregar dos lecturas: **Cliente** (`proyecto.cliente?.nombre` / nombre que provea el caller) y **Cotización** (folio).
  - Asegurar que el caller pase `cliente`/folio: la consulta de cotización del modal ya trae datos; ampliarla a `folio`; el cliente se toma de `proyecto.cliente?.nombre` o se consulta por `cliente_id`.
- **Toggle "El cliente requiere factura"** (Switch), iniciado de `proyecto.requiere_cfdi`. Cambia un estado local; **se persiste al dar "Guardar Pago"**: si el valor difiere del original, en `doSave()` se hace `UPDATE proyectos SET requiere_cfdi = <valor> WHERE id` además de insertar el cobro. **No** toca precio. Esto cubre el 90% de "sí/no factura". (Nota: en modo edición de un pago existente también aplica el guardado del toggle.)

---

## 3. F2 — Cobro cliente-first multi-select (`Finanzas.jsx` + `PagoMultiProyectoDialog.jsx`)

### 3.1 Nuevo flujo de "Registrar Movimiento"
1. Botón "Registrar Movimiento" → abre un diálogo con **Combobox de Cliente** (de `clientes`).
2. Al elegir cliente → consultar sus **proyectos con saldo>0**:
   - `proyectos` del `cliente_id` con `folio, descripcion, cotizacion_id, cotizacion:cotizacion_id(folio)`, y su saldo desde `v_proyecto_pago_progreso` (`saldo = costo_total - total_pagado`). Filtrar `saldo > 1`.
   - Construir items: `{ proyectoId, folio, descripcion, cotFolio, saldo }`, etiqueta **"`descripcion` (COT-xxxx / PRJ-xxxx)"**.
3. Lista **multi-select** (checkboxes) con **contador**: "N proyectos · $Σsaldo".
4. **Continuar**:
   - **1** seleccionado → cargar el proyecto completo (con `cotizacion_id, costo_total, requiere_cfdi, cliente`) y abrir `RegistrarPagoDialog`.
   - **2+** → abrir `PagoMultiProyectoDialog` **precargado** con esos proyectos.
5. **Eliminar** el botón separado "Pago a varios proyectos" y su estado (`multiOpen` se reutiliza para el flujo unificado).

### 3.2 `PagoMultiProyectoDialog`: precarga
- Nuevo prop opcional `preProyectos = [{ id, folio, descripcion }]`. Si viene, inicializa las filas con esos proyectos (monto vacío, editable) en vez de una fila vacía; el botón "Agregar proyecto" sigue disponible. Si no viene, comportamiento actual.

---

## 4. F3 — Botón "Agregar IVA al precio (+16%)" (blindado)

### 4.1 Migración (aditiva) — auditoría
```sql
ALTER TABLE cotizaciones
  ADD COLUMN IF NOT EXISTS iva_aplicado_por uuid NULL,
  ADD COLUMN IF NOT EXISTS iva_aplicado_at  timestamptz NULL;
```

### 4.2 Botón en `RegistrarPagoDialog.jsx` (columna "Estatus del Proyecto")
- **Visibilidad:** solo si `can('cotizaciones','editar')` (de `usePermissions`) **y** el proyecto está **sin IVA** (`cotizacionIva.aplica_iva === false`). (Si ya aplica IVA, no se muestra — anti-doble-IVA.)
- **Bloqueo duro:** consultar si el proyecto tiene **algún cobro facturado** (`proyecto_pagos` con `factura_id IS NOT NULL` para ese `proyecto_id`). Si lo hay → botón **deshabilitado** con motivo: "No se puede cambiar el precio: ya hay un cobro facturado."
- **Confirmación (AlertDialog) antes→después:**
  - `subtotal = cotizacionIva.total` (es el subtotal porque hoy está sin IVA).
  - `iva = round2(subtotal * 0.16)`, `nuevoTotal = round2(subtotal * 1.16)`.
  - Texto: "El total del proyecto pasará de `$subtotal` a `$nuevoTotal` (+`$iva` de IVA). Esto cambia el precio acordado. ¿Confirmar?"
- **Al confirmar:**
  - `UPDATE cotizaciones SET aplica_iva = true, total = nuevoTotal, iva_aplicado_por = <user.id>, iva_aplicado_at = now() WHERE id = cotizacion_id`.
  - `UPDATE proyectos SET requiere_cfdi = true, costo_total = nuevoTotal WHERE id = proyecto_id`.
  - Toast de éxito; refrescar el modal (la barra de progreso/saldo se recalcula con el nuevo total) y disparar `onSave` del proyecto si aplica.
- **Idempotencia:** garantizada porque el botón solo existe cuando `aplica_iva = false`; tras aplicarlo desaparece. El cálculo ancla a `cotizaciones.total` (no a `costo_total`), nunca compone.
- RLS backstop: la policy de `cotizaciones`/`proyectos` (`tiene_permiso('cotizaciones'/'proyectos','editar')`) rechaza el UPDATE si el usuario no tiene permiso, aunque el front lo intentara.

---

## 5. Fuera de alcance (YAGNI / cortes del pressure-test)
- **Quitar IVA del precio** (÷1.16): no se hace inline; eso es re-cotización.
- Re-versionar la cotización automáticamente: el +IVA actualiza la cotización en sitio con auditoría, no crea versión.
- "Centro de cuenta por cliente" (aging, waterfall de depósitos, panel fiscal por entidad): visión futura del Expansionist, no ahora — pero el flujo cliente-first es su semilla.
- Editar el % de cobros ya hechos.

---

## 6. Riesgos vivos (vigilar)
1. **El +IVA sigue siendo el único write destructivo.** Guardas: solo sin-IVA, bloqueo si facturado, confirmación, permiso, idempotente. Probar los tres bloqueos explícitamente.
2. **Control interno:** quien puede subir un precio aceptado queda limitado a permiso de editar cotizaciones; la columna `iva_aplicado_por/at` deja rastro.
3. **Toggle `requiere_cfdi` (se guarda con el pago):** asegurar que no choque con el flujo "ya facturado"/bandera de la tabla (es el mismo campo).
4. **Cliente-first sin `cliente_id` en la vista:** se resuelve con join `proyectos` + `v_proyecto_pago_progreso` (no requiere vista nueva).
5. **Precarga del multi-modal:** el prop `preProyectos` debe no romper el uso actual (sin prop = comportamiento de hoy).
6. **Tercer cambio sin uso real:** F1/F2 son seguras de enviar ya; F3 conviene QA cuidadoso.

---

## 7. Notas de entorno
- Vite+React, Supabase. Deploy manual (build → commit `dist/` → push → Hostinger). Migración F3 aditiva (aplicada por el agente vía MCP o pegada). RLS por `tiene_permiso`. Móvil = tarjetas. Permisos front: `usePermissions().can(modulo, accion)`.
