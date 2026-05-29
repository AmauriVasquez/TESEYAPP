# Diseño: 5 mejoras de ventas/CRM — tesey-app

**Fecha:** 2026-05-28
**Estado:** Aprobado por el usuario, listo para plan de implementación

## Contexto

Cinco problemas reportados en el módulo de ventas/CRM de tesey-app (React + Vite + Supabase, light mode obligatorio). La base de datos ya tiene las columnas necesarias para el flujo CRM completo; el trabajo es principalmente UI y un par de reglas en la base.

---

## Punto 1 + Punto 2 — Estabilizar la sesión de Supabase (misma causa raíz)

### Problema
- **Punto 1:** Al cambiar de pestaña/ventana del navegador con una ventana abierta (cotización, cliente, pedido, etc.), la ventana se cierra y se pierde el trabajo.
- **Punto 2:** En móvil, al registrar una entrega, el flujo avanza por tipo → cantidades → datos → foto, pero al pasar al paso de **firma** la ventana de entregas se cierra sin registrar nada.

### Causa raíz
`src/contexts/SupabaseAuthContext.jsx` (línea ~57): `onAuthStateChange` ejecuta `handleSession()` en **cada** evento. Al cambiar de pestaña o abrir la cámara (paso de foto en móvil, que usa `<input capture="environment">`), el navegador pierde foco y Supabase dispara `TOKEN_REFRESHED`/`SIGNED_IN`. Esto crea un objeto `session` nuevo → cambia el `value` del contexto → re-render de toda la app → los modales (cuyo estado `open` vive en componentes padre como `ProyectoDetalle.jsx`) se desmontan.

El punto 2 es el mismo bug disparado por la cámara: tomar la foto manda la app a segundo plano y al volver se dispara el evento que cierra `EntregaModal`.

### Solución
En `onAuthStateChange`, actualizar el estado **solo si cambió la identidad de la sesión** (comparar `session?.user?.id` y `session?.access_token` contra los actuales mediante refs). Ignorar eventos donde el usuario/token efectivo no cambió. Mantener la actualización real en `SIGNED_IN` (login nuevo), `SIGNED_OUT` y cambios de usuario.

### Criterios de aceptación
- Con una ventana abierta, cambiar de pestaña y volver: la ventana sigue abierta con sus datos.
- En móvil: registrar entrega completa el flujo foto → firma → guardar sin cerrarse, y la entrega queda registrada.
- Login y logout siguen funcionando normalmente.

### Riesgos
- El `SignaturePad` debe re-inicializar el canvas al volver de la cámara; ya tiene `ResizeObserver`, verificar que el trazo funcione tras regresar.

---

## Punto 3 — Flujo CRM completo

### Estado actual
- Prospectos en Kanban con interacciones y citas.
- RPC `crm_convertir_prospecto(p_prospecto_id, p_cliente_id)` ya existe y funciona: crea un cliente desde el prospecto (o liga uno existente), migra `crm_personas`/`crm_interacciones`, marca el prospecto como `convertido`.
- Botón manual "Convertir a cliente" en `ProspectoDetalle.jsx`.
- Columnas existentes y aprovechables: `cotizaciones.prospecto_id`, `cotizaciones.fecha_aprobacion`, `cotizaciones.monto_aprobado`, `clientes.prospecto_id`, `clientes.fuente_origen`, `prospectos.cliente_id`, `prospectos.convertido_en`.
- `CRM.jsx` es un placeholder vacío.

### Huecos a cerrar
1. No se puede generar una cotización ligada a un prospecto desde la UI.
2. Aprobar una cotización no convierte el prospecto automáticamente.
3. No hay métricas de clientes nuevos ni tasa de conversión.

### Solución

**3.1 Cotizar desde el prospecto.**
Agregar botón "Generar cotización" en `ProspectoDetalle.jsx` que abra el formulario de cotización (`CotizacionDialog`) precargando datos del prospecto (nombre como `cliente_nombre_externo`, marca, etc.) y guardando `prospecto_id`. La cotización nace con `cliente_id = null` y `prospecto_id` seteado (sigue siendo prospecto, aún no cliente).

**3.2 Auto-conversión al aprobar (+ manual).**
Trigger en `cotizaciones` (`AFTER UPDATE`): cuando `estatus` cambia a `Aprobada` y `prospecto_id IS NOT NULL` y el prospecto aún no está convertido → ejecutar la conversión (vía `crm_convertir_prospecto`) y actualizar `cotizaciones.cliente_id` al nuevo cliente. El botón manual "Convertir a cliente" se conserva.

**3.3 Métricas en el encabezado de Prospectos.**
Tarjetas (light mode, mismo estilo del dashboard) arriba de la lista de Prospectos:
- **Prospectos activos:** etapa distinta de convertido/descartado.
- **Valor en pipeline:** suma de `valor_estimado` de los activos.
- **Clientes nuevos (mes):** `clientes` con `fuente_origen = 'prospecto_convertido'` (o `prospecto_id` no nulo) y `created_at`/`ultima_actividad` dentro del mes actual.
- **Tasa de conversión:** `convertidos ÷ (convertidos + descartados)` × 100. Si el denominador es 0, mostrar "—". Se calcula sobre todos los prospectos (no eliminados); el cálculo y el periodo quedan documentados para validación.

### Criterios de aceptación
- Desde un prospecto puedo generar una cotización que queda ligada (`prospecto_id`).
- Al aprobar esa cotización, el prospecto pasa a `convertido` y aparece como cliente, con la cotización ligada al nuevo cliente.
- El botón manual sigue convirtiendo prospectos.
- Las 4 métricas se muestran en el encabezado de Prospectos y cuadran con los datos.

---

## Punto 4 — Rediseño de la vista de Prospectos (estilo tabla Monday)

### Referencia
Imagen aportada: tabla "Leads nuevos" con columnas: selección, Lead, Estado (píldora de color), Cronograma, Empresa, Título, E-mail, Teléfono (con bandera), Origen del lead (píldora de color), Última interacción.

### Solución
Vista de **tabla** como vista principal de Prospectos, adaptando los campos existentes. Mapeo de columnas:

| Columna (imagen) | Campo prospecto | Render |
|---|---|---|
| Lead | `nombre` (+ `nombre_contacto` debajo) | texto |
| Estado | `etapa` | píldora de color (Nuevo/Contactado/Propuesta enviada/En negociación/Convertido/Descartado) |
| Empresa | `razon_social` (fallback `nombre`) | texto |
| Título | `industria` | texto (no hay "puesto"; se usa industria) |
| E-mail | `email` | enlace `mailto:` |
| Teléfono | `telefono` | bandera MX + número, enlace `tel:` |
| Origen del lead | `fuente` | píldora de color (Referido/Redes/Web/Visita/Feria/Llamada fría/Otro) |
| Última interacción | última `crm_interacciones.fecha` (fallback `updated_at`) | fecha corta |
| Valor estimado | `valor_estimado` | MXN |

- Click en fila → abre `ProspectoDetalle` (igual que hoy).
- Filtros por marca y switch "mostrar convertidos/descartados" se conservan.
- El Kanban existente (`ProspectoKanban`) se mantiene disponible mediante un toggle Tabla/Kanban para no perder funcionalidad.
- Responsivo: en móvil, scroll horizontal de la tabla (igual que el Kanban hoy) o colapso a tarjetas; la tabla con `overflow-x-auto` es suficiente.
- Estilos light: `bg-white rounded-xl border border-gray-100 shadow-sm`, header `text-xs uppercase text-gray-500`, filas `hover:bg-gray-50`.

### Criterios de aceptación
- La vista de Prospectos se ve como una tabla similar a la imagen, con píldoras de color en Estado y Origen.
- Toda la info existente del prospecto se muestra sin pérdida de funcionalidad (click abre detalle, filtros funcionan).

---

## Punto 5 — Formulario Nuevo Cliente

### Estado actual
`src/components/clientes/ClienteDialog.jsx`: RFC, teléfono y email son todos opcionales.

### Solución
- **RFC:** casilla "No aplica". Al marcarla, se deshabilita el input y se guarda vacío/null.
- **Email:** casilla "No aplica". Al marcarla, se deshabilita el input y se guarda vacío/null. Quitar dependencia de validación HTML que lo exija.
- **Teléfono:** obligatorio. Validar (trim no vacío) antes de `performSave`; si falta, mostrar toast y no guardar.
- Aplica tanto en "Nuevo Cliente" como en "Editar Cliente" (mismo componente). En edición, si el RFC/email vienen vacíos, la casilla "No aplica" puede aparecer marcada.

### Criterios de aceptación
- Puedo crear un cliente sin RFC marcando "No aplica".
- Puedo crear un cliente sin email marcando "No aplica".
- No puedo guardar un cliente sin teléfono.

---

## Plan de ejecución (subagent-driven)

Un subagente por punto, trabajando en `main` (estilo de trabajo del usuario):
- **Subagente A:** Puntos 1 + 2 — `SupabaseAuthContext.jsx` + verificación del flujo de entregas en móvil.
- **Subagente B:** Punto 3 — trigger de auto-conversión, botón "Generar cotización" en prospecto, métricas en encabezado de Prospectos.
- **Subagente C:** Punto 5 — `ClienteDialog.jsx` (RFC/email "No aplica", teléfono obligatorio).
- **Subagente D:** Punto 4 — tabla de Prospectos estilo Monday.

Independencia: A, C y D tocan archivos distintos y pueden ir en paralelo. B y D ambos tocan la página Prospectos (encabezado vs. cuerpo); coordinar para evitar conflictos (B hace el encabezado de métricas, D el cuerpo/tabla).
