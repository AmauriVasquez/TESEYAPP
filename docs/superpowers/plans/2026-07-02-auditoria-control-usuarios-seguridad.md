# Auditoría de Control de Usuarios y Seguridad — Tesey App

Fecha: 2026-07-02 · Estado: **análisis, sin cambios aplicados** · Validado con: llm-council (5 asesores + peer review)

> Regla del usuario: no ejecutar ningún cambio hasta estar seguros de que resolvemos los
> problemas de seguridad. Este documento es el plan; cada fase se aplica manualmente en el
> SQL Editor de Supabase (project `czbmqzimjlwwgcglubey`) tras backup.

---

## 1. Cómo funciona hoy el control de usuarios

- **Roles** (`public.usuarios.app_rol`, enum `app_role`): ADMIN_MAESTRO, ADMIN_VISUAL,
  VENTAS, COMPRAS_FACTURACION, RH_ALMACEN, SUPERVISOR_CAMPO, OPERADOR.
- **Permisos base por rol**: en SQL `permiso_por_defecto_rol(rol, modulo, accion, submodulo)`.
- **Overrides por usuario**: tabla `usuario_permisos` (ver/crear/editar/eliminar/exportar/autorizar
  + `campos_ocultos[]`).
- **Autoridad real de autorización**: `tiene_permiso(modulo, accion, submodulo)` — SECURITY
  DEFINER, `search_path` fijado — es la que usan las **políticas RLS** de cada tabla.
- **Espejo en el front**: `src/contexts/PermissionsContext.jsx` (`ROLE_PERMISSIONS`) — **solo UX**,
  no es frontera de seguridad. Se mantiene en sync a mano con el SQL.
- **Panel admin**: `src/pages/AdminUsuarios.jsx` → RPCs `admin_*` (crear/rol/toggle/permiso),
  todas con guardia interna `es_admin_maestro()`. Solo ADMIN_MAESTRO entra.
- **Rutas**: `ProtectedRoute` en `App.jsx` filtra por `can(modulo, accion)`.

**Lo que está bien:** RLS activo en las 54 tablas; las RPCs admin validan `es_admin_maestro()`
internamente (no se puede escalar por ellas aunque el advisor las marque); las funciones-guardia
tienen `search_path` fijado; no permites cambiar tu propio rol ni auto-desactivarte.

---

## 2. Hallazgos (verificados contra la BD en prod)

### CRÍTICO
1. **`delete_project_and_related_data(p_project_id)`** — SECURITY DEFINER, **sin guardia**,
   **sin `search_path`**, ejecutable por `anon` y `authenticated`. Borra proyecto + cotización +
   archivos de storage. **No se llama desde el front (huérfana).** Cualquiera con la anon key
   (pública en el bundle) podría borrar proyectos vía `/rest/v1/rpc/`.
2. **`get_users_with_email()`** — SECURITY DEFINER, **sin guardia**, ejecutable por `anon`.
   Devuelve **todos** los correos de `auth.users`. Huérfana. Fuga de PII no autenticada.

### ALTO
3. **`usuarios_select`**: cualquier usuario autenticado lee **todos** los usuarios activos
   (nombre, correo, teléfono, rol). Atacante realista = empleado interno, no anon.
4. **`auditoria_accesos` — INSERT `WITH CHECK true`** y además **la tabla está vacía**: el log
   nunca ha registrado nada y es falsificable por cualquier autenticado. No hay rastro forense.
5. **7 funciones SECURITY DEFINER sin `search_path`**: `delete_project_and_related_data`,
   `get_users_with_email`, `get_user_role`, `crm_convertir_prospecto`,
   `crm_autoconvertir_al_aprobar`, `calcular_todos_kpis`, `snapshot_diario_kpis`.

### MEDIO
6. **4 vistas SECURITY DEFINER**: `entregas_resumen`, `v_cotizaciones_analitica`,
   `material_costos_historial`, `v_proyecto_pago_progreso` — evalúan con permisos del dueño,
   saltándose la RLS del usuario que consulta. Requiere revisar caso por caso (finanzas).
7. **2 tablas RLS activo + 0 políticas** (deny-all silencioso): `catalogo_servicios`,
   `empresa_folios`. Confirmar que no rompen lecturas legítimas.
8. **Protección de contraseñas filtradas (HaveIBeenPwned) desactivada** en Auth.

### ESTRUCTURAL (deuda, no exploit)
9. **Permisos duplicados** SQL (`permiso_por_defecto_rol`) + JS (`ROLE_PERMISSIONS`), sync manual → drift.
10. **Sin staging, sin CI, sin tests, una sola BD de prod, deploy por FTP manual.** No hay red
    de seguridad ni "undo" antes de tocar prod.
11. **La anon key es pública** (normal en Supabase) pero **no rotable sin coste**: revocar EXECUTE
    no invalida una key ya filtrada. La seguridad depende 100% de que la RLS sea correcta.

---

## 3. Veredicto del council (síntesis)

- **Acuerdo:** el plan va en la dirección correcta pero **empieza en el paso equivocado**.
  Primero forense + backup, luego cambios por lotes según radio de impacto, no todo de golpe.
- **Punto ciego que todos señalaron:** el atacante realista es un **empleado** (hallazgo #3),
  no `anon`. Y nadie puede probar si las huérfanas ya se explotaron porque el audit log está vacío.
- **Corrección técnica:** las funciones-guardia SÍ tienen `search_path` fijado → la escalada por
  "shadowing" no aplica a ellas. El riesgo de `search_path` queda en las 7 funciones del hallazgo #5.
- **Descartado por ahora:** multi-tenant/SaaS (altitud equivocada mientras haya huecos abiertos)
  y refactor de la duplicación SQL/JS (cosmético, no urgente).

---

## 4. Plan por fases (aplicar en orden, con verificación entre cada una)

### Fase 0 — Red de seguridad y forense (antes de tocar nada)
- [ ] Confirmar que **PITR / backups** de Supabase están activos; tomar snapshot manual.
- [ ] Revisar **logs de Postgres** (retención Supabase) buscando llamadas a las 2 huérfanas.
- [ ] Guardar el `CREATE` de las 2 funciones antes de dropearlas (ya capturado en esta sesión).
- [ ] Rotar credenciales de FTP/Hosting y revisar dónde vive la `service_role` key.

### Fase 1 — Cierre crítico, reversible, cero cambio de comportamiento del front
- [ ] `DROP FUNCTION delete_project_and_related_data`, `get_users_with_email` (huérfanas).
- [ ] `REVOKE EXECUTE ... FROM anon` en las RPCs (el front usa `authenticated`, no `anon`).
- [ ] Activar leaked-password protection (toggle en Auth, rollback instantáneo).
- [ ] Verificar: entrar a la app como usuario normal, recorrer 3 módulos pesados.

### Fase 2 — Frontera interna (empleado como atacante)
- [ ] Restringir `usuarios_select`: exponer solo lo necesario para el directorio (o `es_admin()`
      + vista mínima para selects de asignación).
- [ ] `auditoria_accesos`: INSERT `WITH CHECK (usuario_id = auth.uid())`; y hacer que el log
      realmente se escriba (hoy está vacío).
- [ ] `ALTER FUNCTION ... SET search_path = pg_catalog, public` en las 7 funciones del hallazgo #5.

### Fase 3 — Vistas y tablas sin política (una a la vez, con baseline)
- [ ] Por cada vista SECURITY DEFINER: capturar conteo de filas como usuario de prueba,
      recrear como `security_invoker`, re-verificar conteo. Si baja → hay hueco de RLS real, parar.
- [ ] Definir política explícita (o quitar RLS) en `catalogo_servicios`, `empresa_folios`.

### Fase 4 — Control granular "qué ve cada usuario" (lo que pediste)
- [ ] `campos_ocultos` ya existe para finanzas; extender el patrón a los campos sensibles de
      cada módulo y hacerlo visible/editable en AdminUsuarios.
- [ ] Una sola fuente de verdad de permisos: generar el mapa JS desde el SQL (o consumir
      `get_mi_contexto`) para eliminar el drift del hallazgo #9.

### Fase 5 — Escala a miles de usuarios (habilitadores, no urgente)
- [ ] `verify.sql`: script que relista advisors (definers huérfanos, RLS sin política,
      EXECUTE a anon) y correrlo antes de cada deploy — el "staging" que falta, 15 líneas.
- [ ] Índices en columnas de filtro RLS de tablas grandes; medir `tiene_permiso` bajo carga.
- [ ] Considerar entorno de staging + una migración versionada (dejar de pegar SQL a mano).

---

## 5. Puntos muertos (dead points) a decidir contigo
- ¿Rotamos la anon key o asumimos que la RLS corregida es suficiente?
- ¿El audit log vacío es porque nunca se pobló o porque se limpió? Decide si es bug o esperado.
- ¿Obligación de notificación de brecha si confirmamos que la fuga de PII se explotó?
