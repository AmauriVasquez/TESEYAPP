# Proyectos — Entrega segura: quitar "Entregado", confirmación de fase y comentarios por partida

Fecha: 2026-06-15
Estado: aprobado por el usuario (diseño)

## Problema

En el detalle de proyecto (`ProyectoDetalle.jsx`), el menú "Estatus del Proyecto" incluye la opción
**Entregado**. Si se marca por error:

- `entregasTotalesCerradas` (= `estatus === 'Entregado'`) deshabilita el botón "Registrar Entrega"
  y cierra el `EntregaModal`, así que **ya no se puede registrar la evidencia de entrega**.
- El menú de estatus se deshabilita en Terminado/Entregado, dejando el proyecto bloqueado.

Además, no hay confirmación al cambiar de fase, por lo que abundan los cambios por "error de dedo"
(86 proyectos hoy están en "Entregado" sin ninguna entrega real registrada).

En la entrega parcial, el operador ve solo la descripción de la partida; no ve las
**observaciones** de la cotización, que identifican las características de cada partida.

## Alcance (3 correcciones independientes)

### Corrección 1 — Quitar "Entregado" del menú de estatus
- Archivo: `src/config/proyectosConfig.jsx`.
- Remover `'Entregado'` de `estatusWorkflowOptions` (lista del dropdown).
- "Entregado" permanece en `ESTATUS_WORKFLOW`/`projectConstants.js` (badge, avance, colores) — solo
  deja de ser **seleccionable a mano**.
- Único camino para entregar: **Terminado → botón "Registrar Entrega" → flujo de entrega**. El sistema
  asigna "Entregado" automáticamente cuando una entrega cubre todas las partidas
  (`EntregaModal.handleSave`, lógica ya existente). No se toca esa lógica.

### Corrección 2 — Confirmación en TODO cambio de estatus
- Archivo: `src/pages/ProyectoDetalle.jsx`. Usa `src/components/ui/alert-dialog.jsx` (ya existe).
- El `onValueChange` del Select de estatus deja de llamar directo a `updateEstatus`. Pasa por un nuevo
  `requestEstatusChange(nuevo)` que:
  - Si `nuevo === proyecto.estatus`, no hace nada.
  - Guarda el valor pendiente y abre un `AlertDialog`:
    "¿Cambiar el estatus de **{actual}** a **{nuevo}**?" con Cancelar / Confirmar.
  - Al confirmar → `updateEstatus(valor)` (respeta el modal de fechas existente para "Por Iniciar").
- El botón "Marcar como Terminado" también pasa por `requestEstatusChange('Terminado')`.
- El cambio automático al crear pedido (`Planeación → Solicitud de Materiales` en `handleCreatePedido`)
  **no** muestra confirmación: sigue llamando `updateEstatus` directo (efecto secundario de una acción
  ya deliberada).
- Estado nuevo: `pendingConfirmEstatus` (string|null) + `confirmEstatusOpen` (bool). No reusar
  `pendingNuevoEstatus`, que es del modal de fechas.

### Corrección 3 — Observaciones (comentarios) por partida en entrega parcial
- RPC `get_items_con_pendiente` (SQL manual en Supabase) y `src/components/EntregaModal.jsx`.
- La RPC agrega `observaciones text` a `RETURNS TABLE` y al `SELECT`
  (`COALESCE(ci.observaciones,'')::text`). La migración ya hace `DROP FUNCTION` antes de `CREATE`, lo
  que permite cambiar la firma. Archivo: `supabase/migrations/add_entregas_estado_soft_cancel.sql`
  (actualizar) + entregar el SQL para pegar.
- `mapEntregaItemRow` expone `observaciones: row.observaciones ?? ''`.
- En entrega **parcial** únicamente, bajo la descripción de cada partida se muestra `observaciones`
  como texto auxiliar de solo lectura:
  - Desktop: en `TablaItemsEntregaDesktop`, segunda línea bajo la descripción (texto gris, pequeño).
  - Móvil: en la tarjeta del `mobileStep === 2`, bajo la descripción.
  - Si la partida no tiene observaciones, no se renderiza nada.

## Limpieza de datos (entregable aparte, NO se ejecuta automáticamente)
- 109 proyectos en "Entregado": 86 sin entrega real (`entregas` activas = 0), 23 con evidencia.
- Script SQL que lista los 86 y los regresa a "Terminado" para permitir la entrega real. El usuario lo
  revisa antes de correrlo (algunos "sin evidencia" podrían ser entregas legítimas previas al módulo).

## Operativa de despliegue
- Front (C1, C2, C3-front): `npm run build` → commit del `dist` → push a `origin/main` (Hostinger manual).
- RPC (C3-SQL) y limpieza: SQL que el usuario pega en el SQL Editor de Supabase (apply_migration a prod
  está bloqueado por el harness).

## Evaluación previa a aplicar
- Un agente por corrección (paralelo, archivos disjuntos: config / page / modal+sql).
- Revisión **abogado del diablo** (busca fallos, regresiones, casos borde) + **council** (panel
  multi-ángulo: UX, datos, riesgo de regresión). Solo se aplica cuando la evaluación queda limpia.

## Casos borde considerados
- Proyecto ya en "Entregado" (los 23 reales o los 86 pendientes de limpieza): el Select sigue
  deshabilitado (`isTerminadoOEntregado`), y "Entregado" ya no está en las opciones. `<SelectValue/>`
  muestra el valor aunque no esté en la lista; al estar deshabilitado no hay riesgo de interacción.
- Confirmación: no debe dispararse en cambios automáticos ni cuando el valor no cambia.
- Observaciones largas: truncado/!wrap razonable para no romper la tabla.
