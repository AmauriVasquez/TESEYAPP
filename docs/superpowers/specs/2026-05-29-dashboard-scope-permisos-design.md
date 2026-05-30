# Scope mensual del dashboard + botón de permisos de Ventas

**Fecha:** 2026-05-29
**Estado:** Aprobado por el usuario (respuestas a preguntas)

## Causa raíz (verificada con datos)

El dashboard **mensual** calculaba "Cotizaciones activas", "Conversión" y "Pipeline
monetario" sobre **todas** las cotizaciones (sin filtrar por mes), mientras el
**anual** sí filtra por año. Resultado ilógico: mensual (191 / histórico) > anual
(177 / 2026). De 191 cotizaciones, 14 son anteriores a 2026.

## Decisiones del usuario

1. **Mensual = del mes**: "Cotizaciones activas" y la tabla "Oportunidades activas"
   se filtran por `fecha` del mes (Borrador+Enviada del mes).
2. **Pipeline monetario = todas las cotizaciones del periodo, incluidas Rechazadas**
   (anual y mensual). Es "monto total cotizado", no solo pipeline activo. Se aclara
   el subtítulo.
3. **Permisos**: botón "Otorgar área de Ventas completa" en el panel de Permisos.

## Tarea A — Scope mensual (DashboardMensual.jsx + OportunidadesTabla.jsx)

- Nuevo `cotsMes = cotizaciones.filter(c => c.fecha?.startsWith(`${anio}-MM`))`.
- `activas` = `cotsMes` con estatus Borrador/Enviada.
- `pipeline` = suma de `total` de **todas** las `cotsMes` (incluye Rechazadas).
- `cotAprobadas` = `cotsMes` Aprobadas; `convCotizaciones` = aprobadas ÷ `cotsMes.length`.
- Subtítulo de Pipeline → "Todas las cotizaciones del mes".
- `OportunidadesTabla` recibe `cotsMes` (en vez de todas) → su filtro B+E queda del mes;
  el encabezado refleja el conteo del mes.
- Valores esperados (mayo 2026): activas 16 · conversión 17/33 = 52% · pipeline $474,407.

## Tarea B — Pipeline anual (DashboardAnual.jsx)

- `pipelineAnual` pasa de Borrador+Enviada+Aprobada a **suma de `total` de todas las
  `cotsAnio`** (incluye Rechazadas) → $2,902,572.
- Subtítulo → "Todas las cotizaciones del año".
- Conteo (177) y conversión (107/177 = 60%) ya correctos; sin cambio.

## Tarea C — Botón "Área de Ventas completa" (AdminUsuarios.jsx)

- En el Sheet de Permisos, botón que setea en `permState` (marcando `dirty`):
  - `clientes`: ver/crear/editar
  - `cotizaciones`: ver
  - `prospectos`: ver/crear/editar/eliminar
  - `proyectos`: ver  (necesario para datos del Dashboard/Calendario)
  - `proyectos.control_financiero`: ver  (lo exige la RLS de `proyecto_pagos`)
- Luego el usuario pulsa "Guardar cambios" (persistencia vía `admin_set_permiso`).
- **Trade-off documentado:** como los overrides por-usuario son compartidos
  front/back, otorgar `proyectos.ver` a un usuario por esta vía también le abre el
  módulo de Proyectos (solo lectura) en el menú. La vía limpia sin abrir Proyectos
  sigue siendo **asignar el rol "Ventas"** (que concede `proyectos.ver` solo a nivel
  servidor). El botón es para conceder ventas a usuarios de otro rol.

## Verificación
- Mensual ≤ anual ≤ histórico en conteos y montos (coherente).
- Build OK; regenerar `dist/`.
