# Catálogo de productos por cliente — Diseño

## Problema

Se maquilan piezas específicas para clientes recurrentes. El cliente ya da su
propio código de referencia para cada pieza, pero internamente no hay forma de
guardarlo ni de identificar rápido "esta pieza es de este cliente" — hoy cada
cotización se arma escribiendo la descripción a mano o, si acaso, jalando del
catálogo general de servicios (`catalogo_servicios`), que no distingue cliente.

Se necesita:
1. Guardar el código del cliente + un código interno propio (iniciales de la
   empresa + consecutivo) por cada pieza, por cliente.
2. Poder cargar esas piezas directo al cotizar, con el precio que siempre se
   cobra por ellas.
3. Poder ver el historial de cotizaciones donde se ha usado cada pieza.

## Modelo de datos

### Tabla nueva: `catalogo_productos_cliente`

| columna           | tipo                          | notas                                              |
|-------------------|--------------------------------|-----------------------------------------------------|
| id                 | serial PK                     |                                                       |
| cliente_id         | integer NOT NULL              | FK → `clientes(id)` ON DELETE CASCADE                |
| codigo_cliente     | text                           | código que da el cliente (opcional)                 |
| codigo_interno     | text NOT NULL, UNIQUE          | ej. `IIH-001` — propuesto automático, editable       |
| descripcion        | text NOT NULL                  |                                                       |
| unidad             | text                           |                                                       |
| precio_unitario    | numeric(12,2)                  | precio de referencia, el que "siempre se cobra"      |
| material_id        | integer                        | FK → `materiales(id)` ON DELETE SET NULL, opcional   |
| created_at         | timestamptz DEFAULT now()      |                                                       |

RLS: mismo patrón que `catalogo_servicios` (select libre, escritura vía
`tiene_permiso('cotizaciones', 'crear'|'editar'|'eliminar')`).

### `cotizaciones_items`: columna nueva

- `producto_cliente_id integer` — FK → `catalogo_productos_cliente(id)` ON
  DELETE SET NULL, nullable. Se llena solo cuando la partida viene de este
  catálogo; permite reconstruir el historial de una pieza sin depender de que
  el catálogo siga existiendo.

## Generación del código interno

Al capturar un producto nuevo para un cliente:

1. Prefijo = primeras 3 letras (solo alfabéticas, mayúsculas) de
   `razón_social` del cliente, o de `nombre` si no hay razón social.
2. Consecutivo = `count(productos existentes de ese cliente) + 1`, en 3
   dígitos (`001`, `002`, ...).
3. Se muestra `PREFIJO-NNN` precargado y editable en el formulario antes de
   guardar.
4. Si al guardar el código ya existe (violación del UNIQUE), se muestra el
   mismo mensaje de "código duplicado" que ya usa `CatalogoServicios.jsx`.

## UI

### Pantalla de catálogo (`CatalogoServicios.jsx`)

Se agrega una tercera pestaña **"Productos por Cliente"** junto a "Listado de
Servicios" y "Configuración de Unidades":

- Selector de cliente arriba.
- Tabla de sus productos: Código Interno, Código Cliente, Descripción,
  Unidad, Precio, Material, Acciones (editar / eliminar / **ver historial**).
- "Ver historial" abre un modal simple con las cotizaciones donde se ha usado
  esa pieza (folio, fecha, proyecto, cantidad, precio cobrado, estatus),
  vía `cotizaciones_items.producto_cliente_id`.

### Modal de cotización (`CotizacionDialog.jsx`)

- Si la cotización tiene `cliente_id`, el buscador "Cargar del Catálogo"
  muestra primero los productos de ese cliente, y debajo el catálogo general
  de servicios (secciones separadas en el mismo combo).
- Si es cliente externo (sin `cliente_id`), la sección de productos del
  cliente no aparece — el buscador funciona como hoy, solo catálogo general.
- Al elegir una pieza del catálogo del cliente: se precarga
  descripción/unidad/precio en el formulario de partida (igual que hoy con
  catálogo de servicios) y **el precio queda editable**, no bloqueado.
- Si el precio capturado difiere del guardado en el catálogo, se muestra un
  aviso no bloqueante (ej. "precio distinto al catálogo: $X.XX") para evitar
  cobrar diferente sin querer.
- Al guardar la partida, se guarda `producto_cliente_id` en
  `cotizaciones_items` para trazabilidad.

## Fuera de alcance (v1)

- Clientes externos (sin registro en `Clientes`) no tienen catálogo de
  productos.
- No hay versionado de precio histórico más allá de lo que ya queda
  registrado en cada `cotizaciones_items` (cada partida guarda el precio que
  se cobró ese día).
- No se agregan campos de tolerancias/acabado; solo material (vía
  `material_id`, que ya implica calibre en su descripción).
