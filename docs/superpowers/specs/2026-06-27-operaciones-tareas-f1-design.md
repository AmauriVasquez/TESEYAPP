# Operaciones · Tablero de Tareas — Diseño F1 (supervisor-first)

- **Fecha:** 2026-06-27
- **Estado:** Spec aprobado para escribir plan (núcleo F1)
- **Validado con:** brainstorming · abogado-del-diablo · llm-council (consenso: recortar a núcleo supervisor-first; login del operativo opcional, no cimiento)

## 1. Propósito

Dar a operación un lugar dentro de tesey-app para **asignar, ver y dar seguimiento a tareas** de los colaboradores: trabajos internos de mejora, mantenimiento y pendientes generales. El usuario primario es el **supervisor/encargado** (rol `SUPERVISOR_CAMPO`) y el administrador. Hoy esa coordinación vive de viva voz y WhatsApp, sin memoria ni trazabilidad.

## 2. Decisiones de diseño (y por qué)

- **Supervisor-first.** El supervisor y el admin crean, asignan y mueven las tareas de todos. El tablero es para ellos. Es lo que ya hacen, pero con memoria.
- **Login del operativo = opcional y aditivo.** El módulo funciona el día 1 sin que ningún operativo inicie sesión. Si un operativo tiene cuenta vinculada, ve "mis tareas" en solo-consulta. Nadie depende de ello.
- **Una sola tabla nueva (`tareas`).** YAGNI: sin motor de recurrencia, sin drag-and-drop, sin tablas de pedidos/OC. Eso es fase futura.
- **Mantenimiento sin duplicar.** Ya existe la tabla `mantenimientos` + tab "Mantenimiento" bajo Activos Operativos. En F1 una tarea puede ser `tipo='mantenimiento'`, pero el registro histórico de mantenimiento sigue siendo `mantenimientos` (la integración de cierre se define en fase futura, no en F1).

## 3. Alcance

### Dentro de F1
- Tabla `tareas` + columna puente `empleados.usuario_id` (nullable).
- Pestaña **Tareas** en el módulo Operaciones (`/operaciones/tareas`).
- Tablero kanban **sin drag** (botón "Mover a…") con columnas: Pendiente · En progreso · Bloqueada · Hecha.
- Vista **Por colaborador** (agrupado por empleado, con conteo de pendientes).
- Crear / editar / asignar tarea (modal).
- RLS por rol reusando `es_admin()` / `get_user_role()`.
- Tipos de tarea: `mejora` · `mantenimiento` · `general`.

### Fuera de F1 (fases futuras, documentadas, NO se construyen ahora)
- **F2 — Rutinas + Calendario:** tareas recurrentes. Mecanismo **por fecha** (no por "completar la anterior"), con renovación manual vía botón "Repetir" o job; vista calendario con `react-big-calendar`.
- **F3 — Seguimientos (solo lectura):** vistas de `pedidos_materiales` pendientes y `ordenes_compra` abiertas/no recibidas, con opción "crear tarea de seguimiento".
- **F-futuro:** integración cierre de mantenimiento → `mantenimientos`; tareas auto-generadas desde cambios de estado de proyecto/OC; métricas de productividad por colaborador.

### No-objetivos
- No es un reemplazo de WhatsApp para chat.
- No obliga a los operativos a usar la app.
- No toca el modelo de identidad más allá de agregar una FK nullable.

## 4. Modelo de datos

### 4.1 Tabla nueva `tareas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK (`gen_random_uuid()`) | |
| `titulo` | text NOT NULL | |
| `descripcion` | text NULL | |
| `tipo` | text NOT NULL DEFAULT `'general'` | CHECK in (`mejora`,`mantenimiento`,`general`) |
| `estado` | text NOT NULL DEFAULT `'pendiente'` | CHECK in (`pendiente`,`en_progreso`,`bloqueada`,`hecha`) |
| `prioridad` | text NOT NULL DEFAULT `'media'` | CHECK in (`baja`,`media`,`alta`) |
| `asignado_empleado_id` | uuid NULL → `empleados(id)` | el responsable |
| `creado_por` | uuid NULL → `usuarios(id)` | quién la creó (default `auth.uid()` vía trigger/app) |
| `fecha_limite` | date NULL | |
| `proyecto_id` | integer NULL → `proyectos(id)` | opcional, si la tarea es de un proyecto |
| `equipo_id` | bigint NULL → `equipos(id)` | opcional, para mantenimiento |
| `completado_en` | timestamptz NULL | se setea al pasar a `hecha` |
| `completado_por` | uuid NULL → `usuarios(id)` | |
| `created_at` | timestamptz NOT NULL DEFAULT `now()` | |

Índices: `(estado)`, `(asignado_empleado_id)`, `(fecha_limite)`.

### 4.2 Cambio a `empleados`
```sql
ALTER TABLE empleados ADD COLUMN usuario_id uuid NULL REFERENCES usuarios(id);
```
- Nullable. Mapeo manual de los empleados que sí tengan cuenta (lo hace el admin; pueden quedar todos en NULL en F1 sin afectar el módulo).
- Es el único puente login↔empleado. Todo el código que lo use debe tolerar NULL.

## 5. Seguridad (RLS sobre `tareas`)

Reusa los helpers existentes `es_admin()` y `get_user_role(auth.uid())`. Política por acción:

- **SELECT:**
  - admin → todo;
  - `SUPERVISOR_CAMPO` → todo;
  - resto (incl. `OPERADOR`) → solo donde `asignado_empleado_id` pertenece al empleado cuyo `usuario_id = auth.uid()`.
- **INSERT / UPDATE / DELETE:** admin y `SUPERVISOR_CAMPO`.
- **UPDATE acotado para el asignado:** un operativo con cuenta vinculada puede actualizar **solo el `estado`** de sus propias tareas (mover de columna). El resto de campos, solo supervisor/admin. (Si esto complica la política, F1 puede dejar la edición solo a supervisor/admin y el operativo en solo-lectura; decisión a confirmar en el plan.)

La regla vive en Postgres, no solo en el front. La UI además oculta acciones con `can('operaciones', ...)`.

### Permisos de módulo
Agregar clave `operaciones` a la matriz de `PermissionsContext`:
- `SUPERVISOR_CAMPO`: `{ ver, crear, editar }` (no eliminar).
- `OPERADOR`: `{ ver }` (y mover estado de las suyas).
- Admin: `_all` ya cubre.
- Otros roles: sin acceso por defecto (override posible).

## 6. UI / Componentes

Sigue patrones existentes (radix, tailwind, `usePermissions`, patrón tarjetas-móvil / tabla-web).

- `src/pages/Operaciones.jsx` *(o `OperacionesTareas.jsx`)* — contenedor de la pestaña Tareas con sub-vistas Tablero / Por colaborador.
- `src/components/operaciones/TableroTareas.jsx` — kanban sin drag; cada tarjeta con botón "Mover a…" (select de estado), filtros por tipo/responsable.
- `src/components/operaciones/TareasPorColaborador.jsx` — agrupado por empleado + conteo de pendientes.
- `src/components/operaciones/TareaModal.jsx` — crear/editar/asignar.
- Datos: cliente Supabase directo (como el resto de la app) o un `src/services/tareasService.js` ligero si la lógica lo amerita.

**Móvil:** kanban → lista de tarjetas (`sm:hidden`), tabla/columnas en web (`hidden sm:block`), fila clickable. (Regla obligatoria del proyecto.)

## 7. Integración con rutas y menú

- **Ruta:** agregar `<Route path="tareas" element={<OperacionesTareas/>} />` dentro del `OperacionesModuleLayout` en `src/App.jsx` (junto a `proyectos`), protegida con `requiredPermission={{ modulo:'operaciones', accion:'ver' }}`.
- **Pestaña:** agregar `{ to: '/operaciones/tareas', label: 'Tareas', icon: ListChecks }` al layout de Operaciones en `src/components/module/ModuleSectionLayouts.jsx` (~línea 117).
- El menú "Operaciones" ya existe en `Layout.jsx`; no requiere cambios salvo, opcionalmente, no redirigir el índice a `proyectos` si se quiere que Tareas sea la portada (a confirmar; default: dejar índice en proyectos).

## 8. Despliegue

1. 1 migración SQL (tabla `tareas` + `empleados.usuario_id` + políticas RLS + clave de permiso). El dueño la pega en el SQL Editor de Supabase (flujo habitual del proyecto).
2. `npm run build` → commit del `dist` → push a `origin/main` (despliegue manual a Hostinger).

## 9. Criterios de aceptación (F1)

- Un supervisor puede crear una tarea, asignarla a un empleado, ponerle fecha límite y prioridad.
- El tablero muestra las tareas en sus 4 columnas y permite moverlas con el botón "Mover a…".
- La vista "Por colaborador" lista cada empleado con sus tareas y conteo de pendientes.
- Un admin ve todas las tareas; un `SUPERVISOR_CAMPO` ve todas; un `OPERADOR` con cuenta vinculada ve solo las suyas (verificado a nivel RLS, no solo UI).
- Funciona sin que ningún operativo tenga cuenta (todas las tareas gestionadas por el supervisor).
- Responsive: tarjetas en móvil, tabla/columnas en web.

## 10. Riesgos / supuestos vivos (vigilar)

- **Adopción:** el valor real depende de que el supervisor lo use de verdad. Medir uso a las ~2 semanas antes de invertir en F2/F3.
- **`empleados.usuario_id`:** acoplamiento de identidad; mantener nullable y tolerar NULL en todo el código.
- **Mantenimiento:** evitar que `tareas tipo=mantenimiento` se vuelva fuente de verdad paralela a `mantenimientos`. F1 lo deja como tipo informativo; la conciliación es fase futura.
- **Recurrencia/pagos (F2):** debe ser por fecha, nunca dependiente de completar la ocurrencia anterior.
