# Diseño: Tabla Prospectos v2 + Auto-rechazo de Cotizaciones

**Fecha:** 2026-05-28
**Estado:** Aprobado por el usuario

---

## Modificación A — Tabla de Prospectos estilo Monday (v2)

**Archivo:** `src/components/crm/ProspectoTabla.jsx`

### Cambios visuales

1. **Pills `rounded-full`** — reemplazar `rounded-md` por `rounded-full` en el componente `Pill`. Más padding horizontal (`px-3.5`).
2. **Checkbox decorativo** — columna izquierda con `<input type="checkbox" />` (sin lógica de selección). Ancho fijo, centrado.
3. **Barra lateral de color al hover** — cada fila aplica `border-l-4` con el color de la etapa al hacer hover. Cuando no hay hover, `border-l-4 border-transparent`. Colores por etapa: nuevo→orange-400, contactado→rose-400, propuesta_enviada→amber-400, en_negociacion→yellow-400, convertido→emerald-500, descartado→gray-300.
4. **Tipografía del Lead** — nombre en `font-semibold text-gray-900`, contacto debajo en `text-xs text-gray-500`.
5. **Colores de etapa actualizados** para mayor contraste/vivacidad (mantener misma paleta, solo ajustar saturation/luminance si queda mejor).
6. **Header de tabla** — texto `text-xs text-gray-400 font-medium` (sin uppercase), `border-b border-gray-100`.
7. **Espaciado de filas** — `py-3` en celdas (actualmente `py-2.5`).

### Sin cambios
- Columnas, datos, click → detalle, filtros, toggle Kanban — todo igual.

---

## Modificación B — Auto-rechazo de cotizaciones de mes anterior

**Archivo:** `src/pages/Cotizaciones.jsx`

### Regla de negocio
Al montar la página, automáticamente marcar como `Rechazada` las cotizaciones con:
- `estatus IN ('Borrador', 'Enviada')`
- `es_ultima_version = true`
- `fecha < primer día del mes actual` (usando `new Date(año, mes, 1)` dinámico)

### Implementación
Agregar `useCallback` `autoRechazarAntiguas` que:
1. Calcula `inicioMesActual = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)`.
2. Llama `supabase.from('cotizaciones').update({ estatus: 'Rechazada' }).in('estatus', ['Borrador', 'Enviada']).eq('es_ultima_version', true).lt('fecha', inicioMesActual).select('id')`.
3. Si `data.length >= 1` → toast: `"${data.length} cotización(es) de meses anteriores marcadas como Rechazadas"`.
4. Si no hay cambios → silencioso.
5. Llamar desde `useEffect` en mount (una sola vez, sin dependencias cambiantes).
6. Después de la actualización, llamar `fetchCotizaciones()` para refrescar la lista.

### Sin cambios
- Nada más en Cotizaciones.jsx. La lógica se añade de forma aditiva.

---

## Criterios de aceptación

**Tabla:**
- Pills con forma de cápsula (rounded-full).
- Al hacer hover en una fila aparece barra de color izquierda según etapa.
- Checkbox visible a la izquierda de cada fila.

**Auto-rechazo:**
- Al abrir la página de cotizaciones, las cotizaciones Borrador/Enviada de meses anteriores pasan a Rechazada.
- Aparece toast con el conteo si hubo cambios.
- La lista se actualiza inmediatamente.
- Las cotizaciones del mes actual NO son afectadas.
- Las Aprobadas/Historial/Rechazadas NO son afectadas.
