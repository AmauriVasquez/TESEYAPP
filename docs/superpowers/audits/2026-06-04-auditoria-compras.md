# Auditoría — Módulo de Compras (Pedidos ↔ Órdenes de Compra)

Fecha: 2026-06-04
Autor: Agente (Tarea 5 del spec `2026-06-04-crm-compras-mejoras-design.md`)
Proyecto Supabase: `czbmqzimjlwwgcglubey` (PRODUCCIÓN, solo lectura desde el agente).

> NOTA: El spec referenciado vive en el commit `101d239` de otra rama (no está en `main` ni en
> este worktree). Se leyó directamente de ese commit para usarlo como contrato.

---

## 1. Mapa de piezas (qué hace cada archivo)

### Pedidos de materiales

- **`src/pages/PedidosMateriales.jsx`** — Listado de pedidos. KPIs (urgentes, estancados,
  pendientes de procesar). CRUD de pedidos vía `handleCreatePedido`/`handleUpdatePedido`/
  `handleDeletePedido`. Genera folio `PED-XXXX` leyendo el último pedido (race-condition latente,
  fuera de alcance). **`handleDeletePedido` hace DELETE físico** del pedido y sus items.
- **`src/components/pedidos/NuevoPedidoDialog.jsx`** — Form grande de alta/edición de pedido.
  Es quien dispara la generación de OC: monta `<GenerarOCModal>` (línea ~2310, OC desde pedido
  completo) y `<NuevaOCDirectaModal>` (línea ~2318, OC desde partidas preseleccionadas del pedido).
- **`EstatusPedidoBadge`, `FormatoPedido*`, `SeleccionarFormatoDialog`, `AutorizarPedidoDialog`,
  `AutorizarImpresionDialog`** — Presentación/impresión/autorización del pedido. Sin lógica de OC.

### Órdenes de compra (compras)

- **`src/components/compras/OrdenesCompraTab.jsx`** — Tab principal de OC. Lista `ordenes_compra`,
  KPIs por estatus, cambio de estatus inline (incluye "Cancelada" en el dropdown), impresión,
  ver detalle (`DetalleOCModal`), alta directa (`NuevaOCDirectaModal`). **Tiene un botón de
  Eliminar que hace DELETE físico** (`handleDelete` → `supabase.from('ordenes_compra').delete()`).
- **`src/components/compras/GenerarOCModal.jsx`** — Genera OC **desde un pedido**. Carga partidas del
  pedido (`pedidos_materiales_items`), permite seleccionar cuáles y con qué cantidad/precio. Inserta
  en `ordenes_compra` + `ordenes_compra_items` (con `pedido_item_id` y `material_id`), y luego marca
  `pedidos_materiales_items.orden_compra_id`. **No permite añadir partidas libres** (solo las del
  pedido). **No setea `proyecto_id` ni `empresa`/`proyecto_texto` en la OC.**
- **`src/components/compras/NuevaOCDirectaModal.jsx`** — Genera OC **directa** (sin pedido) o desde
  partidas preseleccionadas. Permite filas libres: elegir material del catálogo (Combobox) o escribir
  descripción/unidad/cantidad/precio a mano. Inserta items con `material_id` (si se eligió del
  catálogo), `clave`, `descripcion`, `notas`, `pedido_item_id: null`. **Captura `proyectoId`/
  `proyectoTexto`, `observaciones`, parcialidades, IVA/IEPS/retenciones en el UI pero NO los guarda**
  (el `insertBody` solo manda empresa/proveedor/solicitante/comprador/descripcion).
- **`src/components/compras/DetalleOCModal.jsx`** — Dashboard de control de una OC ya creada: resumen,
  recepción de material, facturas, pagos, validaciones, finanzas y tabla de partidas. Recalcula
  estatus automáticamente. **Solo lectura de partidas (no hay edición de la OC).**
- **`src/components/compras/ProveedoresTab.jsx`** — CRUD de proveedores (no auditado en profundidad;
  no toca el flujo pedido→OC).
- **`src/components/compras/FormatoOCImpresion.jsx` / `PlantillaImpresionOC.jsx`** — Render de
  impresión de OC (selección de marca, formatos TESEY/IIHEMSA/MSM). En uso desde `OrdenesCompraTab`.
- **`src/components/compras/ModalDetalleOC.jsx`** — **CÓDIGO MUERTO.** Modal de impresión con datos
  de ejemplo hardcodeados (`ejemploOrdenCompra`). No se importa en ningún lado (solo se referencia a
  sí mismo). Duplica la función de `FormatoOCImpresion`. Candidato a borrar.

### Paneles de OC (`src/components/oc/*`)

- **`OCResumen`** — Cabecera del dashboard (folio, proveedor, empresa, monto, badges de estatus/
  entrega). Aquí se mostraría `OC-002 v2` (ver Tarea 3).
- **`OCValidaciones`** — Toggles `validacion_admin` / `validacion_contraentrega`.
- **`OCRecepcionMaterial`** — Captura `cantidad_recibida` por partida.
- **`OCFacturas` / `OCPagos`** — CRUD de `oc_facturas` / `oc_pagos`.
- **`OCFinanzasResumen`** — Totales (facturado, pagado, saldo, impuestos).

---

## 2. Cómo se crea la OC desde el pedido (flujo real)

1. En `NuevoPedidoDialog`, con un pedido ya guardado (`pedidoGuardado.id`), el usuario abre
   `GenerarOCModal` (OC completa) o `NuevaOCDirectaModal` (partidas preseleccionadas).
2. `GenerarOCModal.handleConfirm`:
   - `insert` en `ordenes_compra` con `{empresa_id, proveedor_id, solicitante, comprador, descripcion}`.
   - Re-lee `folio`/`folio_oc` del registro creado.
   - `insert` masivo en `ordenes_compra_items` con `{orden_compra_id, descripcion, cantidad, unidad,
     precio_unitario, importe, material_id, pedido_item_id}`.
   - `update` de cada `pedidos_materiales_items.orden_compra_id = ordenCompraId`.
   - Manejo defensivo: si el insert de items falla por columna inexistente (`importe`/`pedido_item_id`),
     reintenta quitándola; si algo falla, hace **DELETE de rollback** de la OC creada.

### RPC existente (NO usada por el front)

`public.crear_oc_desde_pedido(p_proveedor_id uuid, p_pedido_id int, p_items int[])`:
- Inserta OC con `proveedor_id`, `pedido_id`, `estatus` — **pero NO `empresa_id`** (que es NOT NULL).
- Inserta items y marca `pedidos_materiales_items.orden_compra_id`.
- **Está rota / muerta**: al no enviar `empresa_id`, el trigger `generar_folio_oc()` lanzaría
  "empresa_id es obligatorio". El front la ignora y hace los inserts a mano.

---

## 3. Esquema y reglas de BD relevantes

### `ordenes_compra`
- PK `id uuid`. `empresa_id uuid NOT NULL` (FK `empresas`). `proveedor_id uuid` (FK). `pedido_id int`.
- `proyecto_id uuid` (¡tipo distinto al `pedidos_materiales.proyecto_id` que es `integer`!).
- `folio text` (lo llena el trigger). **`folio_oc text NOT NULL`, UNIQUE, SIN default.**
- Muchas columnas de impuestos/pago que el UI captura pero el front NO guarda (`tasa_iva`,
  `monto_ieps`, `retencion_iva`, `retencion_isr`, `observaciones`, `condiciones_pago`,
  `proyecto_texto`, `descripcion_pedido`, `monto_total`, `subtotal/iva/total`...).

### `ordenes_compra_items`
- PK `id uuid`. `orden_compra_id uuid` (FK CASCADE). `descripcion text NOT NULL`.
- `material_id bigint` (catálogo `materiales.id` es `integer` → compatible). `pedido_item_id int`
  (FK `pedidos_materiales_items` ON DELETE SET NULL). `clave`, `notas`, `unidad`, `cantidad`,
  `precio_unitario`, `importe`, `cantidad_recibida`.

### Triggers en `ordenes_compra`
- **`trigger_folio_oc` (BEFORE INSERT → `generar_folio_oc`)**: incrementa `empresa_folios`,
  setea `consecutivo_empresa` y `folio` = `<PREFIJO>-OC-000001`. **NO setea `folio_oc`.**
- **`trigger_validar_oc_items` (AFTER INSERT → `validar_oc_con_items`)**: lanza excepción si no
  existe ningún `ordenes_compra_items` con ese `orden_compra_id`. Es un trigger **normal (no
  diferible)**, así que se evalúa justo después de insertar la OC, **antes** de que existan items.

### RLS
- `ordenes_compra` / `ordenes_compra_items`: SELECT/INSERT/UPDATE por `tiene_permiso('compras', …,
  'ordenes')`. **DELETE solo por `es_admin()`** (`oc_delete` / `oci_delete`).
- `es_admin()` = rol `ADMIN_MAESTRO`/`ADMIN_VISUAL`. `tiene_permiso()` resuelve overrides por usuario
  y default por rol.

---

## 4. BUGS BLOQUEANTES detectados (explican por qué `ordenes_compra` está VACÍA — 0 filas)

Hoy: `ordenes_compra` = 0, `ordenes_compra_items` = 0, `pedidos_materiales` = 76, ningún
`pedidos_materiales_items.orden_compra_id` poblado. El flujo de OC **nunca ha persistido una OC**.
Dos defectos de BD lo impiden de raíz:

1. **`folio_oc` NOT NULL sin default y el trigger no lo setea.** El front nunca envía `folio_oc`.
   Todo `INSERT INTO ordenes_compra` revienta con violación NOT NULL en `folio_oc`.
2. **`validar_oc_con_items` como AFTER INSERT no diferido.** Aun arreglando (1), el insert de la OC
   se valida antes de que existan items (el front inserta OC y luego items), lanzando
   "No se puede guardar una OC sin partidas". El patrón correcto es un **constraint trigger DEFERRED**
   (se evalúa al COMMIT) o validar al borrar/editar items, no al crear la OC.

> Ambos son de **bajo riesgo** de corregir: la tabla está vacía y no hay datos que migrar.

## 5. Otros hallazgos (no bloqueantes)

- **Cancelar vs eliminar:** Tanto `OrdenesCompraTab` (botón Eliminar → DELETE) como
  `PedidosMateriales` (`handleDeletePedido` → DELETE) borran físicamente. El spec exige
  **cancelar, no borrar** las OC. Para pedidos, "mismo principio donde corresponda".
- **`NuevaOCDirectaModal` descarta datos:** captura proyecto, observaciones, parcialidades, IVA,
  IEPS y retenciones, pero el `insertBody` no los persiste. La OC queda sin esos campos (defaults).
  (Fuera del alcance estricto de Tarea 5, pero documentado; no se modifica para no cambiar
  funcionalidad de impuestos sin pedirlo.)
- **`GenerarOCModal` no permite partidas extra** (solo partidas del pedido). El spec pide permitir
  partidas libres adicionales no ligadas al pedido.
- **`proyecto_id` incompatible de tipos** (uuid en OC vs integer en pedido). Nadie lo escribe hoy;
  el UI usa `proyecto_texto`. No se toca.
- **Código muerto:** `ModalDetalleOC.jsx` (+ `ejemploOrdenCompra`) sin importadores. La RPC
  `crear_oc_desde_pedido` rota y sin uso.
- **Sin historial de costos** por material desde OC. Sin alias de material por proveedor.
- **Edición de OC inexistente** (no hay flujo de edición → no hay versión ni razón).

---

## 6. Plan de implementación (derivado)

### Migraciones (en `supabase/migrations/`, prefijo `20260604_compras_*`, NO aplicar)

1. `20260604_compras_01_fix_oc_insert.sql`
   - `generar_folio_oc()`: además de `folio`, setear `folio_oc` con el mismo valor si viene NULL
     (idempotente, `SET search_path = pg_catalog, public`). Backfill defensivo (no hay filas).
   - Reemplazar `trigger_validar_oc_items` AFTER INSERT por un **CONSTRAINT TRIGGER DEFERRABLE
     INITIALLY DEFERRED** que valide al COMMIT. Así OC+items en la misma transacción pasan.
2. `20260604_compras_02_cancelacion_no_delete.sql`
   - Endurecer DELETE: revocar/ajustar policy para impedir borrado de OC (cancelación lógica).
     Conservador: mantener DELETE solo admin, pero documentar que el front ya no lo expone; opcional
     policy que bloquee DELETE salvo service_role. Se elige **bloquear DELETE de OC** y normalizar el
     uso de `estatus='Cancelada'`.
3. `20260604_compras_03_oc_historial.sql`
   - Tabla `ordenes_compra_historial(id, oc_id uuid FK, version int, razon text, cambios jsonb,
     snapshot jsonb, usuario_id uuid, usuario_nombre text, created_at)`. Columna
     `ordenes_compra.version int DEFAULT 1`. RLS por `tiene_permiso('compras', …, 'ordenes')`.
4. `20260604_compras_04_material_proveedor_alias.sql`
   - Tabla `material_proveedor_alias(id, material_id int FK, proveedor_id uuid FK, nombre_proveedor,
     clave_proveedor, created_at, updated_at)` con UNIQUE(material_id, proveedor_id). RLS compras.
5. `20260604_compras_05_costos_material.sql`
   - Vista `material_costos_historial` y función `get_costo_material(p_material_id)` que derivan
     costo máx/promedio/último de `ordenes_compra_items` filtrando OC no canceladas.
     `SET search_path = pg_catalog, public`.

### Front (defensivo ante ausencia de tablas)

- `GenerarOCModal`: permitir filas de partida libres (material_id/pedido_item_id null, descripción
  libre) además de las del pedido.
- `OrdenesCompraTab`: quitar DELETE; acción = Cancelar (estatus='Cancelada') con confirmación.
- `PedidosMateriales`: cambiar borrado físico por cancelación lógica del pedido (estatus='Cancelada')
  conservando la opción admin si aplica.
- Edición de OC con captura de razón → versión (`OC-XXX vN`) + registro en historial; visor de
  historial en el dashboard de la OC.
- Alias por proveedor: en el panel de OC, al elegir material del catálogo, capturar/editar el nombre
  del proveedor; upsert en `material_proveedor_alias`; mostrar alias cuando exista.
- Limpieza: borrar `ModalDetalleOC.jsx` (código muerto) si no rompe el build.

Todo el código nuevo que consulta tablas nuevas se hace **defensivo**: si la tabla no existe aún
(migración no aplicada), el componente degrada a vacío/silencioso sin romper build ni runtime básico.

---

## 7. Resultado de implementación (lo que SÍ se hizo)

### Migraciones escritas (NO aplicadas) — orden de aplicación

1. `20260604_compras_01_fix_oc_insert.sql` — `generar_folio_oc()` ahora setea `folio` y `folio_oc`;
   `validar_oc_con_items` pasa a **CONSTRAINT TRIGGER DEFERRED**. Desbloquea el alta de OC.
2. `20260604_compras_02_cancelacion_no_delete.sql` — políticas `oc_delete`/`oci_delete` → `USING (false)`
   (borrado físico solo `service_role`). Cancelar = `estatus='Cancelada'`.
3. `20260604_compras_03_oc_historial.sql` — `ordenes_compra.version` + tabla `ordenes_compra_historial`
   con RLS por `tiene_permiso('compras', …, 'ordenes')`.
4. `20260604_compras_04_material_proveedor_alias.sql` — tabla `material_proveedor_alias`
   UNIQUE(material_id, proveedor_id) + RLS + `updated_at` trigger.
5. `20260604_compras_05_costos_material.sql` — vista `material_costos_historial` + función
   `get_costo_material(int)` (alto/promedio/último; solo OC no canceladas; `ordenes_compra.fecha`).

### Front

- `OrdenesCompraTab`: botón **Cancelar** (estatus='Cancelada', gate `compras/editar`) en vez de DELETE.
- `PedidosMateriales`: `handleCancelPedido` (estatus='Cancelada') en vez de borrado físico.
- `GenerarOCModal`: sección **Partidas adicionales** libres (no ligadas al pedido) que se insertan con
  `material_id`/`pedido_item_id` null.
- `NuevaOCDirectaModal`: captura/edita **alias del material por proveedor** (`material_proveedor_alias`),
  prellenado al elegir proveedor/material; el item de OC muestra el alias cuando existe. El catálogo
  `materiales` no cambia.
- `EditarOCModal` (nuevo) + `OCResumen` (`OC-XXX vN`) + `OCHistorial` (visor) integrados en
  `DetalleOCModal`: editar OC exige **razón**, incrementa `version` y registra historial.
- `lib/comprasExtras.js`: acceso defensivo (degrada si faltan tablas nuevas).
- Limpieza: borrado de `ModalDetalleOC.jsx` (código muerto) e import `format` sin uso.

### No tocado (conservador)
- RPC `crear_oc_desde_pedido` (rota/muerta): no se borra para no alterar objetos de BD sin pedirlo;
  el front no la usa. Candidata a `DROP` futuro.
- `NuevaOCDirectaModal` sigue sin persistir impuestos/parcialidades/proyecto (comportamiento previo;
  fuera del alcance de Tarea 5).
- Cancelación de pedidos a nivel BD (RLS) no se fuerza para no romper borrado de borradores.

### Verificación
- `npm run build`: OK. `npm run lint`: sin errores NUEVOS en archivos tocados (los preexistentes
  `pedidoInfo`/exhaustive-deps en `DetalleOCModal` ya estaban en `main`).
