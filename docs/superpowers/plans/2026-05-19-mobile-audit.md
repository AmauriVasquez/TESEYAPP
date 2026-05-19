# Mobile Audit & Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir la experiencia móvil de la app tesey-app — empezando por el menú lateral que muestra solo íconos sin etiquetas, y luego optimizando cada página para que funcione correctamente en pantallas pequeñas.

**Architecture:** La app usa React + Tailwind + Shadcn/ui. El sidebar está en `src/components/Layout.jsx` y controla la visibilidad de etiquetas mediante el flag `isSidebarExpanded`. En móvil, `isSidebarExpanded` nunca se activa porque depende de hover o de `isCollapsed=false`, ignorando el estado `isSidebarOpen`. La corrección es sumar `|| isSidebarOpen` a esa expresión. El resto de la auditoría recorre cada página buscando tablas sin `overflow-x-auto`, filtros que no se apilan en móvil, y grillas que no colapsan.

**Tech Stack:** React 18, Tailwind CSS v3, Shadcn/ui, Lucide React, Framer Motion, Recharts, React Router v6

---

## Resumen de archivos

| Archivo | Problema | Tarea |
|---|---|---|
| `src/components/Layout.jsx:248` | `isSidebarExpanded` ignora `isSidebarOpen` | T1 |
| `src/pages/Finanzas.jsx` | Tablas sin overflow-x-auto, filtros no apilados | T2 |
| `src/pages/Cotizaciones.jsx` | Barra filtros + tabla sin overflow-x-auto | T3 |
| `src/pages/ControlPersonal.jsx` | Grilla semanal asistencia sin scroll horizontal | T4 |
| `src/pages/Clientes.jsx` | Cards/tabla sin wrap | T5 |
| `src/pages/Materiales.jsx` | Tabla sin overflow-x-auto | T5 |
| `src/pages/PedidosMateriales.jsx` | Tabla + filtros | T5 |
| `src/pages/Inventario.jsx` | Tabla sin overflow-x-auto | T5 |
| `src/pages/Activos.jsx` | Tabla sin overflow-x-auto | T5 |
| `src/pages/Dashboard.jsx` | StatCards grid, verificar | T6 |
| `src/pages/Proyectos.jsx` | Filtros + lista | T6 |
| `src/pages/Reportes.jsx` | Gráficas en contenedor | T6 |
| `src/components/crm/ProspectoKanban.jsx` | Columnas demasiado anchas en móvil | T7 |
| `src/pages/Prospectos.jsx` | Filtros de marca no apilados | T7 |

---

## Task 1: Fix crítico — etiquetas del menú lateral en móvil

**Archivos:**
- Modify: `src/components/Layout.jsx:248`

**Root cause:** En `Layout.jsx:248`, `isSidebarExpanded = isHoveredGlobal || !isCollapsed`. En móvil no hay hover y `isCollapsed` arranca en `true`, por lo que siempre es `false`. El sidebar se desliza con ancho completo pero las etiquetas quedan ocultas (`span` con `class="hidden"`).

- [ ] **Step 1: Abrir `src/components/Layout.jsx` y localizar línea 248**

```jsx
// ANTES (línea 248):
const isSidebarExpanded = isHoveredGlobal || !isCollapsed;

// DESPUÉS:
const isSidebarExpanded = isHoveredGlobal || !isCollapsed || isSidebarOpen;
```

- [ ] **Step 2: Verificar que el overlay de cierre sigue funcionando**

El overlay (`motion.div` con `onClick={() => setSidebarOpen(false)}`) ya existe en el render. No se toca — sigue cerrando el sidebar al pulsar fuera.

- [ ] **Step 3: Verificar en Chrome DevTools (móvil 390px)**

Abrir el app → clic en hamburger → el menú debe mostrar íconos + etiquetas. Al hacer clic en un ítem debe cerrar el sidebar.

- [ ] **Step 4: Commit**

```bash
git add src/components/Layout.jsx
git commit -m "fix: mostrar etiquetas del menú lateral en versión móvil"
```

---

## Task 2: Finanzas — tablas y filtros móvil

**Archivos:**
- Modify: `src/pages/Finanzas.jsx`

**Problema:** La página tiene tablas de ingresos/gastos y gráficas. Las tablas necesitan `overflow-x-auto`. El DateRangePicker + botones de filtro forman una barra que se desborda en pantallas < 640px.

- [ ] **Step 1: Buscar todos los `<Table>` en Finanzas.jsx y envolver cada uno**

Buscar el patrón: cualquier `<Table>` que no esté ya dentro de un `<div className="overflow-x-auto">`.

Para cada tabla encontrada, cambiar:
```jsx
// ANTES:
<Table>
  ...
</Table>

// DESPUÉS:
<div className="overflow-x-auto -mx-1">
  <Table>
    ...
  </Table>
</div>
```

- [ ] **Step 2: Hacer que la barra de filtros (DateRangePicker + botones) se apile en móvil**

Localizar el contenedor de filtros/encabezado de la sección. Cambiar su className para que use flex-col en móvil:

```jsx
// ANTES (ejemplo típico):
<div className="flex items-center gap-4 justify-between">

// DESPUÉS:
<div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
```

- [ ] **Step 3: Verificar en móvil 390px que las tablas hacen scroll y los filtros se apilan**

- [ ] **Step 4: Commit**

```bash
git add src/pages/Finanzas.jsx
git commit -m "fix(mobile): overflow-x-auto en tablas y filtros apilables en Finanzas"
```

---

## Task 3: Cotizaciones — barra filtros y tabla

**Archivos:**
- Modify: `src/pages/Cotizaciones.jsx`

**Problema:** La barra de filtros tiene Search + múltiples dropdowns (Estatus, Marca, Empresa, Orden) que se salen en pantallas pequeñas. La lista de cotizaciones usa una tabla ancha.

- [ ] **Step 1: Localizar la barra de búsqueda y filtros en Cotizaciones.jsx**

Buscar el contenedor `<div>` que tenga `Search` junto con los dropdowns de Estatus/Marca. Ajustar a flex-col en móvil:

```jsx
// ANTES:
<div className="flex gap-2 items-center">
  <Input ... /> {/* search */}
  <DropdownMenu>...</DropdownMenu>  {/* filtros */}
  ...
</div>

// DESPUÉS:
<div className="flex flex-col sm:flex-row gap-2">
  <div className="relative flex-1">
    <Search ... />
    <Input ... />
  </div>
  <div className="flex flex-wrap gap-2">
    <DropdownMenu>...</DropdownMenu>
    {/* resto de filtros */}
  </div>
</div>
```

- [ ] **Step 2: Envolver la tabla de cotizaciones en overflow-x-auto**

```jsx
// ANTES:
<Table>
  <TableHeader>...</TableHeader>
  <TableBody>...</TableBody>
</Table>

// DESPUÉS:
<div className="overflow-x-auto">
  <Table>
    <TableHeader>...</TableHeader>
    <TableBody>...</TableBody>
  </Table>
</div>
```

- [ ] **Step 3: Verificar en móvil 390px — la búsqueda y los filtros deben apilarse, la tabla debe hacer scroll horizontal**

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cotizaciones.jsx
git commit -m "fix(mobile): filtros apilables y overflow-x-auto en Cotizaciones"
```

---

## Task 4: ControlPersonal — grilla semanal de asistencia

**Archivos:**
- Modify: `src/pages/ControlPersonal.jsx`

**Problema:** La grilla semanal muestra columnas Lun–Dom para cada empleado. Son 7+ columnas con celdas de asistencia que se desbordan en móvil. El componente también tiene tabs con tablas de empleados.

- [ ] **Step 1: Localizar el render de la grilla semanal**

Buscar en `ControlPersonal.jsx` el patrón donde se mapeam los días de la semana (probablemente un array `['Lun','Mar',...]` o `eachDayOfInterval`). El contenedor de esa grilla necesita scroll horizontal:

```jsx
// ANTES:
<div className="grid grid-cols-...">
  {/* días de la semana */}
</div>

// DESPUÉS:
<div className="overflow-x-auto -mx-4 px-4">
  <div className="min-w-[600px] grid grid-cols-...">
    {/* días de la semana */}
  </div>
</div>
```

- [ ] **Step 2: Localizar tablas de empleados y envolver en overflow-x-auto**

Buscar `<Table>` en ControlPersonal.jsx. Cada una necesita:
```jsx
<div className="overflow-x-auto">
  <Table>...</Table>
</div>
```

- [ ] **Step 3: Verificar el encabezado de la sección (tabs + botones) se apila correctamente**

El contenedor del header con tabs y botones debe tener `flex-col sm:flex-row`:
```jsx
// ANTES:
<div className="flex items-center justify-between">

// DESPUÉS:
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ControlPersonal.jsx
git commit -m "fix(mobile): scroll horizontal en grilla asistencia y tablas de ControlPersonal"
```

---

## Task 5: Páginas de lista — Clientes, Materiales, PedidosMateriales, Inventario, Activos

**Archivos:**
- Modify: `src/pages/Clientes.jsx`
- Modify: `src/pages/Materiales.jsx`
- Modify: `src/pages/PedidosMateriales.jsx`
- Modify: `src/pages/Inventario.jsx`
- Modify: `src/pages/Activos.jsx`

**Patrón a aplicar en todos:**

Para cada archivo:

**Paso A — Barra de búsqueda + botón Nuevo:** asegurar que en móvil se apila verticalmente:
```jsx
// ANTES:
<div className="flex items-center justify-between gap-2">
  <Input placeholder="Buscar..." />
  <Button>Nuevo</Button>
</div>

// DESPUÉS:
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
  <div className="relative flex-1 max-w-sm">
    <Input placeholder="Buscar..." />
  </div>
  <Button className="w-full sm:w-auto">Nuevo</Button>
</div>
```

**Paso B — Tablas:** envolver en `<div className="overflow-x-auto">`.

**Paso C — Columnas opcionales en móvil:** si hay columnas de tabla con datos secundarios (notas, ciudad, etc.), añadir `className="hidden sm:table-cell"` al `<TableHead>` y al `<TableCell>` correspondientes.

- [ ] **Step 1: Aplicar patrón en Clientes.jsx**

- [ ] **Step 2: Aplicar patrón en Materiales.jsx**

- [ ] **Step 3: Aplicar patrón en PedidosMateriales.jsx** (tiene filtros adicionales — envolver en `flex-wrap gap-2`)

- [ ] **Step 4: Aplicar patrón en Inventario.jsx**

- [ ] **Step 5: Aplicar patrón en Activos.jsx**

- [ ] **Step 6: Commit**

```bash
git add src/pages/Clientes.jsx src/pages/Materiales.jsx src/pages/PedidosMateriales.jsx src/pages/Inventario.jsx src/pages/Activos.jsx
git commit -m "fix(mobile): overflow-x-auto y headers apilables en páginas de lista"
```

---

## Task 6: Dashboard, Proyectos y Reportes — verificación y ajuste menor

**Archivos:**
- Modify: `src/pages/Dashboard.jsx` (ajuste menor)
- Modify: `src/pages/Proyectos.jsx` (ajuste menor)
- Modify: `src/pages/Reportes.jsx` (verificar)

**Dashboard** ya tiene `overflow-x-auto` en tablas y `grid gap-4 md:grid-cols-2 lg:grid-cols-4`. Solo ajustar que en móvil el encabezado no corte texto largo.

- [ ] **Step 1: Dashboard — StatCards deben ser 1 columna en móvil, 2 en sm, 4 en lg**

Verificar el grid:
```jsx
// Debe ser:
<div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
```

- [ ] **Step 2: Dashboard — Proyectos Recientes — columnas "Descripción" y "Avance" pueden ocultarse en móvil pequeño**

Añadir `className="hidden sm:table-cell"` a la columna Descripción del dashboard y mantener solo Folio + Estatus en pantallas < 640px.

- [ ] **Step 3: Proyectos — barra búsqueda + filtros de estatus apilables**

```jsx
// ANTES:
<div className="flex gap-2 items-center">

// DESPUÉS:
<div className="flex flex-col sm:flex-row gap-2 sm:items-center">
```

- [ ] **Step 4: Reportes — verificar que `ResponsiveContainer` de Recharts esté con `width="100%"`**

Si `width` está hardcodeado (ej. `width={600}`), cambiar a `width="100%"`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Dashboard.jsx src/pages/Proyectos.jsx src/pages/Reportes.jsx
git commit -m "fix(mobile): ajustes menores en Dashboard, Proyectos y Reportes"
```

---

## Task 7: CRM Prospectos — Kanban y filtros de marca

**Archivos:**
- Modify: `src/components/crm/ProspectoKanban.jsx`
- Modify: `src/pages/Prospectos.jsx`

**Problema:** Las columnas del Kanban tienen `min-w-[180px]` con scroll horizontal, que es funcional pero en pantallas muy pequeñas (360px) se ven 1.8 columnas cortadas. Los filtros de marca en Prospectos.jsx no tienen `flex-wrap` visible en pantallas pequeñas.

- [ ] **Step 1: ProspectoKanban — reducir min-width y añadir indicador de scroll**

```jsx
// ANTES:
<div className="flex gap-3 overflow-x-auto pb-2">
  {COLUMNAS.map((col) => (
    <div key={col.id} className="flex-1 min-w-[180px]">

// DESPUÉS:
<div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory">
  {COLUMNAS.map((col) => (
    <div key={col.id} className="flex-none w-[260px] sm:flex-1 sm:min-w-[180px] snap-start">
```

En móvil cada columna ocupa 260px completo y hace snap al swipe. En desktop sigue siendo `flex-1` con min-w.

- [ ] **Step 2: Prospectos.jsx — asegurar flex-wrap en filtros de marca**

Buscar el contenedor con los botones de marcas y añadir `flex-wrap`:
```jsx
// Verificar que ya tiene flex-wrap, si no:
<div className="flex flex-wrap gap-2">
  {/* botones de marcas */}
</div>
```

- [ ] **Step 3: Prospectos.jsx — encabezado apilable**

```jsx
// ANTES:
<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
// (Este ya está bien — verificar y mantener)
```

- [ ] **Step 4: Commit**

```bash
git add src/components/crm/ProspectoKanban.jsx src/pages/Prospectos.jsx
git commit -m "fix(mobile): kanban con snap-scroll y filtros con flex-wrap en Prospectos"
```

---

## Verificación final

- [ ] Abrir app en Chrome DevTools → Toggle device toolbar → iPhone SE (375px)
- [ ] Navegar por cada sección del menú y verificar:
  - [ ] Sidebar: ícono + etiqueta visibles al abrir
  - [ ] Dashboard: cards en 1 columna, tablas con scroll
  - [ ] Finanzas: filtros apilados, tablas con scroll
  - [ ] Cotizaciones: búsqueda + filtros apilados
  - [ ] Clientes: lista correcta
  - [ ] Proyectos: filtros apilados
  - [ ] Materiales: tabla con scroll
  - [ ] Pedidos: tabla con scroll
  - [ ] ControlPersonal: grilla semanal con scroll
  - [ ] Prospectos / Kanban: swipe entre columnas
  - [ ] Reportes: gráficas responsivas
- [ ] Verificar en desktop 1440px que NADA rompió

---

## Auto-review del plan

**Spec coverage:**
- ✅ Sidebar labels en móvil → Task 1
- ✅ Tablas con overflow → Tasks 2-6
- ✅ Filtros apilables → Tasks 2-6
- ✅ ControlPersonal grilla → Task 4
- ✅ Kanban → Task 7
- ✅ Funcionalidad web intacta → cada task especifica que solo se agregan clases responsive sin cambiar lógica

**Placeholder scan:** Ninguno.

**Type consistency:** Solo clases Tailwind y estructura JSX — consistente en todos los tasks.
