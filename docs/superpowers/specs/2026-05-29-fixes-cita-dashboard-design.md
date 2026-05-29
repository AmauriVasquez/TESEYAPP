# Fixes: agendar cita + dashboard ventas (marca $ y oportunidades)

**Fecha:** 2026-05-29
**Estado:** Aprobado por el usuario

Tres correcciones independientes en `tesey-app`. Decisiones tomadas con el usuario.
Las tareas tocan archivos distintos → se ejecutan en paralelo (un subagente c/u).

---

## Tarea A — Error al agendar cita a un prospecto (#1)

### Problema
Al programar una cita sin "Notas previas", la inserción en `crm_interacciones` falla con:
`null value in column "descripcion" violates not-null constraint`.

[`CitaForm.jsx:68`](../../../src/components/crm/CitaForm.jsx) envía
`descripcion: form.descripcion.trim() || null`, pero la columna es `text NOT NULL`
(confirmado contra la BD: `descripcion` `is_nullable = NO`, sin default). Las notas son
opcionales en la UI → contradicción UI/esquema.

### Solución (decisión: "Ambas" — cinturón y tirantes)
1. **Migración** (`supabase/migrations/20260529_crm_interacciones_descripcion_nullable.sql`):
   `ALTER TABLE public.crm_interacciones ALTER COLUMN descripcion DROP NOT NULL;`
2. **`CitaForm.jsx`**: si `form.descripcion` queda vacío, generar texto por defecto
   usando la etiqueta del tipo seleccionado: `"Cita programada: ${labelDelTipo}"`
   (p. ej. `"Cita programada: Llamada"`). La etiqueta sale de `TIPOS_CITA`.

### No tocar
- `InteraccionForm.jsx` y `MarcarRealizadaForm.jsx` ya validan/envían `descripcion`
  no vacía; quitar el `NOT NULL` no los afecta.

### Verificación
- Programar cita con notas vacías → se inserta con `descripcion = "Cita programada: <tipo>"`, sin error.
- Programar cita con notas → guarda las notas tal cual.

---

## Tarea B — Valor $ por marca = ventas (#2 anual y #3 mensual)

### Problema
[`MarcaCards.jsx:41`](../../../src/components/ventas/MarcaCards.jsx) calcula
`valorMarca` sumando **todas** las cotizaciones de la marca (Borrador + Enviada +
Aprobada) y la etiqueta dice "Valor en cotizaciones". El usuario quiere que el monto
$ refleje **ventas = cotizaciones Aprobadas**. Componente compartido por
`DashboardAnual` y `DashboardMensual` → una corrección resuelve #2 y #3.

### Solución (decisiones: "Solo Aprobadas" + "% sobre ventas totales")
- `valorMarca` = suma de `total` de cotizaciones de la marca con `estatus === 'Aprobada'`.
- Etiqueta `"Valor en cotizaciones"` → `"Valor en ventas"`.
- Base del `pct`/barra de participación: **ventas totales aprobadas de las 3 marcas**
  (no el valor de todas las cotizaciones). Reemplaza el `totalValor` actual por
  `totalVentas = suma de aprobadas (post-filtro de mes)`. Guard contra división por
  cero (si `totalVentas === 0`, `pct = 0`).
- Contadores `Aprobadas` / `Activas` (Borrador+Enviada) / `Total` se mantienen igual.
- Respetar el filtro por mes existente (props `mes`/`anio`) antes de sumar aprobadas.

### Verificación
- Tarjeta muestra el $ de aprobadas, etiqueta "Valor en ventas".
- Suma de los 3 `pct` ≈ 100% cuando hay ventas; 0% sin ventas (sin NaN/Infinity).

---

## Tarea C — "Oportunidades activas" 10 vs 17 (#4)

### Problema
- "Cotizaciones activas: 17" ([`DashboardMensual.jsx:62`](../../../src/components/ventas/DashboardMensual.jsx))
  = cotizaciones en **Borrador + Enviada**.
- "Oportunidades activas: 10" ([`OportunidadesTabla.jsx:41`](../../../src/components/ventas/OportunidadesTabla.jsx))
  = **Borrador + Enviada + Aprobada**, ordenadas por monto y truncadas con `.slice(0, 10)`;
  el encabezado cuenta solo las 10 mostradas. Definiciones distintas + tope mal contado.

### Solución (decisión: "Alinear con 'Cotizaciones activas'")
- Filtro de la tabla pasa a **Borrador + Enviada** (quitar `'Aprobada'`) → mismo
  criterio que "Cotizaciones activas"; ambos números coincidirán (17 = 17).
- Quitar `.slice(0, 10)` → mostrar todas. Si crece, contener con scroll vertical
  (`max-height` + `overflow-y-auto` en el contenedor de la tabla).
- Encabezado `{activas.length} cotizaciones` ahora refleja el conteo real (ya es así
  tras quitar el slice).
- El estilo `Aprobada` en `ESTATUS_STYLE` queda sin uso pero inofensivo; se puede dejar.

### Verificación
- "Oportunidades activas" y "Cotizaciones activas" muestran el mismo número.
- Con >10 activas, la tabla hace scroll en vez de truncar.

---

## Build / entrega
Tras las 3 tareas: regenerar `dist/` (flujo de despliegue Hostinger) y reportar.
