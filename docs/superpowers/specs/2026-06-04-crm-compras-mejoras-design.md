# Diseño — Mejoras CRM (Prospectos/Clientes/Cotizaciones) y Auditoría de Compras

Fecha: 2026-06-04
Estado: Aprobado por el usuario (decisiones registradas vía AskUserQuestion)

## Contexto

Proyecto Tesey App (ERP/CRM interno, Vite+React, Supabase `czbmqzimjlwwgcglubey`).
Cinco áreas a mejorar, tratadas como tareas independientes. Cada tarea se implementa
en un worktree aislado por un agente; el supervisor prueba y hace merge a `main`.

Base de arranque: commit `b1238a3` en `main` (snapshot del estado actual ya commiteado).

## Decisiones de producto (confirmadas)

1. Registro huérfano "DR CANUL ANDRADE": **crear el cliente ahora** (conversión retroactiva correcta).
2. Opción "Convertido" del dropdown de Etapa: **quitarla**. La conversión solo por el botón (RPC).
3. Aprobación sin cliente: **bloqueo duro** + permitir crear/convertir cliente dentro del modal.
4. Compras: **alias por proveedor + costos automáticos**; OC se cancelan (no borran) y se editan con versión + razón.

---

## Tarea 1 — Buscador de prospectos

**Objetivo:** búsqueda por texto para no revisar la lista 1 a 1.

- Input de búsqueda en `src/pages/Prospectos.jsx`, junto a los filtros de marca.
- Estado `busqueda` que filtra `prospectos` antes de pasar a `filtrados` (memo existente).
- Campos a buscar (case-insensitive, sin acentos si es viable): `nombre`, `nombre_contacto`,
  `razon_social`, `email`, `telefono`, `folio`, `industria`, `ciudad`.
- Funciona tanto en vista Tabla como Kanban (se filtra a nivel de página).
- Sin cambios de base de datos.

**Criterio de aceptación:** escribir texto reduce la lista en ambas vistas; vacío muestra todo.

---

## Tarea 2 — Conversión de prospectos a clientes (núcleo)

**Diagnóstico:** `ProspectoDialog` permite Etapa="Convertido" con un `UPDATE` plano que NO llama
`crm_convertir_prospecto`, dejando el prospecto en `convertido` sin cliente (`cliente_id` NULL).
La RPC sí inserta en `clientes` con `fuente_origen='prospecto_convertido'`. En BD: 34 clientes,
0 convertidos; 1 prospecto huérfano (`4dda72b6-...` DR CANUL ANDRADE).

**Cambios:**

1. **Migración de datos (SQL):** convertir retroactivamente el prospecto huérfano vía la RPC
   `crm_convertir_prospecto` (o lógica equivalente idempotente) para que tenga su cliente y
   queden enlazados `cliente_id` + `convertido_en`. Idempotente: si ya existe cliente, no duplicar.
2. **Front — cerrar el agujero:** quitar la opción `convertido` del array `ETAPAS` en
   `src/components/crm/ProspectoDialog.jsx` (no se puede marcar convertido manualmente). `descartado`
   se conserva.
3. **BD — guardia (trigger):** trigger `BEFORE UPDATE` en `prospectos` que rechace (o impida) pasar a
   `etapa='convertido'` cuando `cliente_id IS NULL`. Mensaje claro. `SET search_path = pg_catalog`.
4. **Visibilidad en prospectos:** cuando un prospecto está convertido y tiene `cliente_id`, mostrar
   enlace "Ver cliente →" (en `ProspectoDetalle` y/o columna en `ProspectoTabla`) que navega a la ficha
   del cliente. El toggle "Mostrar convertidos/descartados" ya existe.
5. **Fix menor:** la RPC retorna `{ok:false, error:...}` pero `ProspectoDetalle.handleConvertir` lee
   `data?.mensaje`. Alinear (usar `error`).

**Criterio de aceptación:** convertir un prospecto crea su cliente y aparece en `/clientes`;
no es posible marcar convertido sin cliente; el huérfano queda corregido; hay enlace al cliente.

---

## Tarea 3 — Bloqueo de aprobación sin cliente real

**Objetivo:** no aprobar (ni crear proyecto) si la cotización no tiene un cliente real;
así cada venta es un cliente medible (recurrencia objetiva), no "público en general" agregado.

- En `src/components/cotizaciones/ApproveQuoteModal.jsx`: si `clienteId == null`, **deshabilitar**
  "Confirmar Aprobación" con aviso explicativo.
- Dentro del modal, ofrecer rutas para resolverlo:
  - Elegir cliente existente (combobox ya presente).
  - **Crear cliente rápido** (mínimo nombre; reutilizar lógica de `ClienteDialog` o inserción directa).
  - Si la cotización tiene `prospecto_id`, botón **"Convertir prospecto a cliente"** (RPC) que setea el
    `cliente_id` resultante.
- Guardia en capa de datos en `src/pages/Cotizaciones.jsx`: `handleConfirmApproval` /
  `handleCreateProjectFromQuote` no deben crear/actualizar proyecto sin `cliente_id`.
- Revisar `handleStatusChange(id,'Aprobada')` (rama que también crea proyecto): aplicar misma guardia
  o confirmar que está muerta.

**Criterio de aceptación:** intentar aprobar como "Cliente Externo" se bloquea; tras asignar/crear/
convertir cliente, la aprobación procede y el proyecto nace con `cliente_id`.

---

## Tarea 4 — Folio de proyecto en tabla de cotizaciones

**Objetivo:** ver junto al folio de cotización el folio del proyecto (hipervínculo) cuando está aprobada.

- En `src/pages/Cotizaciones.jsx`, tras `fetchCotizaciones`, mapear cotización→proyecto consultando
  `proyectos` por `cotizacion_id` (y/o `cotizacion_folio` para familias con versión).
- Nueva columna "Proyecto" junto a "Folio": muestra `proyecto.folio` como `<Link>` a
  `${proyectosBase}/${proyecto.id}`. Si no hay proyecto: "—".
- Cuidar `colSpan` del estado vacío (hoy 7 → 8).

**Criterio de aceptación:** una cotización aprobada muestra su folio de proyecto enlazado y navega al
proyecto correcto; las no aprobadas muestran "—".

---

## Tarea 5 — Auditoría módulo de compras (pedidos ↔ órdenes de compra)

**Objetivo:** auditar y optimizar (sin romper funcionalidad) y añadir trazabilidad de materiales/costos.

Tablas relevantes: `pedidos_materiales`(+`_items`), `ordenes_compra`(+`_items` con `material_id`,
`pedido_item_id`), `materiales`, `proveedores`, `oc_facturas`, `oc_pagos`. Hoy `ordenes_compra`
está vacía (bajo riesgo de migración).

**El agente debe primero auditar** (leer `OrdenesCompraTab`, `GenerarOCModal`, `NuevaOCDirectaModal`,
`DetalleOCModal`/`ModalDetalleOC`, `OCValidaciones`, `OCResumen`, `OCRecepcionMaterial`,
`PedidosMateriales.jsx`, `NuevoPedidoDialog`, y funciones/RPC SQL de compras) y documentar hallazgos.

**Requisitos:**

1. **Pedido → OC:** verificar que al crear OC desde un pedido se enlacen `pedido_id` y por partida
   `pedido_item_id`. Permitir además partidas extra en la OC **no ligadas** al pedido.
2. **Cancelación, no eliminación:** las OC se cancelan (`estatus='Cancelada'`), nunca DELETE.
   Verificar/forzar en front y, si aplica, política/permiso en BD.
3. **Edición con versión + razón:** editar una OC genera versión (ej. `OC-002 v2`) y registra la razón
   del cambio. Tabla nueva `ordenes_compra_historial` (oc_id, version, razon, snapshot/campos, usuario,
   fecha). Mostrar el detalle de cambios en la UI de la OC.
4. **Alias de material por proveedor:** tabla nueva `material_proveedor_alias`
   (`material_id`, `proveedor_id`, `nombre_proveedor`, `clave_proveedor`, únicos por material+proveedor).
   En el panel de OC se captura/edita el nombre que el proveedor da al material; **el catálogo
   `materiales` NO cambia ni crece**. El item de OC referencia `material_id` y muestra el alias.
5. **Historial de costos para el cotizador:** derivar por material costo **más alto**, **promedio** y
   **último** desde `ordenes_compra_items` (vista o función SQL). Sin captura manual. Exponer para uso
   futuro del cotizador.
6. **Limpieza:** eliminar código muerto/redundante detectado, sin alterar funcionalidad.

**Criterio de aceptación:** OC desde pedido enlaza partidas; se pueden añadir partidas libres; cancelar
no borra; editar crea versión con razón y queda registro; se captura alias por proveedor sin tocar el
catálogo; existe consulta de costos alto/promedio/último por material; build sin romper flujos.

---

## Orquestación e integración

- Base: `main @ b1238a3`.
- Un worktree + un agente por tarea. Paralelizables: 1, 2, 4 (independientes). Tarea 3 depende
  conceptualmente de la RPC de conversión de la Tarea 2 (la RPC ya existe, así que puede ir en paralelo,
  cuidando que no edite los mismos archivos). Tarea 5 es independiente (módulo de compras).
- Posibles solapes de archivo a vigilar: Tareas 1 y 2 tocan `src/pages/Prospectos.jsx` y componentes CRM;
  Tareas 3 y 4 tocan `src/pages/Cotizaciones.jsx`. Para esos pares, secuenciar el merge y rebasar para
  evitar conflictos (o asignar el archivo compartido a una sola tarea).
- El supervisor: corre `npm run build` por rama, revisa diffs, valida criterios de aceptación, y mergea
  a `main` una por una (rebase/merge ordenado). Migraciones SQL nuevas se aplican vía Supabase MCP
  (`apply_migration`) y se versionan en `supabase/migrations/`.
- Convención BD: funciones nuevas con `SET search_path = pg_catalog`; campos opcionales UNIQUE en NULL.

## Fuera de alcance (YAGNI)

- Rediseño del cotizador para consumir costos (solo se expone la consulta; integrarlo será otra tarea).
- Migración masiva de OC históricas (tabla vacía hoy).
- Cambios de permisos RLS más allá de lo necesario para los flujos anteriores.
