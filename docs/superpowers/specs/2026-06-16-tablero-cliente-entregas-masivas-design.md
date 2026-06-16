# Diseño: Tablero por cliente + Entregas masivas

Fecha: 2026-06-16
Estado: Aprobado para planeación
Autor: Amauri + Claude

## Resumen

Tres mejoras surgidas sobre la marcha. Las dos primeras se especifican aquí por
completo; la tercera queda como fase futura (solo ideación, por decisión del usuario).

1. **Tablero por cliente** — KPIs financieros dentro del modal `ClienteDetalle`.
2. **Entregas masivas** — entregar varios proyectos del mismo cliente con una sola
   confirmación (firma/foto/recibe), registrando una entrega por proyecto.
3. **Impresión de planos/diseños en un solo archivo** — fase futura, solo dirección.

Cada feature es una unidad independiente, asignable a **un agente de implementación
por feature**.

## Contexto de datos (verificado en código)

| Concepto | Fuente |
|---|---|
| Cotizado (pipeline) | `cotizaciones.total` con `cliente_id=X` y `es_ultima_version=true` (todos los estatus) |
| Autorizado | Σ del total de los **proyectos** del cliente = Σ `cotizacion.total` vía `proyectos.cotizacion_id` |
| Pagado | Σ `proyecto_pagos.monto` de los proyectos del cliente |
| Por cobrar | Autorizado − Pagado |
| Entrega vigente | `entregas` + `entregas_items` (foto, firma, `estado` activa/cancelada) |
| Pendiente por partida | RPC `get_items_con_pendiente(cotizacion_id_input)` |
| Recalcular estatus | RPC `sync_proyecto_estado_entregas(p_proyecto_id)` |

Nota: existen dos sistemas de entrega. El **vigente** es `entregas`/`entregas_items`
(usado por `EntregaModal`). El legado `proyecto_entregas` (`RegistrarEntregaDialog`)
**no** se usa para esta feature.

Decisiones del usuario:
- Autorizado/Por cobrar se basan en **proyectos**, no en cotizaciones.
- Pipeline cotizado = **todas** las cotizaciones última versión (cualquier estatus).
- Masiva: permite **parcial por proyecto**, **solo del mismo cliente**.
- Persistencia masiva: **RPC transaccional** (migración manual).
- Móvil: **soporte completo desde la v1**.

---

## Feature 1 — Tablero por cliente

### Objetivo
Mostrar, en el modal de cliente, 4 KPIs + conversión y contadores para análisis rápido.

### UI
Franja compacta de tarjetas debajo del header de `ClienteDetalle`, **visible en ambas
pestañas** (Información / Cotizaciones):

- **Cotizado** (pipeline) — etiquetado como "lo cotizado, IVA mixto".
- **Autorizado** — Σ total de proyectos del cliente.
- **Pagado** — Σ pagos.
- **Por cobrar** — Autorizado − Pagado (rojo si > 0).
- Línea secundaria: `Conversión: Autorizado/Cotizado %` · `N cotizaciones` · `M proyectos`.

Skeleton/loader mientras carga; si falla, muestra guion (—) sin romper el modal.

### Datos — RPC `get_cliente_resumen(p_cliente_id)`
Devuelve una fila:
```
cotizado numeric, autorizado numeric, pagado numeric, por_cobrar numeric,
num_cotizaciones int, num_proyectos int
```
Lógica:
- `cotizado` = Σ `cotizaciones.total` (cliente_id = p, es_ultima_version = true).
- `num_cotizaciones` = COUNT de esas cotizaciones.
- `autorizado` = Σ `c.total` de `proyectos pr JOIN cotizaciones c ON c.id = pr.cotizacion_id`
  con `pr.cliente_id = p`.
- `num_proyectos` = COUNT de proyectos con `cliente_id = p`.
- `pagado` = Σ `pg.monto` de `proyecto_pagos pg JOIN proyectos pr` con `pr.cliente_id = p`.
- `por_cobrar` = `autorizado − pagado`.

`autorizado` se ancla en `proyectos.cliente_id` (no en el cliente de la ctz) para
evitar doble conteo cuando se reasignó cliente en un pago.

### Migración (manual, SQL Editor)
- Crear función `get_cliente_resumen(p_cliente_id bigint)` `SECURITY INVOKER`,
  `STABLE`, con `GRANT EXECUTE` al rol autenticado.

### Frontend
- En `ClienteDetalle.jsx`: al abrir (o al tener `cliente.id`), llamar
  `supabase.rpc('get_cliente_resumen', { p_cliente_id: cliente.id })`.
- Nuevo subcomponente `ClienteResumenCards` (presentacional) que recibe los números.
- Reutilizar `formatMXN` ya existente en el archivo.

### Riesgos (abogado del diablo) y mitigación
- IVA mixto en cotizado → etiqueta explícita; no se presenta como subtotal.
- Clientes externos (sin `cliente_id`) no cuentan → correcto, tablero por cliente registrado.
- Doble conteo cotizado↔autorizado es intencional → se aclara con % de conversión.
- Performance: una sola RPC por apertura de modal.

### Criterios de aceptación
- Abrir un cliente con cotizaciones y proyectos muestra los 4 montos correctos.
- Un cliente sin proyectos muestra Autorizado/Pagado/Por cobrar en $0 sin error.
- Cambiar de pestaña no recalcula ni parpadea (los KPIs persisten).

---

## Feature 2 — Entregas masivas

### Objetivo
Entregar varios proyectos del **mismo cliente** en un solo acto de confirmación
(recibe/firma/foto/comentarios), permitiendo completa o parcial por proyecto, y dejando
en cada proyecto su propia entrega visible en el historial.

### Selección (página Proyectos)
- Agregar columna de checkbox en `ProyectosList` + estado de selección en `Proyectos.jsx`.
- Barra de acción flotante "Entregar seleccionados (N)" cuando hay selección.
- **Elegibilidad** de un proyecto: tiene `cotizacion_id`, no está 100% entregado
  (`estado !== 'entregado'`), y comparte `cliente_id` con el resto de la selección.
  Proyectos no elegibles se deshabilitan o se filtran al activar el modo masivo.
- Si la selección mezcla clientes, la barra indica el conflicto y bloquea la acción.

### Modal `EntregaMasivaModal`
Reutiliza la lógica por partida de `EntregaModal` (`mapEntregaItemRow`,
`get_items_con_pendiente`, modo completa/parcial, +/− y "entregar completo").

Estructura (desktop y móvil con paridad):
1. **Por cada proyecto seleccionado** (acordeón/paso): editor de cantidades por partida,
   con su propio tipo (completa/parcial). Carga `get_items_con_pendiente` por proyecto.
2. **Confirmación única** (un solo paso final): `recibe_nombre`, `comentarios`, `foto`,
   `firma`. Comentario opcional adicional por proyecto.
3. **Guardar** → llama la RPC transaccional (abajo).

Móvil: flujo por pasos análogo a `EntregaMobileFlow` — primero el set de proyectos (cada
uno con su mini-flujo de cantidades), luego foto y firma comunes.

### Persistencia — RPC `registrar_entrega_masiva(payload jsonb)`
Una transacción que recibe:
```jsonc
{
  "grupo_id": "<uuid>",
  "recibe_nombre": "...",
  "comentarios": "...",
  "firma_url": "...",       // ya subida una vez por el front
  "foto_url": "...",        // ya subida una vez por el front
  "proyectos": [
    { "proyecto_id": 1, "cotizacion_id": 9,
      "items": [ { "cotizacion_item_id": 11, "cantidad_entregada": 3 } ] }
  ]
}
```
Comportamiento dentro de la transacción, por proyecto:
1. Revalidar `pendiente` por partida (vía `get_items_con_pendiente`); si una cantidad
   excede el pendiente vivo → `RAISE EXCEPTION` (rollback total).
2. Insertar fila en `entregas` con `firma_url`/`foto_url`/`recibe_nombre`/`comentarios`
   compartidos + nueva columna `grupo_id`.
3. Insertar `entregas_items`.
4. Ejecutar la lógica equivalente a `sync_proyecto_estado_entregas` para recalcular
   `estado`/`estatus` del proyecto.

Devuelve el resumen (proyectos afectados, cuáles quedaron `entregado` vs `parcial`).
O todo se guarda o nada (atómico).

### Migraciones (manual, SQL Editor)
- `ALTER TABLE entregas ADD COLUMN grupo_id uuid NULL;` (+ índice opcional).
- Crear función `registrar_entrega_masiva(payload jsonb)` `SECURITY INVOKER`,
  con la lógica transaccional anterior y `GRANT EXECUTE` al rol autenticado.

### Frontend — flujo de guardado
1. Validar formulario (recibe, foto, firma, al menos un proyecto con cantidad > 0).
2. Subir **una** firma y **una** foto a `proyecto_archivos` (reusar `uploadEntregaImage`
   y el patrón de firma de `EntregaModal`).
3. Construir el `payload` y llamar `supabase.rpc('registrar_entrega_masiva', { payload })`.
4. Toast con el resumen; refrescar la lista de proyectos; notificación Telegram por
   proyecto que quede `Entregado` (reusar `notifyProjectFinishedOrDelivered`).

### Riesgos (abogado del diablo) y mitigación
- **Fallo parcial:** resuelto por la RPC transaccional (todo o nada).
- **Pendiente desactualizado/concurrencia:** revalidación dentro de la transacción.
- **Una sola foto para todos:** aceptado por diseño (una confirmación); comentario
  opcional por proyecto para matizar evidencia.
- **Móvil pesado:** se asume paridad completa; es la parte de mayor esfuerzo de UI.
- **Mezcla de clientes:** prohibida por la regla de elegibilidad.
- **Usar sistema correcto:** todo se construye sobre `entregas`/`entregas_items`, nunca
  sobre el legado `proyecto_entregas`.

### Criterios de aceptación
- Seleccionar 3 proyectos del mismo cliente, entregar 2 completos y 1 parcial con una
  sola firma/foto → se crean 3 `entregas` con el mismo `grupo_id`; cada proyecto muestra
  su entrega en `EntregaHistorial`.
- Si una cantidad excede el pendiente vivo de cualquier proyecto, **no** se guarda ninguno.
- Seleccionar proyectos de distinto cliente bloquea la acción con mensaje claro.
- Un proyecto cuyas partidas quedan en 0 pendiente pasa a `Entregado` y dispara la
  notificación; los parciales pasan a `parcial`.

---

## Feature 3 — Impresión de planos/diseños (fase futura, solo dirección)

No se planifica todavía (decisión del usuario: primero software, luego la ctz con plano).

Dirección de descubrimiento (cuando se retome):
1. Determinar **dónde viven** los planos/diseños (¿archivos en `proyecto_archivos`?
   ¿adjuntos por partida de cotización? ¿bitácora?).
2. Botón "Imprimir planos" en proyecto/cotización que **fusione** los archivos
   (PDF/imagen) en un solo PDF. `jspdf` ya está disponible para imágenes; para fusionar
   PDFs existentes evaluar `pdf-lib`.
3. Definir orden/portada (folio, cliente, partida) del documento combinado.

Esta fase tendrá su propio descubrimiento + spec + plan.

---

## Plan de implementación (alto nivel)

- **Agente A — Feature 1 (Tablero):** migración `get_cliente_resumen` +
  `ClienteResumenCards` + integración en `ClienteDetalle`. Bajo riesgo, entregable corto.
- **Agente B — Feature 2 (Entregas masivas):** migraciones (`grupo_id`,
  `registrar_entrega_masiva`) + selección múltiple en Proyectos + `EntregaMasivaModal`
  (desktop+móvil) + flujo de guardado. Mayor esfuerzo.
- Las migraciones se aplican **manualmente** en el SQL Editor de Supabase (el harness no
  aplica migraciones a producción).
- Tras cada feature: `npm run build`, commit del `dist`, push a `origin/main`
  (despliegue manual a Hostinger).

Cada feature recibe su propio plan detallado vía la skill `writing-plans`.
