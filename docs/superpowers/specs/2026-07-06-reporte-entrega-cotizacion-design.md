# DISEÑO — Cotización + Reporte de Entrega en un solo PDF

> Documento de diseño (spec). Fecha: 2026-07-06 · Estado: **propuesta para aprobación**.
> Validado con `abogado-del-diablo` y `llm-council`; suposiciones críticas verificadas contra la BD en vivo.

## Objetivo

Generar **un solo documento imprimible/PDF** que el dueño envía al cliente (WhatsApp/correo, a mano):

1. **Primeras hojas:** la cotización, con el formato existente `FormatoCotizacionTESEY` (sin cambios).
2. **Anexo:** un **reporte de entrega consolidado** con **todas** las entregas del proyecto (parciales + final).
   Por cada entrega: fecha, quién recibió, comentarios, foto de evidencia, firma digital, y partidas con
   **cantidad entregada (sin precios)**.
3. **Encabezado de reconciliación** en el anexo: qué se pidió vs. qué se ha entregado ("Entregado 7 de 10 —
   pendiente: 3 partidas"). Esto **no es cosmético**: es lo que convierte el anexo en un acta de fulfillment
   y evita imprimir una afirmación de completitud falsa sobre una firma real.

**Fuera de alcance (v1):** email automático, jspdf, backend, actas standalone, estado de cuenta. Ver "Diferido".

## Decisiones cerradas (con el usuario)

| Decisión | Elección |
|---|---|
| Alcance del anexo | **Consolidado**: todas las entregas del proyecto |
| Envío al cliente | La app genera el PDF; **el dueño lo envía** (sin email automático) |
| Contenido por partida en el anexo | **Solo cantidades entregadas** (los precios van en la cotización) |
| Mecanismo de PDF | **Reusar la ventana de impresión** (`window.open` + `window.print`), no jspdf |

## Hechos verificados en vivo (no asumidos)

- Bucket de Storage `proyecto_archivos` es **público** → foto/firma renderizan por URL en la ventana huérfana
  de impresión (no hace falta base64 ni signed URLs).
- Existen **dos** tablas de entregas: `proyecto_entregas` (viejo, sin ítems, nov-2025→abr-2026, 55 filas) y
  `entregas`/`entregas_items` (nuevo, itemizado, abr-2026→hoy). Son sistemas **distintos** con corte ~abril 2026.
  El reporte apunta al **sistema nuevo**; para un proyecto sin filas en `entregas` se muestra un aviso claro
  (no se omite en silencio ni se hace `union` con la tabla vieja no itemizada).
- Esquema real usado (columnas verificadas):
  - `entregas(id uuid, proyecto_id int, cotizacion_id int, fecha timestamptz, recibe_nombre, firma_url,
    foto_url, comentarios, estado, created_at)`
  - `entregas_items(id, entrega_id uuid, cotizacion_item_id int, cantidad_entregada numeric)`
  - `cotizaciones_items(id int, cotizacion_id int, descripcion, cantidad numeric, unidad, observaciones)`
  - `cotizaciones(id, folio, marca_comercial, branding, es_ultima_version, cotizacion_padre_id, …)`
- Ya existe el RPC `get_items_con_pendiente(cotizacion_id_input)` que devuelve total/entregado/pendiente por
  partida — **se reusa** para la reconciliación (no se recalcula a mano).

## Arquitectura (rungs: reusar patrón existente + feature nativa del navegador)

Sin dependencias nuevas, sin backend, sin tablas nuevas. Tres piezas:

### 1. Capa de datos — `src/lib/reporteEntregaData.js`
Una función `getDatosReporteEntrega({ proyectoId, cotizacionId })` que devuelve:
```
{
  cotizacion,                 // la cotización vinculada + items + cliente (como ya arma SeleccionarFormatoCotizacionDialog)
  entregas: [                 // desde `entregas` del proyecto, orden cronológico (fecha asc)
    { id, fecha, recibe_nombre, comentarios, foto_url, firma_url,
      items: [{ descripcion, unidad, cantidad_entregada }] }   // join entregas_items → cotizaciones_items.descripcion
  ],
  reconciliacion: {           // desde get_items_con_pendiente(cotizacionId)
    partidas: [{ descripcion, total, entregado, pendiente }],
    partidasCompletas, partidasTotales,   // "X de Y"
    hayPendiente: boolean
  }
}
```
Si `entregas` está vacío para el proyecto → la función lo indica y la UI muestra el aviso de "sin entregas en el
sistema actual" (guard, no error).

### 2. Componente de presentación — `src/components/formatos/FormatoReporteEntrega.jsx`
Renderiza **solo el anexo** (no la cotización) como HTML imprimible, con el **mismo branding/logo** que
`FormatoCotizacionTESEY` (reusa `getBrandingConfig`, `getLogoByMarca`, `getMarcaColores`). Estructura:

- **Encabezado:** logo + datos empresa, "REPORTE DE ENTREGA", folio de cotización, cliente, fecha de emisión.
- **Bloque de reconciliación (arriba, prominente):** "Entregado: X de Y partidas · Estado: COMPLETO / PARCIAL"
  + tabla corta pedido/entregado/pendiente por partida. En PARCIAL, resaltar los pendientes.
- **Por cada entrega** (bloque con `break-inside: avoid`):
  - Cabecera: "Entrega #n — [fecha y hora]" · "Recibió: [nombre]".
  - Partidas de esa entrega: descripción + cantidad entregada + unidad (**sin precios**).
  - Comentarios (si hay).
  - Fila de evidencias: **foto** (`foto_url`) y **firma** (`firma_url`) lado a lado, tamaño acotado
    (p. ej. max-h para que no desborde una página).
- **Pie legal sobrio:** "Acuse de recibido firmado digitalmente en sitio. Cada firma corresponde a la fecha y
  hora indicadas en su entrega." **Sin** "plena validez legal" ni equiparación a firma autógrafa.

### 3. Orquestador de impresión — extender el patrón existente
Hoy `FormatoCotizacionTESEY.handleBrowserPrint` abre una ventana y escribe `printContent.innerHTML`. Se
generaliza a un helper `src/lib/printCombined.js` que:
1. Abre **una** ventana.
2. Escribe `<div>cotizaciónHTML</div>` + `<div style="page-break-before: always">reporteHTML</div>` dentro del
   mismo documento (Tailwind CDN + estilos de carta, igual que hoy).
3. **Gate de imágenes (pieza crítica):** antes de `window.print()`, espera a que **todas** las `<img>` del
   documento resuelvan con `Promise.all`, donde cada imagen resuelve en `onload` **o** `onerror` **o** un
   timeout de respaldo (~3 s) — **lo que ocurra primero, siempre resuelve, nunca rechaza**. Reemplaza el
   `setTimeout(500)` fijo actual. Esto evita foto/firma en blanco y el cuelgue por una URL 404.
4. `break-inside: avoid` aplicado a cada bloque de entrega vía CSS en el `<head>` de la ventana.

### 4. Disparador (UI)
Botón **"Cotización + Reporte de entrega (PDF)"** en el detalle del proyecto (donde ya se ven las entregas).
Habilitado solo si el proyecto tiene **cotización vinculada** y **≥1 fila en `entregas`**. Reusa el patrón de
`SeleccionarFormatoCotizacionDialog` para cargar los datos de la cotización.

## Riesgos y mitigaciones (del abogado + council)

| Riesgo | Estado | Mitigación |
|---|---|---|
| Imágenes en blanco / cuelgue por `setTimeout` fijo | **Real, crítico** | Gate `Promise.all` onload/onerror/timeout; **construir y probar PRIMERO** con una URL 404 a propósito |
| Paginación: foto/firma partida entre páginas | **Real** | `break-inside: avoid` por bloque + **probar con 3–4 entregas reales** antes de dar por listo; solo migrar a jspdf si sale feo |
| Consolidado omite entregas del sistema viejo | **Real, acotado** | Apuntar a `entregas`; guard con aviso para proyectos sin filas nuevas |
| Sobre-afirmar validez legal de la firma | **Real** | Pie sobrio "acuse firmado en sitio", sin "plena validez" |
| Parcial se lee como faltante / mezcla oferta y hecho | **Real** | Bloque de reconciliación "X de Y" + estado COMPLETO/PARCIAL prominente |
| Bucket privado (imágenes 403) | **Descartado** | Verificado público en vivo |

## Criterio de aceptación (v1)

- Un proyecto con ≥2 entregas parciales genera un PDF: cotización primero, anexo después, en un archivo.
- Foto y firma de cada entrega aparecen (no en blanco), incluso con una imagen 404 en el set (esa sale rota
  pero el resto imprime y no se cuelga).
- El anexo muestra "Entregado X de Y" correcto y marca COMPLETO/PARCIAL según el pendiente real
  (`get_items_con_pendiente`).
- Ningún bloque de entrega se parte entre páginas.
- El anexo no muestra precios.

## Diferido (post-v1, no implementar ahora)

- **Acta de entrega standalone** (solo el anexo, sin cotización) — cae casi gratis si el anexo queda componible.
- **Estado de cuenta automático** (cotización aprobada vs. entregado vs. saldo) — el dataset ya existe.
- **Otros documentos** (responsiva, certificado de garantía) reusando el mismo motor de impresión componible.
- Email automático al cliente.
- Mostrar la lista de partidas **en la misma pantalla donde el cliente firma** (sube el valor probatorio real
  de la firma; es cambio en `EntregaModal`, no en el reporte).
