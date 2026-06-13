# Módulo de Inventario (Almacén) — Diseño

Fecha: 2026-06-12
Estado: en revisión (council + abogado) antes de implementar.

## 1. Objetivo

Dar al almacén **control manual y auditado de existencias** de materiales/consumibles,
sin depender del control por proyecto (que resultó inviable), apoyándose en la base de
**máximos y mínimos** ya existente para disparar **pedidos de re-stock**. En concreto:

1. Registrar manualmente entradas, salidas y ajustes de existencias con historial (kardex).
2. Ver de un vistazo qué partidas están en mínimos.
3. Generar un **pedido de consumibles** seleccionando las partidas que ya están en mínimos,
   reutilizando el flujo existente de Pedidos de Materiales → Órdenes de Compra.

## 2. Contexto del sistema actual (verificado)

- Tabla `materiales` ya tiene: `existencias`, `stock_min`, `stock_max`, `unidad_compra`,
  `unidad_uso`, `factor_conversion`, `costo_compra`, `costo_unitario`, `categoria`
  (`Consumibles | Materiales | Edificio | Servicios`), `clave`, `descripcion`, `familia`.
  Hoy `existencias` es un número editable a mano desde el catálogo (`Materiales.jsx`),
  **sin rastro de quién/cuándo/por qué** cambió.
- Flujo de pedidos: `pedidos_materiales` (folio `PED-XXXX`, `fecha`, `solicitante_id`,
  `estatus`, `prioridad`, `tipo_pedido`, `proyecto_id`, `cuenta`, `observaciones`) +
  `pedidos_materiales_items` (`pedido_id`, `material_id`, `cantidad`, `unidad_id`,
  `descripcion`, `observaciones`, `precio_unitario`). El folio hoy se calcula en el cliente
  con `max+1` → **condición de carrera** conocida.
- Permisos por RLS vía `public.tiene_permiso(modulo, accion, submodulo)`. Admins
  (`ADMIN_MAESTRO`, `ADMIN_VISUAL`) siempre pasan. `materiales` usa modulo `'materiales'`;
  pedidos usan `'compras' / 'pedidos'`.
- Ruta `/almacen/inventario` ya existe con un placeholder ("módulo en preparación").
- Hoy: 182 materiales; 6 en mínimos.

## 3. Decisiones de diseño

### D1. La existencia sigue viviendo en `materiales.existencias`
No se duplica el stock en otra tabla. Así no se rompen `Materiales.jsx`, los indicadores de
stock, reportes ni nada que ya lea `existencias`. El inventario **opera sobre** ese valor.

### D2. Kardex (libro de movimientos) como fuente de la trazabilidad
Nueva tabla `inventario_movimientos`: cada entrada/salida/ajuste es un renglón inmutable.
Un **trigger** aplica el delta a `materiales.existencias` de forma atómica (con lock de fila).
Esto convierte el "control manual" en algo auditado (quién, cuándo, por qué) sin perder el
valor actual ni la edición rápida.

- `tipo`: `entrada` | `salida` | `ajuste`.
- Semántica de cantidad:
  - `entrada`: `cantidad > 0`, delta `= +cantidad`.
  - `salida`: `cantidad > 0`, delta `= -cantidad`.
  - `ajuste`: el usuario captura la **existencia real contada**; se guarda como
    `existencia_despues = conteo`, y `cantidad = conteo - existencia_antes` (puede ser ±).
    Caso típico: conteo físico.
- Guardamos `existencia_antes` y `existencia_despues` en cada renglón → kardex con saldos.
- Regla: una `salida` que dejaría existencias **negativas** se rechaza con error claro.
  Un `ajuste` puede llevar a cualquier valor `>= 0`.
- Inmutabilidad: `inventario_movimientos` no admite `UPDATE`/`DELETE` (salvo admin); las
  correcciones se hacen con un nuevo movimiento. Esto preserva la auditoría.

### D3. Máximos/mínimos: se reutilizan los existentes
`stock_min` / `stock_max` ya existen en `materiales`. Se podrán editar desde Inventario
(además del catálogo). "En mínimos" = `existencias <= stock_min` con `stock_min > 0`.

### D4. Pedido de re-stock vía RPC `SECURITY DEFINER`
Generar el pedido desde el cliente con `max+1` repetiría la carrera de folio y exigiría que
el operador de almacén tuviera permiso `compras/pedidos`. En su lugar:

- RPC `public.crear_pedido_restock(p_items jsonb, p_observaciones text)`:
  - Valida `tiene_permiso('materiales','editar')` (permiso de almacén, no de compras).
  - Genera el folio `PED-XXXX` server-side de forma atómica (sin carrera).
  - Inserta `pedidos_materiales` (`tipo_pedido='material'`, `estatus='Pendiente'`,
    `solicitante_id = auth.uid()`) + sus `pedidos_materiales_items`.
  - Devuelve el pedido creado (id, folio).
  - Cada item: `{ material_id, cantidad, observaciones? }`.

Esto desacopla permisos (almacén puede *solicitar* sin tener rol de compras), arregla la
carrera de folio para este flujo, y mantiene un único origen de verdad de pedidos.

### D5. Permisos / RLS de `inventario_movimientos` (modulo `materiales`)
- `SELECT`: `tiene_permiso('materiales','ver')`.
- `INSERT`: `tiene_permiso('materiales','editar')` y `creado_por = auth.uid()`.
- `UPDATE` / `DELETE`: sin policy ⇒ solo admins (movimientos inmutables).

Se reutiliza el modulo `materiales` para **no** tener que sembrar permisos nuevos ni
arriesgar que nadie pueda ver el módulo. Quien hoy ve/edita materiales, gestiona inventario.

## 4. Esquema nuevo (DDL)

```sql
create table public.inventario_movimientos (
  id                bigint generated always as identity primary key,
  material_id       integer not null references public.materiales(id) on delete restrict,
  tipo              text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad          numeric not null,            -- delta firmado aplicado a existencias
  existencia_antes  numeric not null,
  existencia_despues numeric not null,
  motivo            text,    -- 'recepcion','consumo','merma','conteo_fisico','correccion','devolucion','traspaso','otro'
  referencia        text,    -- texto libre (folio, nota)
  proyecto_id       integer references public.proyectos(id) on delete set null,
  observaciones     text,
  creado_por        uuid default auth.uid(),
  created_at        timestamptz not null default now()
);
```

Trigger `BEFORE INSERT` `fn_aplicar_movimiento_inventario` (`SECURITY DEFINER`,
`SET search_path = public`):
1. `SELECT existencias ... FOR UPDATE` del material (lock anti-carrera).
2. Calcula `existencia_antes`; según `tipo` calcula `existencia_despues` y normaliza
   `cantidad` (delta firmado).
3. Si `existencia_despues < 0` ⇒ `RAISE EXCEPTION` con mensaje claro.
4. `UPDATE materiales SET existencias = existencia_despues`.
5. Rellena `existencia_antes/despues` en el NEW.

Índices: `(material_id, created_at desc)` para el kardex.

## 5. UI — página `Inventario.jsx` (reemplaza el placeholder)

Encabezado con KPIs: total partidas, en mínimos, valor aprox. inventario.

- **Tabla de existencias** (default): clave, descripción, categoría, unidad de uso,
  existencias, min/max, indicador (`StockIndicator` reutilizado), estado
  (OK / Bajo / Crítico). Filtros: búsqueda, tabs por categoría (como en Materiales),
  toggle "solo en mínimos". Acciones por fila: **Registrar movimiento**, **Ver kardex**.
- **Dialog Registrar Movimiento**: material (preseleccionado), tipo (entrada/salida/ajuste),
  cantidad o conteo según tipo, motivo, referencia/proyecto opcional, observaciones.
  Guarda → `insert` en `inventario_movimientos` → refresca.
- **Drawer/Dialog Kardex**: historial de movimientos del material (fecha, tipo, cantidad,
  antes→después, motivo, usuario).
- **Generar pedido de re-stock**: botón "Pedido de consumibles (mínimos)". Abre dialog que
  precarga las partidas en mínimos (preseleccionadas), cantidad sugerida editable
  `= max(stock_max - existencias, 0)`, observaciones; al confirmar llama a
  `crear_pedido_restock`. Toast con el folio creado y enlace a Pedidos.

Componentes nuevos (archivos enfocados, < ~250 líneas c/u):
- `src/pages/Inventario.jsx` (orquestador + tabla existencias).
- `src/components/almacen/MovimientoInventarioDialog.jsx`.
- `src/components/almacen/KardexDialog.jsx`.
- `src/components/almacen/PedidoRestockDialog.jsx`.
- `src/lib/inventarioApi.js` (helpers: fetch existencias, registrar movimiento, fetch kardex,
  crear pedido restock).

## 6. Plan de pruebas (prueba funcional, cero errores)

DB (vía SQL, con datos de prueba revertidos):
- Entrada suma; salida resta; ajuste lleva al conteo; `existencia_antes/despues` correctos.
- Salida que deja negativo ⇒ error.
- `crear_pedido_restock` genera folio único y pedido + items; folios consecutivos sin choque.
- RLS: select/insert con permiso `materiales`; movimientos inmutables.

Front:
- `npm run build` sin errores ni warnings nuevos.
- Navegar a `/almacen/inventario`: tabla carga, registrar cada tipo de movimiento, ver kardex,
  generar pedido de re-stock y verlo en Pedidos.

## 8. Revisión council + abogado — cambios incorporados (v2, AUTORITATIVO)

Esta sección **supersede** lo anterior donde haya conflicto. Resume los defectos hallados
por el consejo (4 lentes) y el abogado del diablo, verificados contra el código y los datos
reales, y la solución adoptada.

### BLOQUEANTES corregidos

**B1 — `existencias` se escribe también desde el catálogo, sin auditar (kardex decorativo).**
`Materiales.jsx` manda `existencias` en el `UPDATE` en cada edición y `MaterialDialog`
permite editarlo. Mismo permiso (`materiales/editar`) que el movimiento ⇒ el kardex mentiría.
Solución:
- El **único** escritor de `materiales.existencias` es el trigger de movimientos.
- `MaterialDialog`: `existencias` pasa a **solo lectura** (con nota "se ajusta desde Inventario");
  `Materiales.jsx` **no** incluye `existencias` en el payload de `UPDATE` (sí en `INSERT` para
  alta con saldo inicial → ver B-seed).
- Guard a nivel BD: trigger `BEFORE UPDATE ON materiales` que rechaza cambios de `existencias`
  salvo cuando el flag transaccional `app.mov_inventario='1'` esté puesto (lo pone el trigger
  de movimientos justo antes de su `UPDATE` y lo limpia después).

**B2 — Conversión de unidades en el re-stock (sobre-pedido x factor).** `existencias`,
`stock_min`, `stock_max` están en **unidad_uso**; los pedidos/OC se colocan en **unidad_compra**
(`NuevoPedidoDialog` deriva `unidad_id` de `unidad_compra`). Solución: cantidad sugerida de
compra `= ceil((stock_max - existencias) / NULLIF_safe(factor_conversion))` donde
`factor_conversion` nulo/≤0 se trata como 1 (con aviso). El item del pedido se coloca en
unidad_compra. La UI muestra ambas: "Faltan N {uso} → M {compra}".

**B3 — `factor_conversion` 0/NULL y `stock_max`/`stock_min` NULL en datos reales.**
(`MAT-TUB-025` factor 0; 11 materiales con compra/min/max NULL.) Solución: en RPC y UI tratar
factor nulo/≤0 como 1; excluir del re-stock (con aviso) los materiales sin `stock_max`;
validar `cantidad_compra > 0` antes de insertar items.

**B4 — RPC `crear_pedido_restock` incompleto.** `pedidos_materiales.fecha` es NOT NULL sin
default; los items reales necesitan `unidad_id`, `descripcion`, `precio_unitario`. Solución:
el RPC setea `fecha = current_date`, `tipo_pedido='material'`, `estatus='Pendiente'`,
`prioridad='Normal'`, `solicitante_id=auth.uid()`; por item deriva `unidad_id` desde el
`unidad_compra` del material (vía `catalogo_unidades`), `descripcion` desde el material,
`precio_unitario` desde `costo_compra`, `cantidad` ya convertida a unidad_compra.

**B5 — Folio sin atomicidad/único.** Solución: función `public.siguiente_folio_pedido()`
con `pg_advisory_xact_lock` + siguiente número derivado del **sufijo numérico**
(`max(substring(folio from '\d+')::int)+1`, formato `PED-%04d`, soporta >9999) + índice
`UNIQUE` en `pedidos_materiales.folio` (sólo si no hay duplicados previos). El RPC usa esa
función; se documenta que el alta normal de pedidos debería migrar a ella (seguimiento).

**B6 — Blindaje del RPC `SECURITY DEFINER`.** Es una escalada deliberada (permite a almacén
*solicitar* pedidos). Solución: `SET search_path = public`; re-valida
`tiene_permiso('materiales','editar')`; **ignora/fuerza** columnas controladas por servidor
(`solicitante_id`, `estatus`, `tipo_pedido`, `precio_unitario` derivado); valida que cada
`material_id` exista y `cantidad>0`; `REVOKE EXECUTE ... FROM public` + `GRANT ... TO authenticated`.

**B8 — Sin blindaje de signo/valor de `cantidad`.** Solución: el trigger es la autoridad —
recomputa `cantidad` (delta firmado), `existencia_antes`, `existencia_despues` ignorando lo
que mande el cliente; `RAISE` si `entrada/salida` traen `cantidad<=0`; CHECK de tabla
`cantidad <> 0`.

### Otros cambios adoptados

- **Trigger `SECURITY INVOKER`** (no DEFINER): la atomicidad la da la transacción + `FOR UPDATE`;
  DEFINER sólo evadiría RLS de `materiales` sin necesidad.
- **`costo_unitario numeric` (nullable) en el movimiento**, default desde `materiales.costo_unitario`
  en el trigger → valuación de kardex defendible (D-council).
- **Saldo inicial (seed).** Migración: por cada material con `existencias <> 0` insertar un
  movimiento `motivo='saldo_inicial'` con `existencia_antes=0`, `existencia_despues=existencias`,
  hecho con el trigger de movimientos **deshabilitado** (no se re-aplica delta; `existencias` ya
  es correcta). Alta de material con saldo inicial: el front registra una `entrada`
  `motivo='saldo_inicial'` desde 0 (vía trigger normal). Así `Σ movimientos = existencias` desde el día 1.
- **Stock negativo (D10).** Por defecto se rechaza una `salida` que deje `<0` con mensaje claro
  ("registra primero la entrada"); el dialog ofrece un checkbox **"permitir negativo"** que pasa
  `p_permitir_negativo=true` para registrar consumos anteriores a la recepción (queda visible en
  un KPI de stock negativo). `ajuste` puede ir a cualquier valor `>=0`.
- **Predicado "en mínimos" unificado a `existencias <= stock_min`** (con `stock_min` no nulo);
  se alinea `Dashboard.jsx` (hoy usa `<`) al mismo criterio para que los conteos coincidan.
- **Inmutabilidad fuerte.** Trigger `BEFORE UPDATE OR DELETE ON inventario_movimientos` que
  `RAISE EXCEPTION` incondicional (ni siquiera admin altera el libro; las correcciones son
  movimientos nuevos).
- **`creado_por`** forzado a `auth.uid()` dentro del trigger; policy `WITH CHECK
  (tiene_permiso('materiales','editar') AND creado_por = auth.uid())`.
- **Borrado de material con movimientos.** FK `ON DELETE RESTRICT`; el front captura el error
  de FK y muestra "tiene movimientos de inventario, no se puede eliminar".
- **KPI valor inventario** = `Σ existencias * coalesce(NULLIF(costo_unitario,0), costo_compra/NULLIF(factor_conversion,0), 0)`.

### DDL final de `inventario_movimientos` (reemplaza §4)

```sql
create table public.inventario_movimientos (
  id                 bigint generated always as identity primary key,
  material_id        integer not null references public.materiales(id) on delete restrict,
  tipo               text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad           numeric not null check (cantidad <> 0),  -- delta firmado (lo fija el trigger)
  existencia_antes   numeric not null,
  existencia_despues numeric not null check (existencia_despues >= 0),
  costo_unitario     numeric,
  motivo             text,
  referencia         text,
  proyecto_id        integer references public.proyectos(id) on delete set null,
  observaciones      text,
  creado_por         uuid not null default auth.uid(),
  created_at         timestamptz not null default now()
);
create index idx_inv_mov_material_fecha on public.inventario_movimientos(material_id, created_at desc);
```

El trigger `BEFORE INSERT` recibe del cliente: `material_id, tipo, cantidad` (magnitud para
entrada/salida; **conteo** para ajuste), `motivo, referencia, proyecto_id, observaciones`, y un
parámetro de sesión opcional para permitir negativo. Calcula todo lo demás.

## 7. Fuera de alcance (YAGNI)
- Múltiples almacenes/ubicaciones.
- Costeo PEPS/promedio por capa (se usa `costo_unitario` actual del material).
- Reservas/apartados por proyecto.
- Recepción automática desde OC que sume al inventario (se puede registrar como entrada manual;
  integración automática queda para una iteración futura).
```
