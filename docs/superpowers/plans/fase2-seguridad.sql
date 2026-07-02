-- ============================================================================
-- FASE 2 — Frontera interna (atacante = empleado) · Tesey App (czbmqzimjlwwgcglubey)
-- Estado: 2a y 2b APLICADAS 2026-07-02. 2c (usuarios_select) DIFERIDA (ver nota).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2a — search_path fijado en las 5 funciones SECURITY DEFINER que faltaban. [APLICADO]
--   Cierra el vector de escalada por "shadowing". Cero cambio de comportamiento.
--   Rollback: ALTER FUNCTION ... RESET search_path; (no recomendado)
-- ----------------------------------------------------------------------------
ALTER FUNCTION public.calcular_todos_kpis()                   SET search_path = pg_catalog, public;
ALTER FUNCTION public.crm_autoconvertir_al_aprobar()          SET search_path = pg_catalog, public;
ALTER FUNCTION public.crm_convertir_prospecto(uuid, integer)  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_user_role(uuid)                     SET search_path = pg_catalog, public;
ALTER FUNCTION public.snapshot_diario_kpis()                  SET search_path = pg_catalog, public;

-- ----------------------------------------------------------------------------
-- 2b — auditoria_accesos: el INSERT ya no acepta usuario_id arbitrario. [APLICADO]
--   Antes: WITH CHECK true (cualquiera falsificaba eventos). Ahora: solo a nombre propio.
--   Las funciones admin (SECURITY DEFINER, owner=postgres) siguen escribiendo: saltan RLS.
--   Rollback: ALTER POLICY aud_insert ON public.auditoria_accesos WITH CHECK (true);
-- ----------------------------------------------------------------------------
ALTER POLICY aud_insert ON public.auditoria_accesos WITH CHECK (usuario_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 2c — usuarios_select (fuga de PII interna). DIFERIDA — decisión de negocio.
--   Hoy: cualquier authenticated lee TODOS los usuarios activos, incl. telefono y correo.
--   El front necesita id + nombre_completo + rol de todos en ~10 componentes (dropdowns
--   de asignación, responsable de proyecto, vendedor en cotización) → NO se puede bloquear
--   sin romperlos. Lo único realmente sensible que se filtra es telefono + correo.
--   Con 7 empleados internos que se conocen, el riesgo real es bajo HOY.
--   Fix correcto (a nivel COLUMNA, no fila) = Fase 4: exponer id/nombre/rol a todos y
--   restringir telefono/correo a self+admin. Se hace cuando escale a más usuarios.
-- ============================================================================
