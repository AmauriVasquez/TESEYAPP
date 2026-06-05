# Diseño: Edición de prospectos, cambio rápido de etapa e historial de cotizaciones

**Fecha:** 2026-06-05  
**Estado:** Aprobado

---

## Problema

1. El módulo Prospectos no tiene botón de edición accesible desde el panel de detalle. `ProspectoDialog` soporta edición con la prop `prospectoEditar`, pero nunca se activa con un prospecto real: `prospectoEditar` siempre es `null` excepto al crear.
2. No hay forma de cambiar la etapa de un prospecto sin abrir el formulario completo (que tampoco está cableado).
3. `ClientePreviewDialog` es de solo lectura y no muestra el historial de cotizaciones vinculadas.
4. `ProspectoDetalle` tampoco muestra las cotizaciones generadas para ese prospecto.

---

## Decisiones de diseño

| Pregunta | Decisión |
|---|---|
| ¿Cuántas etapas? | Mantener las 5 actuales: nuevo, contactado, propuesta_enviada, en_negociacion, descartado. "Convertido" solo via RPC. |
| ¿Cómo cambiar etapa? | Dropdown inline en el badge de etapa + confirmación AlertDialog antes de guardar |
| ¿Motivo al descartar? | Sí — mini-modal con campo de texto opcional antes de confirmar |
| ¿Edición completa? | Botón ✏️ Editar en el header del detalle → abre ProspectoDialog existente |
| ¿Cotizaciones en prospectos? | Tab "Cotizaciones" (3er tab) en ProspectoDetalle |
| ¿Vista de clientes? | Nuevo ClienteDetalle con tabs Información + Cotizaciones, reemplaza ClientePreviewDialog |
| ¿Qué versiones de cotizaciones mostrar? | Solo `es_ultima_version = true`, ordenadas por `fecha DESC` |
| ¿Migración de BD? | Ninguna — `prospecto_id`, `cliente_id`, `motivo_descarte` ya existen |

---

## Módulo 1 — Edición de prospectos (`ProspectoDetalle` + `Prospectos.jsx`)

### 1a. Botón ✏️ Editar

- Ubicación: header del diálogo, a la derecha del nombre del prospecto
- Visible siempre (incluye convertidos/descartados — pueden necesitar correcciones de datos)
- Comportamiento: llama `onEdit(prospecto)` → en `Prospectos.jsx` setea `prospectoEditar = p` y `dialogOpen = true`
- No se cierra el diálogo de detalle al hacer clic en Editar; el formulario de edición se abre encima como diálogo independiente

### 1b. Cambio rápido de etapa (inline)

- La pastilla de etapa en el header se convierte en `<button>` con flecha ▼
- Click → dropdown (popover) con las 5 etapas manuales en orden de pipeline:
  1. Nuevo
  2. Contactado
  3. Propuesta enviada
  4. En negociación
  5. `───` (separador)
  6. Descartar…
- La etapa actual aparece marcada con ✓ y no es clickable de nuevo
- Seleccionar etapa (≠ Descartar) → `AlertDialog`: *"¿Cambiar etapa a [X]?"* → Cancelar / Confirmar
- Seleccionar "Descartar…" → mini-modal con `<Textarea>` para motivo (campo opcional) → Cancelar / Descartar
- Al confirmar → `supabase.from('prospectos').update({ etapa, motivo_descarte }).eq('id', prospecto.id)`
- Éxito → `onRefetch()` + toast de confirmación + cierra dropdown
- "Convertido" nunca aparece en el dropdown (integridad: solo via `crm_convertir_prospecto`)
- **Para prospectos con `etapa = 'convertido'`**: el badge de etapa NO es clickable — convertido es irreversible desde la UI (cambiar manualmente rompería el enlace `cliente_id`). El botón ✏️ Editar sí sigue disponible para corregir datos como nombre o teléfono.

### Flujo en `Prospectos.jsx`

```
handleEdit(p) {
  setProspectoEditar(p)
  setDialogOpen(true)
}
```

`<ProspectoDetalle onEdit={handleEdit} ...>`

---

## Módulo 2 — Tab Cotizaciones en `ProspectoDetalle`

### Nuevo tercer tab

- Tabs resultantes: Resumen · Interacciones · Cotizaciones (con badge de conteo)
- Carga lazy: el query se ejecuta al seleccionar el tab, no al abrir el diálogo
- Query:
  ```sql
  SELECT id, folio, descripcion, fecha, total, estatus, marca_comercial
  FROM cotizaciones
  WHERE prospecto_id = :prospecto_id
    AND es_ultima_version = true
  ORDER BY fecha DESC
  ```
- Columnas de la tabla: Folio (monoespaciado) · Descripción (truncada 40 chars) · Fecha · Total (MXN) · Estatus badge
- Badges de estatus reutilizados del sistema actual: Borrador / Enviada / Aprobada / Rechazada / Historial / Obsoleta
- Estado vacío: *"Sin cotizaciones registradas. Usa 'Generar cotización' para crear una."*

---

## Módulo 3 — `ClienteDetalle` (nuevo componente)

### Archivo

`src/components/clientes/ClienteDetalle.jsx`

### Estructura

```
<Dialog sm:max-w-[580px]>
  <DialogHeader>
    Nombre del cliente + badge marca (si aplica)
    Botón ✏️ Editar → abre ClienteDialog existente
  </DialogHeader>
  <Tabs defaultValue="informacion">
    <TabsTrigger value="informacion">Información</TabsTrigger>
    <TabsTrigger value="cotizaciones">Cotizaciones (N)</TabsTrigger>
  </Tabs>
  <TabsContent value="informacion">
    — Contenido actual de ClientePreviewDialog (InfoRow fields)
  </TabsContent>
  <TabsContent value="cotizaciones">
    — Misma tabla que Módulo 2, query por cliente_id
    — Estado vacío: "Sin cotizaciones registradas para este cliente."
  </TabsContent>
</Dialog>
```

### Query para cotizaciones de cliente

```sql
SELECT id, folio, descripcion, fecha, total, estatus, marca_comercial
FROM cotizaciones
WHERE cliente_id = :cliente_id
  AND es_ultima_version = true
ORDER BY fecha DESC
```

### Integración en `Clientes.jsx`

- Reemplaza `ClientePreviewDialog` → `ClienteDetalle`
- Renombra `previewOpen` / `clienteToPreview` → `detalleOpen` / `clienteDetalle` (o mantiene nombres para mínimo diff)
- Pasa `onEdit` prop que abre `ClienteDialog` con el cliente seleccionado

### `ClientePreviewDialog`

Se mantiene en disco (puede ser usado por otras partes del sistema), pero deja de usarse en `Clientes.jsx`.

---

## Archivos a modificar / crear

| Archivo | Acción | Módulo |
|---|---|---|
| `src/pages/Prospectos.jsx` | Modificar — añadir `handleEdit`, prop `onEdit` | 1 |
| `src/components/crm/ProspectoDetalle.jsx` | Modificar — botón editar, dropdown etapa, tab cotizaciones | 1, 2 |
| `src/pages/Clientes.jsx` | Modificar — usar ClienteDetalle en lugar de ClientePreviewDialog | 3 |
| `src/components/clientes/ClienteDetalle.jsx` | **Crear** — nuevo componente | 3 |

**Sin cambios en:** migraciones SQL, RLS, ProspectoDialog, ClienteDialog, CotizacionDialog.

---

## Restricciones y reglas de negocio

1. **"Convertido" nunca es seleccionable manualmente** — integridad referencial con `clientes.id`.
2. **Motivo de descarte es opcional** — no romper flujos existentes.
3. **Cotizaciones: solo `es_ultima_version = true`** — evitar mostrar versiones obsoletas.
4. **Carga lazy de tabs** — no degradar el tiempo de apertura de los diálogos.
5. **RLS vigente** — las políticas de SELECT en `cotizaciones` ya permiten leer por usuario autenticado.

---

## Criterios de aceptación

- [ ] Desde `ProspectoDetalle`, clic en ✏️ Editar abre el formulario con todos los datos del prospecto pre-llenados
- [ ] Cambiar etapa desde el dropdown actualiza el badge en el detalle y la lista inmediatamente
- [ ] Al descartar desde el dropdown, el motivo se guarda en `motivo_descarte`
- [ ] El tab Cotizaciones en prospectos muestra solo `es_ultima_version = true` ordenadas por fecha
- [ ] Desde `Clientes`, clic en el ojo abre `ClienteDetalle` con tabs funcionales
- [ ] El tab Cotizaciones en clientes muestra las cotizaciones vinculadas a ese `cliente_id`
- [ ] `npm run build` termina sin errores
