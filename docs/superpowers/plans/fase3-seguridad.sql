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
-- 3b — Vistas definer → security_invoker. PENDIENTE (cambia comportamiento interno).
--   Hoy los roles internos ven TODO por estas vistas (saltan su RLS). Con invoker
--   respetarían permisos. Solo v_proyecto_pago_progreso la usa el front (Finanzas);
--   las otras 3 están huérfanas. Requiere baseline POR ROL antes de flipear.
--   Baseline total (postgres) 2026-07-02: entregas_resumen=69, v_cotizaciones_analitica=262,
--   material_costos_historial=0, v_proyecto_pago_progreso=171.
--   Propuesta: ALTER VIEW public.v_proyecto_pago_progreso SET (security_invoker=on);
--   (y probar Finanzas con un usuario COMPRAS_FACTURACION / no-admin).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 3c — Tablas RLS-on + 0 políticas (deny-all). PENDIENTE (bug funcional + seguridad).
--   catalogo_servicios (6 filas) lo usa el front (CRUD en CatalogoServicios.jsx) pero
--   deny-all → la app NO ve los servicios hoy. empresa_folios (3 filas) = contadores.
--   Fix propuesto (dar de alta política de lectura para authenticated; escritura por permiso):
--     ALTER TABLE public.catalogo_servicios ENABLE ROW LEVEL SECURITY; -- ya está
--     CREATE POLICY cs_select ON public.catalogo_servicios FOR SELECT TO authenticated USING (true);
--     CREATE POLICY cs_write  ON public.catalogo_servicios FOR ALL   TO authenticated
--       USING (tiene_permiso('cotizaciones','editar')) WITH CHECK (tiene_permiso('cotizaciones','editar'));
--   (empresa_folios: probablemente solo lectura para authenticated; confirmar uso.)
-- ============================================================================
