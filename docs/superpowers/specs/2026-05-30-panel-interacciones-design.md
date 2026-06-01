# Panel de Interacciones + mejoras a la tabla de Prospectos

**Fecha:** 2026-05-30
**Estado:** Aprobado por el usuario ("arranca, ajustes después")

Una **cita/interacción** = fila en `crm_interacciones` con `fecha_hora_programada`.
`programada=true` → pendiente; `programada=false` → realizada. Soft delete = `eliminado=true`.
VENTAS ya tiene acceso total (RLS corregido). Permisos: sin cambios.

## Tarea A — Candado en BD (migración, la aplico yo)
Índice único parcial: máximo 1 interacción **programada** por prospecto.
```sql
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_interaccion_programada_por_prospecto
  ON public.crm_interacciones (prospecto_id)
  WHERE programada = true AND eliminado = false AND prospecto_id IS NOT NULL;
```
Se libera al **completar** (`programada=false`) o **cancelar** (`eliminado=true`).
Frontend captura el error `23505` → toast: *"Este lead ya tiene una interacción programada; complétala o cancélala primero."*

## Contrato de `CitaForm` (lo usan Tarea C y la integración)
```
<CitaForm open onOpenChange prospectoId marcaOrigen
          cita={null}   // si se pasa una fila existente → modo EDICIÓN (UPDATE) con botón Cancelar/Eliminar
          onSave />     // callback tras guardar/eliminar
```
- **Crear** (sin `cita`): INSERT (comportamiento actual). 
- **Editar** (`cita` provista): precarga tipo/fecha/hora (de `fecha_hora_programada`)/descripción; **UPDATE**; muestra botón "Cancelar cita" (soft delete `eliminado=true`).
- Manejo de candado: si el error tiene `code==='23505'`, mostrar el mensaje del candado.

## Tarea B — `CitaForm.jsx`: modo edición + eliminar
Extender el componente actual al contrato de arriba. No romper el modo crear.

## Tarea C — `InteraccionesPanel.jsx` (nuevo)
- **Calendario (react-big-calendar) + lista lateral.** Vistas Mes/Semana/Día/Agenda.
- Muestra interacciones con `fecha_hora_programada` (citas): **pendientes** (indigo) y **realizadas** (gris).
- Fetch: `crm_interacciones` con `eliminado=false`, embebe `prospecto:prospecto_id(id,nombre)`. Posición en calendario = `fecha_hora_programada` (o `fecha` si null).
- Lista lateral: interacciones del periodo/día seleccionado, ordenadas por hora, con prospecto + tipo + estado.
- Clic en una interacción → abre `CitaForm` en modo edición (editar/reagendar) que ya trae el botón Cancelar/Eliminar.
- Reusa patrones de `src/components/proyectos/CalendarView.jsx` (localizer, toolbar). No depende de proyectos.

## Tarea D — `ProspectoTabla.jsx` + `Prospectos.jsx`
**ProspectoTabla.jsx:**
- **Quitar** columna "Última interacción"; **agregar** "Próxima interacción" → muestra fecha+hora y tipo de la cita programada del prospecto, o "—".
- **Ordenamiento:** clic en cualquier encabezado ordena asc/desc (estado interno `sortKey`/`sortDir`, ícono de flecha). Aplica a todas las columnas de datos.
- **Filtros rápidos** (controles arriba de la tabla): por **etapa**, **origen/fuente** (la marca ya se filtra en la página). Combinables con el orden.
- Recibe `proximaInteraccion = { [prospecto_id]: { fecha_hora_programada, tipo } }`.

**Prospectos.jsx (integración, la hago yo):**
- 3er botón de vista **"Interacciones"** (ícono `CalendarClock`/`CalendarDays`) junto a Tabla/Kanban → renderiza `InteraccionesPanel`.
- Cambiar `fetchUltimas`→`fetchProximas`: `crm_interacciones` con `programada=true, eliminado=false, prospecto_id not null`, orden `fecha_hora_programada asc`; mapear prospecto_id → `{ fecha_hora_programada, tipo }` (la más próxima). Pasar como `proximaInteraccion`.

## Verificación
- Build OK; migración aplicada; intentar 2ª cita programada al mismo prospecto → bloqueada con mensaje claro; tabla muestra "Próxima interacción"; orden y filtros funcionan; panel muestra calendario+lista y permite editar/cancelar.
