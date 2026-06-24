# Diseño V2 — Ingresos: tabla enriquecida, modal de pago unificado y pago multi-proyecto

- **Fecha:** 2026-06-23
- **Estado:** Aprobado (validado con council + abogado del diablo)
- **Construye sobre:** `2026-06-22-control-fiscal-facturacion-ingresos-design.md` (V1, ya en `main`)
- **Entrega en 3 fases independientes:** F1 (tabla, sin schema) → F2 (modal unificado single-proyecto) → F3 (pago multi-proyecto).

---

## 1. Objetivo

Mejorar el módulo de Ingresos sobre la base de V1: una tabla más informativa, un único diálogo de pago (sin duplicar UI entre Finanzas y Proyecto) con progreso de pago y anticipo/liquidación inteligentes, y la capacidad de registrar **un pago que abarca varios proyectos** con factura compartida.

### Decisiones tomadas con el usuario
| # | Tema | Decisión |
|---|------|----------|
| 1 | Secuencia | **Por fases**: F1 (barato/seguro) ya; F3 (multi-proyecto) al final. |
| 2 | Cascada del modal | **Eliminar**: registrar un pago NUNCA muta cotización/cliente. |
| 3 | Frecuencia multi-proyecto | **Frecuente** → se modela con entidad depósito (`grupos_pago`). |
| 4 | Base del % | Sobre el **TOTAL** (con IVA). |
| 5 | Montos sugeridos | **Siempre editables**; el % se recalcula con el monto real. |
| 6 | Cotización (link) | **Vista previa inline** (modal de solo lectura mínimo). |
| 7 | Subtotal/IVA/Total por renglón | Desglose del **pago** (derivado, no almacenado). |
| 8 | Columna % | **% actual del proyecto** (100 si liquidado). |
| 9 | Captura multi-proyecto | **Modo aparte** en el modal; solo monto por proyecto; aviso si excede saldo. |
| 10 | Factura compartida | Una factura liga cobros de varios proyectos **de la misma entidad** (bloqueo duro). |

### Principios del pressure-test (council + abogado)
- **IVA es atributo del precio, no del dinero.** El desglose Subtotal/IVA/Total por pago es **presentación derivada**, nunca columna almacenada. Válido porque hay **un solo `aplica_iva` por cotización** (sin mezcla gravado/exento).
- **El "% del proyecto" es dato del proyecto, no del pago.** En la tabla va con ancla ("Total proyecto") para que no parezca duplicado.
- **Una factura = una entidad emisora (RFC).** Factura inter-entidad (Tesey + IIHEMSA) es inválida → bloqueo duro.
- **`grupo_pago` es el "dinero que entró"** (depósito); `proyecto_pago` es su **aplicación** a un proyecto. Esto evita el parche y siembra la conciliación bancaria futura.

---

## 2. F1 — Tabla de Ingresos enriquecida (sin cambios de schema)

### 2.1 Columnas (orden exacto)
`Fecha · Empresa · Marca · Cliente · Cotización · Proyecto · Método · Subtotal · IVA · Total · Factura · % pago`

- **Empresa**: nombre completo, sin abreviar. `tesey → "Tesey"`, `iihemsa_peninsular`/`iihemsa → "IIHEMSA Peninsular"`. (Ajustar `empresaLabel` en `src/lib/facturacionDisplay.js`.)
- **Cotización**: hipervínculo → abre `CotizacionPreviewDialog` (nuevo, solo lectura) **sin salir de Finanzas**.
- **Proyecto**: solo el folio (sin descripción), hipervínculo → `ProyectoDetalle` (ruta vía `useProyectosPathPrefix`).
- **Método**: `getCuentaLabel(cuenta_value || metodo_pago)` (ya existe).
- **Subtotal / IVA / Total**: desglose del **pago** (ver 2.2).
- **Factura**: bandera de V1 (`estatusFactura`).
- **% pago**: % actual del proyecto, con ancla (ver 2.3).

### 2.2 Desglose del pago (helper derivado)
Nuevo helper en `src/lib/facturacionDisplay.js`:
```js
const round2 = (n) => Math.round(Number(n) * 100) / 100;
export function desglosePago(monto, aplicaIva) {
  const total = round2(monto || 0);
  if (!aplicaIva) return { subtotal: total, iva: 0, total };
  const subtotal = round2(total / 1.16);
  return { subtotal, iva: round2(total - subtotal), total };
}
```
- `aplicaIva` se obtiene de la cotización del proyecto (se agrega `aplica_iva` al join existente de la tabla). Si no hay cotización → tratar como sin IVA.
- Encabezado/columna IVA muestra `$0.00` cuando no aplica (no vacío).

### 2.3 Columna "% pago" + ancla "Total proyecto"
- Valor = `total_pagado_proyecto / costo_total` (0–100, clamp a 100), **100 si liquidado** (saldo ≤ $1).
- Para no hacer N consultas por fila: **vista SQL** `v_proyecto_pago_progreso`:
```sql
CREATE OR REPLACE VIEW v_proyecto_pago_progreso AS
SELECT p.id AS proyecto_id,
       p.costo_total,
       COALESCE(SUM(pp.monto), 0) AS total_pagado,
       CASE WHEN COALESCE(p.costo_total,0) > 0
            THEN LEAST(100, ROUND(COALESCE(SUM(pp.monto),0) / p.costo_total * 100, 1))
            ELSE 0 END AS pct_pagado
FROM proyectos p
LEFT JOIN proyecto_pagos pp ON pp.proyecto_id = p.id
GROUP BY p.id, p.costo_total;
```
- La tabla de Finanzas consulta esta vista una vez (por los `proyecto_id` visibles) y mapea `pct_pagado` + `costo_total` a cada renglón.
- Render: badge `65%` + texto pequeño `de $X (Total proyecto)`; una mini-barra. Mismo valor en renglones del mismo proyecto **por diseño** (es estado del proyecto), por eso se ancla al total para que no se lea como duplicado.

### 2.4 Vista previa inline de cotización (mínima)
- Nuevo `src/components/finanzas/CotizacionPreviewDialog.jsx`: recibe `cotizacionId`, hace fetch de `cotizaciones` + `cotizaciones_items`, y muestra folio, cliente, fecha, partidas (desc/cant/unidad/precio), subtotal/IVA/total y estatus. **Solo lectura.** No reusa `FormatoCotizacionTESEY` (es de impresión).

### 2.5 Móvil
Tarjetas (`sm:hidden`) con los campos nuevos; tabla `hidden sm:block`.

---

## 3. F2 — Modal de pago unificado, single-proyecto, sin cascada

### 3.1 Unificación
- Un solo componente de pago (refactor de `RegistrarPagoDialog`), usado por **ProyectoDetalle** (proyecto fijo) y por **Finanzas** (con selector de proyecto). Se **retira** el diálogo simple "Registrar Movimiento" de `Finanzas.jsx`.
- En Finanzas: primero se elige el proyecto (Combobox existente), luego el mismo modal rico.

### 3.2 Eliminar la cascada (cambio de comportamiento vs V1)
- El modal de pago **ya no** edita cliente ni IVA del proyecto/cotización. Se **eliminan** del diálogo el Combobox de Cliente, el Switch "Aplicar IVA" mutador y el `update` en cascada a `proyectos`/`cotizaciones`.
- El IVA se **muestra** (read-only) tomado de la cotización. Cambiar cliente/IVA queda solo en aprobación/edición de cotización.
- Esto elimina el riesgo (abogado): que registrar un ingreso altere el total fiscal o el cliente del proyecto.

### 3.3 Receptora visible (read-only)
Bloque informativo: **Empresa del proyecto** (`empresaLabel(branding)`) y **Entidad de la cuenta** elegida (`tesey`/`ipe`/`ambas`/efectivo). Si no coinciden, el aviso de `validarCobro` (V1) ya lo señala.

### 3.4 Barra de progreso de pago (en vivo)
Dentro del modal, estilo comprobante: **% pagado · Pagado · Saldo**, recalculado en vivo con el monto tecleado:
- `pagadoActual` = suma de pagos del proyecto (excluyendo el pago en edición).
- `pagadoProyectado` = `pagadoActual + montoTecleado`.
- `% = clamp(pagadoProyectado / costo_total)`, `saldo = costo_total - pagadoProyectado`.

### 3.5 Anticipo / Liquidación inteligentes
- **Anticipo**: campo `%` (sobre el TOTAL). Al teclear %, `monto = round2(% * costo_total)`. El monto es **editable**; si lo editas, el % se recalcula desde el monto. (Quick-chips opcionales 25/50/100.)
- **Liquidación**: `monto = saldo pendiente` (sugerido), **editable**. Si el monto final ≠ saldo → aviso "no cierra el saldo" (no bloquea).
- Editable **solo al crear** (no recalcular cobros ya guardados).

### 3.6 Sección "Ya facturado" (desplegable)
- Switch "Este pago ya está facturado" → abre `Folio *`, `Fecha *`, `Emisora` (default branding del proyecto, editable).
- Al guardar el pago: se crea el cobro y, si el switch está activo, se llama `registrarFactura` ligando ese cobro (reusa `facturasService` de V1, con validación de folio único global).

---

## 4. F3 — Pago multi-proyecto (entidad depósito + factura compartida)

### 4.1 Migración (aditiva)
```sql
CREATE TABLE IF NOT EXISTS grupos_pago (
  id                 serial PRIMARY KEY,
  fecha              date NOT NULL,
  cuenta_value       text,
  referencia_bancaria text NULL,           -- semilla de conciliación futura (V3)
  monto_total        numeric NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE proyecto_pagos
  ADD COLUMN IF NOT EXISTS grupo_pago_id integer NULL REFERENCES grupos_pago(id) ON DELETE SET NULL;
ALTER TABLE facturas ALTER COLUMN proyecto_id DROP NOT NULL;  -- factura puede abarcar varios proyectos

ALTER TABLE grupos_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY gp_select ON grupos_pago FOR SELECT USING (tiene_permiso('finanzas','ver'));
CREATE POLICY gp_insert ON grupos_pago FOR INSERT WITH CHECK (tiene_permiso('finanzas','crear'));
CREATE POLICY gp_update ON grupos_pago FOR UPDATE USING (tiene_permiso('finanzas','editar'));
```
- `grupos_pago` = "el dinero que entró" (un depósito). `proyecto_pagos.grupo_pago_id` lo liga. Pagos single-proyecto pueden dejar `grupo_pago_id` NULL (o crear su propio grupo; el MVP lo deja NULL para single).

### 4.2 Modo "Varios proyectos" (paso aparte en el modal)
- Un modo distinto (no un switch enterrado en el formulario single): UI de **asignación** = lista de proyectos + monto por cada uno; `total = suma`; comparten `fecha`, `cuenta`, receptora.
- Al guardar: crea **un** `grupos_pago` + **N** `proyecto_pagos` (uno por proyecto) con ese `grupo_pago_id`.
- Si el monto asignado a un proyecto **excede su saldo** → aviso amarillo (no bloquea).

### 4.3 Factura compartida con bloqueo de misma entidad
- Si en el modo multi se activa "Ya facturado", **un** folio liga los cobros de **todos** los proyectos del grupo.
- **Bloqueo duro**: todos los proyectos del grupo deben mapear a la **misma entidad emisora** (`brandingToEntidad`). Si hay mezcla Tesey/IIHEMSA → error, no se permite la factura compartida (CFDI = un RFC).
- `facturasService.registrarFactura` valida que los `cobroIds` pertenezcan a proyectos de una sola entidad antes de insertar.
- La relación factura↔proyectos se **deriva** de los cobros ligados (`proyecto_pagos.factura_id` + `proyecto_id`); no se introduce tabla puente redundante. `facturas.proyecto_id` queda nullable (se usa solo para el caso single como denormalización opcional).

### 4.4 Editar/borrar dentro de un grupo
- Borrar un cobro del grupo elimina solo esa aplicación; si el grupo queda vacío, se borra el `grupos_pago`. El total del grupo no se "auto-corrige" silenciosamente: se muestra el desajuste si los renglones ya no suman el `monto_total` (aviso).

---

## 5. Fuera de alcance (YAGNI / cortes del pressure-test)
- Conciliación bancaria y reportes de IVA por entidad (solo se **siembra** `referencia_bancaria`).
- Reusar el formato de impresión para la preview (se hace una vista mínima propia).
- Editar el % de cobros ya guardados (solo al crear).
- Desglose de IVA por partida (el modelo tiene un solo `aplica_iva` por cotización).
- Tabla puente `factura_proyectos` (la relación se deriva de los cobros).

---

## 6. Riesgos vivos (vigilar)
1. **V1 sin uso real aún** (abogado): F1 es seguro de enviar ya; F2/F3 conviene validarlos contra el uso real de V1 antes de pulir.
2. **Modal con varios modos**: mantener multi-proyecto como modo separado evita el "monstruo"; cada modo con su validación.
3. **% por vista SQL**: confirmar performance con ~200+ filas (la vista agrega una vez, no por fila).
4. **Factura inter-entidad**: el bloqueo de misma entidad es obligatorio, con prueba explícita.
5. **`facturas.proyecto_id` nullable**: revisar lecturas que asumían NOT NULL (V1: `RegistrarFacturaDialog`, `facturasService`).

---

## 7. Notas de entorno
- Build/despliegue manual (build → commit `dist/` → push → Hostinger). Migraciones: el agente las aplica vía MCP (aditivas) o el usuario las pega; documentar el SQL en `supabase/migrations/`.
- Funciones/vistas nuevas: `SET search_path = pg_catalog` donde aplique; RLS por `tiene_permiso('finanzas', …)`.
- Tarjetas en móvil obligatorias para listas/tablas.
