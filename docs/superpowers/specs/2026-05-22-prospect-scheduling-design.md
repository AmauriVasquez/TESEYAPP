# Prospect Interaction Scheduling — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Scope:** CRM — programación de citas futuras con prospectos

---

## Goal

Allow sales reps to schedule future interactions (visita, llamada, whatsapp) with prospects from the prospect detail panel. Scheduled interactions appear in the existing Calendar and in the Interactions tab of the prospect. When the appointment passes, the user marks it as completed, fills in the result, and optionally updates the prospect stage.

---

## Data Model

**Table: `crm_interacciones`** — extend with 2 new columns:

| Column | Type | Default | Description |
|---|---|---|---|
| `programada` | `boolean` | `false` | `true` = future scheduled appointment |
| `fecha_hora_programada` | `timestamptz` | `null` | Exact date+time of the appointment |

Existing columns used:
- `tipo` — visita / llamada / whatsapp (only these 3 for scheduled interactions)
- `descripcion` — pre-appointment notes; filled with result when marked done
- `prospecto_id`, `marca_origen` — unchanged

**No new tables.** Migration adds 2 columns to existing table.

---

## Components

### New: `CitaForm.jsx`
Dialog to schedule a new appointment.

**Fields:**
- `tipo` — Select: Visita / Llamada / WhatsApp
- `fecha` — date input
- `hora` — time input (HH:MM)
- `descripcion` — textarea, optional pre-appointment notes

**Behavior:**
- Inserts into `crm_interacciones` with `programada = true`, `fecha_hora_programada = fecha + hora combined`
- On save: closes, triggers `onSave()` callback to refresh interactions list

### New: `MarcarRealizadaForm.jsx`
Dialog to mark a scheduled interaction as completed.

**Fields:**
- `resultado` — textarea (required) — what happened in the interaction
- `nueva_etapa` — Select (optional) — update prospect stage: nuevo / contactado / propuesta_enviada / en_negociacion / convertido / descartado
- `motivo_descarte` — textarea (shown only when `nueva_etapa === 'descartado'`)

**Behavior:**
- Updates the interaction row: `programada = false`, `descripcion = resultado`
- If `nueva_etapa` selected: updates `prospectos.etapa` (and `motivo_descarte` if discarding)
- On save: calls `onSave()` and `onRefetch()` to refresh both interactions and prospect data

### Modified: `ProspectoDetalle.jsx`
- Import and render `CitaForm`
- Import and render `MarcarRealizadaForm`
- In Interacciones tab: split list into "Pendientes" (programada=true) and "Historial" (programada=false)
- Add "📅 Programar cita" button next to "Registrar interacción"
- Each pending interaction shows: tipo icon, fecha/hora, descripción previa, and "Marcar como realizada" button

### Modified: `Calendario.jsx`
- Add query for `crm_interacciones` where `programada = true AND eliminado = false`
- Join/enrich with `prospectos.nombre` (separate query or via select with FK)
- Map to calendar events: title = `[tipo icon] nombre_prospecto`, color = purple/indigo
- `onSelectEvent`: opens `ProspectoDetalle` for the related prospect

---

## Interaction Tab Layout (ProspectoDetalle)

```
[ Interacciones tab ]

  [ 📅 Programar cita ]  [ + Registrar interacción ]

  ── PENDIENTES ──────────────────────────
  📞 Llamada · 28 mayo · 10:30 AM
  "Confirmar propuesta de precios"
  [ Marcar como realizada ]

  ── HISTORIAL ───────────────────────────
  📧 Email · 20 mayo
  "Enviamos cotización..."
```

---

## Calendar Event Display

- Color: `indigo` (distinct from blue proyectos and green cumpleaños)
- Title format: `[Tipo] — [Nombre prospecto]` e.g. "Llamada — Baku"
- Clicking event: opens `ProspectoDetalle` dialog for that prospect

---

## Duplicate Cleanup (concurrent task)

The following records are multi-email entries for the same company and will be consolidated:

| Company | Records | Action |
|---|---|---|
| Baku | 3 | Keep 1, merge emails into observaciones |
| Lot Desarrollos | 2 | Keep 1, merge |
| Constructora Proser | 2 | Keep 1, merge |
| Endor | 2 | Keep 1, merge |
| SUA | 2 | Keep 1, merge |
| DESUR | 2 | Keep 1, merge |
| Buscatán | 2 | Keep 1, merge |

Strategy: keep the record with the most complete data (or first inserted), copy additional emails to `observaciones` as "Contacto adicional: email", soft-delete duplicates (`eliminado = true`).

---

## Self-Review

- ✅ No placeholders or TBDs
- ✅ No contradictions — data model is consistent with component behavior
- ✅ Scope is focused — one feature (scheduling) + one cleanup task (duplicates)
- ✅ All interaction types limited to visita/llamada/whatsapp for scheduled (not email/reunion/nota_interna which are logged retroactively)
- ✅ Existing `InteraccionForm.jsx` (past interactions) is untouched
- ✅ Calendar color is distinct from existing event types
