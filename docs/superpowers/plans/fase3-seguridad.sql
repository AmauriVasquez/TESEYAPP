-- ============================================================================
-- FASE 3 — Vistas y tablas sin política · Tesey App (czbmqzimjlwwgcglubey)
-- Estado: 3a APLICADA 2026-07-02. 3b y 3c PENDIENTES (decisión / behavior change).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3a — Cerrar lectura ANÓNIMA de vistas. [APLICADO]
--   Hallazgo crítico: 6 vistas eran legibles por anon vía REST. Las 4 SECURITY DEFINER
--   (entregas_resumen, v_cotizaciones_analitica, material_costos_historial,
--   v_proyecto_pago_progreso) saltaban RLS → fuga financiera sin login. Más 2 que el
--   advisor NO listó: finanzas_ingresos (pagos) y usuarios_with_email (¡otra vista de
--   correos, huérfana!). Rollback: GRANT SELECT ON <vista> TO anon;
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.entregas_resumen          FROM anon, public;
REVOKE ALL ON public.v_cotizaciones_analitica   FROM anon, public;
REVOKE ALL ON public.material_costos_historial  FROM anon, public;
REVOKE ALL ON public.v_proyecto_pago_progreso   FROM anon, public;
REVOKE ALL ON public.finanzas_ingresos          FROM anon, public;
REVOKE ALL ON public.usuarios_with_email        FROM anon, public;

-- ----------------------------------------------------------------------------
-- 3b — Vistas definer → security_invoker. [APLICADO 2026-07-02]
--   Ahora respetan la RLS del que consulta. v_proyecto_pago_progreso la usa Finanzas;
--   las otras 3 están huérfanas (flip inocuo, limpia el advisor security_definer_view).
--   PENDIENTE VERIFICAR EN APP: abrir Finanzas con un usuario no-admin (COMPRAS_FACTURACION)
--   y confirmar que sigue mostrando datos. Rollback: SET (security_invoker=off).
-- ----------------------------------------------------------------------------
ALTER VIEW public.v_proyecto_pago_progreso  SET (security_invoker = on);
ALTER VIEW public.v_cotizaciones_analitica  SET (security_invoker = on);
ALTER VIEW public.entregas_resumen          SET (security_invoker = on);
ALTER VIEW public.material_costos_historial SET (security_invoker = on);

-- ----------------------------------------------------------------------------
-- 3c — catalogo_servicios: deny-all → lectura authenticated + escritura por permiso. [APLICADO]
--   Arregla el bug (la app no veía sus 6 servicios) y cierra el advisor rls_no_policy.
--   empresa_folios: NO lo usa el front directamente (solo funciones SECURITY DEFINER que
--   saltan RLS) → deny-all es correcto; se deja como está.
--   Rollback: DROP POLICY cs_select, cs_write ON public.catalogo_servicios;
-- ----------------------------------------------------------------------------
CREATE POLICY cs_select ON public.catalogo_servicios FOR SELECT TO authenticated USING (true);
CREATE POLICY cs_write  ON public.catalogo_servicios FOR ALL   TO authenticated
  USING (public.tiene_permiso('cotizaciones','editar'))
  WITH CHECK (public.tiene_permiso('cotizaciones','editar'));
-- ============================================================================
