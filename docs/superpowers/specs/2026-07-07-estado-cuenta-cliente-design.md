# DISEÑO — Estado de Cuenta por Cliente (trabajos entregados pendientes de pago)

> Documento de diseño (spec). Fecha: 2026-07-07 · Estado: **propuesta para aprobación**.
> Reusa el motor de impresión y patrones del PDF de cotización+entrega
> ([2026-07-06-reporte-entrega-cotizacion-design.md](2026-07-06-reporte-entrega-cotizacion-design.md)).
> Suposiciones verificadas contra la BD en vivo.

## Objetivo

Generar, **por cliente**, un PDF de **estado de cuenta** de los trabajos ya entregados que siguen
**pendientes de pago**. Cada línea es una **partida entregada**, con los generales de su cotización y
proyecto, los datos de la entrega y **la firma de recibido en la propia línea**. El saldo se muestra a
nivel proyecto (es donde vive el pago). El dueño genera el PDF y lo envía él mismo (WhatsApp/correo).

## Decisiones cerradas (con el usuario)

| Decisión | Elección |
|---|---|
| Monto adeudado por proyecto | **`cotizaciones.total`** (ya incluye IVA cuando aplica — verificado) |
| Alcance | Proyectos **entregados (total o parcial) con saldo > 0** = con ≥1 fila en `entregas` y saldo positivo |
| Disparador | **Botón por cliente en la página Clientes** |
| Envío | La app genera el PDF; el dueño lo envía (sin email automático) |
| Mecanismo | **Reusar `printCombined`** (ventana de impresión + gate de imágenes), no jspdf |

## Hechos verificados en vivo

- `cotizaciones.total` es el adeudo final: ratio total/subtotal = **1.16 con `aplica_iva=true`** y **1.00
  con false**. No hay que recalcular IVA; se usa `total` directo.
- Modelo de cobro: `proyecto_pagos(proyecto_id, monto, fecha_pago, ...)`. Pagado = `SUM(monto)` por
  proyecto. **El pago es por proyecto, no por partida** → el saldo va en el subtotal del proyecto, nunca
  por línea (mostrar saldo por partida sería una cifra inventada).
- Grano de línea disponible: `entregas_items(cotizacion_item_id, cantidad_entregada)` → une a
  `cotizaciones_items(descripcion, precio_unitario)` para el importe por partida, y a
  `entregas(fecha, recibe_nombre, firma_url)` para fecha/receptor/firma. Así "firma por línea" sale directo.
- `proyectos(cliente_id, folio, descripcion, cotizacion_id, estatus, eliminado?)`. `clientes(nombre, rfc)`.
- Bucket `proyecto_archivos` público → las firmas renderizan por URL en la ventana de impresión.

## Arquitectura (reusa todo lo del reporte de entrega)

Sin dependencias nuevas, sin backend, sin tablas nuevas. Tres piezas + un botón:

### 1. Capa de datos — `src/lib/estadoCuentaData.js`
`export async function getEstadoCuentaCliente({ clienteId })` devuelve:
```
{
  cliente: { nombre, rfc },
  proyectos: [
    {
      proyecto: { id, folio, descripcion },
      cotizacion: { folio, fecha },
      total,            // cotizaciones.total (adeudo con IVA si aplica)
      pagado,           // SUM(proyecto_pagos.monto) del proyecto
      saldo,            // max(0, total - pagado)
      lineas: [         // una por entregas_items del proyecto
        { descripcion, observaciones, cantidad_entregada, precio_unitario, importe,
          entrega_fecha, recibe_nombre, firma_url }
      ]
    }
  ],
  totalAdeudo,          // suma de saldos
  sinAdeudos            // boolean: no hay proyectos que califiquen
}
```
Lógica: proyectos del cliente (no eliminados) con `cotizacion_id`; para cada uno calcular
`total`/`pagado`/`saldo`; **incluir solo** los que tienen ≥1 entrega y `saldo > 0`; armar `lineas` desde
`entregas_items` → `cotizaciones_items` (descripción/observaciones/precio) + `entregas` (fecha/receptor/firma).
Minimizar round-trips (traer pagos, entregas y entregas_items del cliente en consultas por lote e indexar en JS).

### 2. Componente de presentación — `src/components/formatos/FormatoEstadoCuenta.jsx`
Print-only, mismo branding que los demás formatos (`getBrandingConfig`, `getMarcaColores`, `getLogoByMarca`).
Estilo **limpio/poco saturado** como el reporte de entrega ya ajustado (separadores y encabezados con
línea, sin sombras/cajas). Estructura:
- **Encabezado:** logo + datos empresa + "ESTADO DE CUENTA" + cliente (nombre, RFC) + fecha de emisión.
- **Por proyecto** (bloque con `break-inside: avoid` cuando quepa; si es muy largo, se parte por filas):
  - Subencabezado: Cotización [folio · fecha] · Proyecto [folio — descripción].
  - Tabla de líneas (partidas entregadas), columnas:
    `Partida (descripción + detalle/MODELO en itálica) | Cant. entregada | Importe | Fecha entrega | Recibió | Firma`.
    La columna **Firma** es una miniatura de `firma_url` (`max-h-10`, para no inflar la altura).
  - Renglón de totales del proyecto: **Total | Pagado | Saldo** (saldo resaltado).
- **Total general:** "Adeudo total del cliente: $X".
- **Pie sobrio:** "Documento informativo de estado de cuenta. Las firmas corresponden a los acuses de
  entrega registrados digitalmente en sitio." Sin afirmaciones de validez legal.

### 3. Impresión — reusar `src/lib/printCombined.js`
`imprimirDocumentoCombinado({ bloquesHTML: [estadoCuentaHTML], titulo, cssVars })`. Un solo bloque. El
gate de imágenes (onload/onerror/timeout) ya cubre las **múltiples firmas** remotas. Se genera el HTML con
`renderToStaticMarkup(<FormatoEstadoCuenta datos={...} />)` y se extrae `.estado-cuenta-root` con DOMParser
(mismo patrón que el reporte de entrega).

### 4. Disparador (UI)
Botón **"Estado de cuenta (PDF)"** por cliente en la página **Clientes** (fila/detalle del cliente).
Handler análogo a `handleImprimirCotizacionEntrega`: carga datos, si `sinAdeudos` → toast informativo,
si no → imprime. Estado `imprimiendoEstadoCuenta` para deshabilitar el botón.

## Riesgos y mitigaciones

| Riesgo | Estado | Mitigación |
|---|---|---|
| Saldo no existe por partida (pago es por proyecto) | **Real** | Saldo solo a nivel proyecto; por línea se muestra importe, no saldo |
| Muchas firmas remotas → lento/pesado | **Real** | Gate de imágenes ya lo cubre; firma en miniatura (`max-h-10`); si un cliente tiene decenas de partidas, se acepta el peso (documento de cobranza puntual) |
| Proyecto sin cotización vinculada | **Real** | Se excluye (no hay `total` confiable); adeudo se basa en `cotizaciones.total` |
| Pagos que exceden el total (anticipos/ajustes) | **Menor** | `saldo = max(0, total - pagado)`; los de saldo 0 no aparecen |
| Cotización versionada: ¿qué total? | **Menor** | Se usa la cotización vinculada al proyecto (`proyecto.cotizacion_id`), consistente con el resto del sistema |

## Criterio de aceptación (v1)

- Un cliente con 2+ proyectos entregados y saldo pendiente genera un PDF con un bloque por proyecto, cada
  partida con su importe, fecha de entrega, receptor y **firma miniatura visible** (no en blanco).
- Total/Pagado/Saldo por proyecto correctos; "Adeudo total" = suma de saldos.
- Proyectos ya pagados (saldo 0) o sin entregas **no aparecen**.
- Si el cliente no tiene adeudos entregados → toast "sin adeudos", no PDF vacío.
- El documento se ve limpio (mismo estilo aligerado del reporte de entrega).

## Addendum — cambios del council (2026-07-07)

El council modificó el diseño. Cambios obligatorios sobre lo anterior:

1. **Adeudo = `COALESCE(monto_aprobado, total)`** (15 cotizaciones tienen `monto_aprobado` ≠ `total`;
   cobrar sobre `total` dunea un monto no pactado).
2. **Ledger de pagos por proyecto** — la confianza la genera la reconciliación, no las firmas. Bajo cada
   proyecto, listar los pagos aplicados: `fecha_pago · método · monto` (desde `proyecto_pagos`), y luego
   Total / Pagado / **Saldo**. "Pagado" nunca como número suelto.
3. **Fecha de corte** en el encabezado: "Saldos al {hoy}". Sin corte, un saldo viejo se lee como error.
4. **Etiquetado que reconcilia** — las líneas de partida son *detalle de entrega*; su `importe` es s/IVA.
   La cifra que gobierna es el **Total del proyecto (c/IVA) / Pagado / Saldo**. Mostrar por proyecto un
   "Subtotal entregado (s/IVA)" para que el parcial sea transparente y NO implicar que las líneas suman al
   Total (difieren por IVA y por partidas no entregadas).
5. **Se mantiene la firma por línea** (requisito del usuario + es la prueba que desactiva "no lo recibí").
   Se **quita la columna "Recibió"** separada: el nombre va como pie bajo la miniatura de firma (menos
   saturación). Columnas finales: `Partida (desc+modelo) | Cant. entregada | Importe (s/IVA) | Fecha entrega | Firma (+nombre)`.
6. **Anti fan-out (bug crítico):** los pagos se agregan en **consulta separada por proyecto**
   (`SUM(monto) GROUP BY proyecto_id`), nunca en un join contra las líneas (multiplicaría el pagado y el
   saldo saldría mal en silencio). Filtro `≥1 entrega AND saldo>0` se aplica en JS.
7. **Orden de construcción:** data headless verificada con `console.log` (números correctos de un cliente
   real con parciales) → componente → botón. Sin multi-cliente ni rango de fechas (YAGNI).

## Diferido (post-v1)

- **Link web por cliente** (Expansionist): vista viva y tokenizada del saldo con prueba firmada; la palanca
  real de cobro y ruta a factoraje. Reusa el mismo componente servido en web.
- Envío automático por correo.
- Estado de cuenta consolidado multi-cliente / cartera total; aging 30/60/90.
- Enlazar cada línea a su comprobante/CFDI y número de factura/PO (lo pidió el Outsider para reconciliar).
