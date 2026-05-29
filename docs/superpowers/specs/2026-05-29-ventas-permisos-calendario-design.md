# Acceso del rol VENTAS al dashboard/calendario + calendario responsive

**Fecha:** 2026-05-29
**Estado:** Aprobado por el usuario

Dos correcciones independientes para que la usuaria de ventas (CLAUDETTE,
`cagv@tesey.com`, `app_rol = VENTAS`) pueda usar el área de ventas completa, y
para que el calendario se adapte a cualquier pantalla.

## Contexto verificado (BD real)

- El frontend (`PermissionsContext`) y la RLS (`tiene_permiso`) usan la columna
  `usuarios.app_rol`. La columna `rol` (texto) es legado y no afecta. El panel
  `AdminUsuarios` lee/escribe `app_rol` correctamente (`admin_set_rol_usuario`).
- El rol **VENTAS** ya trae por defecto los 4 incisos del área (`clientes.ver`,
  `cotizaciones.ver`, `prospectos.ver`, CRM) tanto en frontend como en
  `permiso_por_defecto_rol`. Por eso Clientes/Cotizaciones/Prospectos sí cargan.
- **Causa raíz del dashboard/calendario en blanco:** la RLS bloquea las tablas
  que ambos necesitan, para un rol VENTAS:
  - `proyecto_pagos` (ingresos del dashboard): política `pp_select` exige
    `tiene_permiso('proyectos','ver','control_financiero')` → VENTAS = denegado.
  - `proyectos` (join de ingresos por marca + carga del calendario): política
    `proy_select` exige `tiene_permiso('proyectos','ver')` → VENTAS = denegado.
  - En `VentasDashboard`, el query de pagos hace `throw` si falla → todo el
    dashboard queda en blanco. En `Calendario`, `proyRes.error` también hace
    `throw` → el calendario falla para VENTAS.
- Para el admin funcionan porque `tiene_permiso` retorna `true` a los roles
  `ADMIN_MAESTRO`/`ADMIN_VISUAL` (saltan RLS lógicamente).

## Decisión clave: frontend `can()` y backend `tiene_permiso()` son independientes

Esto permite dar a VENTAS **lectura de datos** (RLS) sin abrirle el **módulo de
Proyectos** en el menú (frontend). Es exactamente lo aprobado por el usuario:
ver datos en el dashboard/calendario, pero NO el módulo de Proyectos.

---

## Tarea A — Lectura de proyectos/pagos para VENTAS (1 migración de BD)

### Cambio
En la función `public.permiso_por_defecto_rol`, dentro del `WHEN 'VENTAS'`,
agregar una rama de **solo lectura** de proyectos:

```sql
-- Proyectos: solo lectura, para que el Dashboard de Ventas (ingresos desde
-- proyecto_pagos) y el Calendario puedan leer datos vía RLS. No se abre el
-- modulo de Proyectos en el frontend (eso lo controla ROLE_PERMISSIONS, que NO
-- se modifica).
WHEN p_modulo = 'proyectos' AND p_accion = 'ver' THEN true
```

- Esta rama cubre tanto `('proyectos','ver', NULL)` (satisface `proy_select`)
  como `('proyectos','ver','control_financiero')` (satisface `pp_select`),
  porque no discrimina submódulo y solo concede `ver`.
- **Solo se concede `ver`**; crear/editar/eliminar de proyectos siguen en `false`.
- El cambio afecta **únicamente al rol VENTAS**. Ningún otro rol cambia. No se
  editan políticas RLS ni se relajan permisos globales.

### NO se modifica
- `ROLE_PERMISSIONS.VENTAS` en `PermissionsContext.jsx` (frontend) → el módulo de
  Proyectos (Operaciones) **sigue cerrado** en el menú y en sus rutas para VENTAS.
  La ruta `/ventas/dashboard` ya está protegida por `clientes.ver` (que VENTAS
  tiene), así que el dashboard es accesible; lo único que faltaba eran los datos.
- El frontend del dashboard y el calendario no requieren cambios de datos: ya
  consultan las tablas; al destrabar la RLS, cargan.

### Migración
`supabase/migrations/20260529_ventas_lectura_proyectos.sql` con el
`CREATE OR REPLACE FUNCTION permiso_por_defecto_rol(...)` completo (copiar la
definición actual y agregar la rama en el bloque VENTAS). Aplicar a la BD.

### Verificación
- Simular: `SELECT permiso_por_defecto_rol('VENTAS','proyectos','ver')` → true;
  `('VENTAS','proyectos','ver','control_financiero')` → true;
  `('VENTAS','proyectos','editar')` → false.
- Confirmar que otros roles no cambian (p. ej. `('OPERADOR','proyectos','editar')`
  sigue false; `('RH_ALMACEN', ...)` sin cambios).
- Tras aplicar: un usuario VENTAS debe poder cargar el Dashboard de Ventas (con
  ingresos por marca) y el Calendario.

---

## Tarea B — Calendario responsive (frontend)

### Problema
A la usuaria, en su laptop, el calendario "se acorta" (se recorta/comprime).
`Calendario.jsx` fuerza `h-[calc(100vh-80px)]` y `CalendarView` raíz usa
`overflow-hidden`; en viewports cortos, react-big-calendar comprime el mes y se
recorta el contenido.

### Cambio
- `src/pages/Calendario.jsx`: cambiar el contenedor de altura fija
  `h-[calc(100vh-80px)]` por una altura **mínima** adaptable (p. ej.
  `min-h-[calc(100vh-7rem)]`) de modo que llene pantallas altas pero pueda crecer
  (con scroll de página, ya que el `<main>` del Layout tiene `overflow-y-auto`)
  en pantallas cortas, sin comprimir el grid.
- `src/components/proyectos/CalendarView.jsx`: asegurar que el área del calendario
  tenga una **altura mínima legible** que no se comprima en laptops, y revisar el
  `overflow-hidden` raíz para que no recorte el grid del mes. Mantener el layout
  de sidebar + calendario (columna en móvil, fila en desktop).

### Restricción
- No cambiar la lógica de eventos/citas/colores ni el filtrado por estatus.
- Mantener el comportamiento actual en pantallas grandes (donde ya se ve bien).

### Verificación
- En viewport tipo laptop (p. ej. 1366×768 y alturas menores), el mes se ve
  completo sin recortes; si no cabe, la página hace scroll en vez de comprimir.
- En pantallas grandes el calendario se ve igual que hoy.

---

## Sobre el panel de permisos (sin cambios de código)

Tras la Tarea A, **asignar el rol VENTAS ya entrega el área completa + dashboard**
automáticamente. El dashboard no es un permiso suelto, sino datos bloqueados por
RLS que la Tarea A destraba. No se requiere agregar toggles nuevos en
`AdminUsuarios`. La usuaria ya tiene `app_rol = VENTAS`, así que no hay que
cambiar su rol.

## Ejecución
Dos subagentes independientes: Tarea A (migración BD) y Tarea B (frontend
calendario). Al cerrar: aplicar migración, `npm run build`, regenerar `dist/`.
