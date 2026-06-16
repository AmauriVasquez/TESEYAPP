# Diseño: Entregas desde Clientes + Tabla de cotizaciones enriquecida

Fecha: 2026-06-16
Estado: Aprobado para planeación
Autor: Amauri + Claude

## Resumen

Dentro del modal `ClienteDetalle` (perfil de cliente) agregamos:

1. **Botón "Entregas"** que abre el flujo de entrega masiva ya existente, acotado a
   los proyectos elegibles del cliente. Las entregas se realizan **mayoritariamente
   desde móvil**, así que la experiencia móvil es el criterio principal de éxito (sin
   sacrificar la web).
2. **Tabla de cotizaciones enriquecida**: folio de cotización y folio de proyecto como
   hipervínculos; y cuando la cotización está **Aprobada**, mostrar en la misma fila el
   **estatus del proyecto** y el **estatus de pago**.

Todo vive dentro del módulo de Clientes. Reutiliza componentes y RPC ya vivos
(`EntregaMasivaModal`, `registrar_entrega_masiva`).

## Contexto de datos (verificado en BD y código)

| Concepto | Fuente |
|---|---|
| Cotizaciones del cliente | `cotizaciones` con `cliente_id=X`, `es_ultima_version=true` |
| Estatus cotización | `cotizaciones.estatus` ∈ {Borrador, Aprobada, Rechazada, Historial} |
| Proyecto de una cotización | `proyectos.cotizacion_id = cotizaciones.id` (respaldo: familia de folio `cotizacion_folio`) |
| Estatus proyecto | `proyectos.estatus` ∈ {Por Iniciar, Solicitud de Materiales, Terminado, Entregado} |
| Estatus de pago | **Derivado**: `Σ proyecto_pagos.monto` vs `total` (no existe columna) |
| Entrega masiva | Componente `EntregaMasivaModal` + RPC `registrar_entrega_masiva` (ya vivos) |
| Ruta proyecto | `/proyectos/:id` |
| Abrir cotización | `navigate('/cotizaciones', { state: { openCotizacionId } })` |

Decisiones tomadas:
- Datos de la tabla vía **RPC nueva** (1 round-trip) en lugar de varias queries en JS.
- Clic en folio **navega y cierra** el modal (navegación SPA estándar).
- Estatus de pago derivado de pagos vs `total` de la cotización.
- Móvil es el medio principal de las entregas; la tabla y los toques deben ser cómodos
  en pantallas ~390px y funcionar igual de bien en escritorio.

---

## Parte 1 — Botón "Entregas" en el perfil de cliente

### UI
- Botón "Entregas" en el header del modal, junto a "Editar". Icono `PackageCheck`.
- En **móvil**: el botón ocupa ancho cómodo y altura táctil (mín. 44px); junto a Editar
  se apilan o quedan en una fila con `gap` adecuado.
- Al pulsar, se abre `EntregaMasivaModal` (que ya tiene paridad móvil por pasos) con los
  **proyectos elegibles del cliente**.
- Si el cliente no tiene proyectos elegibles, el botón se **deshabilita** con tooltip
  "Sin proyectos por entregar".

### Elegibilidad de proyectos (igual que en la página Proyectos)
Un proyecto es elegible si: `cotizacion_id` no es nulo **y** `estatus <> 'Entregado'`.

### Datos
- Al abrir el modal del cliente (o al pulsar Entregas), se cargan los proyectos del
  cliente: `select id, folio, descripcion, cotizacion_id, estatus from proyectos
  where cliente_id = X`. Se filtran los elegibles y se pasan como prop `proyectos` a
  `EntregaMasivaModal` con la forma `{ id, folio, descripcion, cotizacion_id }`.
- `EntregaMasivaModal` ya carga el pendiente por proyecto vía `get_items_con_pendiente`
  y permite completa/parcial por proyecto; no se modifica su lógica interna.

### Tras guardar
- `onSuccess`: cerrar el modal de entregas, **refrescar** la tabla de cotizaciones y los
  KPIs (`get_cliente_resumen`) del cliente. Toast de éxito (lo emite el modal).

### Riesgos (abogado) y mitigación
- **Sin proyectos elegibles** → botón deshabilitado con tooltip.
- **Proyecto sin partidas pendientes** → `EntregaMasivaModal` ya muestra "Sin partidas
  pendientes" por proyecto; el guardado valida que haya al menos una cantidad > 0.
- **Doble fuente de verdad de elegibilidad** → reutilizar exactamente la regla de la
  página Proyectos para no divergir.

### Criterios de aceptación
- En **móvil**: abrir un cliente con proyectos pendientes, pulsar "Entregas", entregar
  uno completo y otro parcial con una sola firma/foto; al cerrar, la tabla y los KPIs
  reflejan el cambio.
- En **web**: mismo flujo, layout cómodo.
- Cliente sin proyectos elegibles → botón deshabilitado, sin errores.

---

## Parte 2 — Tabla de cotizaciones enriquecida

### RPC nueva `get_cliente_cotizaciones_detalle(p_cliente_id integer)`
Devuelve, por cada cotización última versión del cliente:
```
id integer, folio text, descripcion text, fecha date, total numeric, estatus text,
proyecto_id integer, proyecto_folio text, proyecto_estatus text,
pagado numeric, pago_estatus text
```
Lógica:
- Base: `cotizaciones` con `cliente_id = p`, `es_ultima_version = true`, orden por fecha desc.
- Proyecto emparejado por `pr.cotizacion_id = c.id`; **respaldo** por familia de folio:
  `regexp_replace(pr.cotizacion_folio, '-V[0-9]+$', '') = regexp_replace(c.folio, '-V[0-9]+$', '')`.
  Se toma un solo proyecto por cotización (el de menor `id` si hubiera varios).
- `pagado` = `Σ proyecto_pagos.monto` del proyecto emparejado (0 si no hay proyecto).
- `pago_estatus`:
  - `'Pagado'` si `total > 0 and pagado >= total`,
  - `'Parcial'` si `pagado > 0 and pagado < total`,
  - `'Pendiente'` en otro caso (incluye total=0 o sin proyecto).
- `SECURITY DEFINER`, `STABLE`, `set search_path = public`, `GRANT EXECUTE` a
  `anon, authenticated` (mismo patrón que `get_cliente_resumen`).

### Frontend — `ClienteDetalle.jsx`
- La pestaña Cotizaciones consume la nueva RPC en vez del `select` actual.
- **Folio de cotización**: enlace que hace `navigate('/cotizaciones', { state: {
  openCotizacionId: cot.id } })` y cierra el modal.
- **Folio de proyecto**: si hay `proyecto_id`, enlace que hace
  `navigate('/proyectos/' + proyecto_id)` y cierra el modal. Si no hay proyecto, "—".
- **Columna Estatus**: badge de la cotización siempre. Cuando `estatus === 'Aprobada'`,
  además, debajo, dos badges: estatus de proyecto (o "Sin proyecto") y estatus de pago
  (Pagado=verde, Parcial=ámbar, Pendiente=rojo).

### Diseño responsivo (móvil-first)
La tabla actual usa `overflow-x-auto`. Con columnas extra (proyecto + estatus apilado),
en móvil se vuelve estrecha. Solución:
- **Móvil (`< 640px`)**: render en **tarjetas apiladas** — una card por cotización con
  folio cotización (enlace) + estatus arriba, descripción, fecha y total, y —si Aprobada—
  fila con folio proyecto (enlace) + badges de proyecto y pago. Toques mín. 44px.
- **Escritorio (`>= 640px`)**: tabla con las columnas: Folio (cot.), Descripción, Fecha,
  Total, Proyecto (folio enlace), Estatus (apilado). Se reutiliza un solo componente de
  presentación que decide layout por breakpoint (patrón `useIsMobile` ya usado en el repo).

### Riesgos (abogado) y mitigación
- **Cotización Aprobada sin proyecto** → "Sin proyecto" + pago "Pendiente".
- **Versionado de folios** → respaldo por familia de folio en la RPC.
- **Pago con total 0** → "Pendiente", sin división.
- **Tabla estrecha en móvil** → layout de tarjetas en móvil.
- **Navegar pierde el cliente** → aceptado; navegación SPA, se cierra el modal.

### Criterios de aceptación
- En **móvil**: la pestaña Cotizaciones se ve como tarjetas legibles; los folios son
  tocables y navegan; en una cotización Aprobada se ven los 3 estatus (cotización,
  proyecto, pago).
- En **web**: tabla con folio proyecto enlazado y estatus apilado cuando Aprobada.
- Clic en folio cotización abre esa cotización; clic en folio proyecto abre el proyecto.
- Pago refleja correctamente Pagado/Parcial/Pendiente según los pagos registrados.

---

## Plan de implementación (alto nivel)
- **Task 1 — RPC** `get_cliente_cotizaciones_detalle` (migración; la aplico yo en BD).
- **Task 2 — Botón Entregas** en `ClienteDetalle` + montaje de `EntregaMasivaModal` +
  carga de proyectos elegibles + refresco tras guardar.
- **Task 3 — Tabla/Tarjetas enriquecidas**: consumir la RPC, hipervínculos, estatus
  apilado, layout móvil de tarjetas. Subcomponente presentacional reutilizable.
- Verificación: `npm run lint` + `npm run build` por tarea; prueba manual en viewport
  móvil (~390px) y escritorio.
- Despliegue: `npm run build`, commit `dist/`, push a `origin/main` (Hostinger).
