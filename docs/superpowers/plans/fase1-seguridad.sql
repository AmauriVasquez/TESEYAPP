-- ============================================================================
-- FASE 1 — Cierre crítico de seguridad · Tesey App (project czbmqzimjlwwgcglubey)
-- Estado: PREPARADO, NO EJECUTADO. Pegar por bloques en el SQL Editor de Supabase.
-- Reversible. Ejecutar en horario diurno (con margen para rollback), tras backup/snapshot.
--
-- Verificado antes de escribir esto:
--   * Ninguna función está concedida SOLO a anon → revocar a anon NO rompe el front.
--   * El front usa el rol `authenticated`; el Login usa solo la API de Auth (sin RPC anon).
--   * delete_project_and_related_data y get_users_with_email NO se llaman en el front.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BLOQUE 0 — Verificación PRE (solo lectura, no cambia nada). Guarda estos números.
-- ----------------------------------------------------------------------------
-- 0.1 Confirmar que las 2 huérfanas siguen expuestas a anon (esperado: 2 filas)
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_project_and_related_data', 'get_users_with_email');

-- 0.2 Cuántas funciones son ejecutables por anon hoy (guarda el número para comparar después)
select count(*) as funcs_anon_exec
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'EXECUTE');

-- 0.3 Doble-check: ¿alguna función es anon-only? (esperado: 0 filas. Si NO es 0, PARAR.)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'EXECUTE')
  and not has_function_privilege('authenticated', p.oid, 'EXECUTE');


-- ----------------------------------------------------------------------------
-- BLOQUE 1 — DROP de las 2 funciones huérfanas (sin uso, sin guardia, expuestas a anon)
--   Rollback: los CREATE originales están al final de este archivo (sección ROLLBACK).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.delete_project_and_related_data(integer);
DROP FUNCTION IF EXISTS public.get_users_with_email();


-- ----------------------------------------------------------------------------
-- BLOQUE 2 — Quitar EXECUTE a anon en TODO el esquema public.
--   Las funciones admin ya validan es_admin_maestro() por dentro; esto es defensa en
--   profundidad: el rol anónimo no debería poder invocar NADA de la API RPC.
--   authenticated conserva sus permisos → el front sigue igual.
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Que las funciones FUTURAS tampoco se auto-concedan a anon (Supabase las concede por defecto).
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;


-- ----------------------------------------------------------------------------
-- BLOQUE 3 — Verificación POST (solo lectura). Comparar contra el BLOQUE 0.
-- ----------------------------------------------------------------------------
-- 3.1 Las 2 huérfanas ya no existen (esperado: 0 filas)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('delete_project_and_related_data', 'get_users_with_email');

-- 3.2 Ninguna función ejecutable por anon (esperado: 0)
select count(*) as funcs_anon_exec_despues
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and has_function_privilege('anon', p.oid, 'EXECUTE');

-- 3.3 Sanity: authenticated CONSERVA acceso a una RPC que el front usa (esperado: true)
select has_function_privilege('authenticated', 'public.get_mi_contexto()', 'EXECUTE') as auth_ok;

-- >>> DESPUÉS de este bloque: entrar a la app como usuario normal y recorrer
-- >>> Proyectos, Finanzas y Compras. Si todo carga, la Fase 1 quedó bien.


-- ----------------------------------------------------------------------------
-- BLOQUE 4 — (En el Dashboard de Supabase, NO es SQL)
--   Authentication → Providers/Policies → activar "Leaked password protection"
--   (chequeo contra HaveIBeenPwned). Rollback: desactivar el toggle.
-- ----------------------------------------------------------------------------


-- ============================================================================
-- ROLLBACK (solo si algo se rompe)
-- ============================================================================
-- Revertir BLOQUE 2:
--   GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
--
-- Revertir BLOQUE 1 (recrear las funciones tal como estaban):
--
-- CREATE OR REPLACE FUNCTION public.get_users_with_email()
--  RETURNS TABLE(id uuid, email text) LANGUAGE sql SECURITY DEFINER
-- AS $function$ SELECT id, email::text FROM auth.users; $function$;
--
-- CREATE OR REPLACE FUNCTION public.delete_project_and_related_data(p_project_id integer)
--  RETURNS void LANGUAGE plpgsql SECURITY DEFINER
-- AS $function$
-- DECLARE v_cotizacion_id integer; v_archivos_paths text[];
-- BEGIN
--   SELECT cotizacion_id INTO v_cotizacion_id FROM public.proyectos WHERE id = p_project_id;
--   SELECT array_agg(path_tokens[1] || '/' || path_tokens[2]) INTO v_archivos_paths
--     FROM storage.objects WHERE bucket_id = 'proyecto_archivos' AND path_tokens[1] = p_project_id::text;
--   DELETE FROM public.proyecto_bitacora WHERE proyecto_id = p_project_id;
--   DELETE FROM public.proyecto_archivos WHERE proyecto_id = p_project_id;
--   DELETE FROM public.proyecto_materiales WHERE proyecto_id = p_project_id;
--   DELETE FROM public.proyecto_aprobaciones WHERE proyecto_id = p_project_id;
--   DELETE FROM public.pedidos_materiales_items WHERE pedido_id IN
--     (SELECT id FROM public.pedidos_materiales WHERE proyecto_id = p_project_id);
--   DELETE FROM public.pedidos_materiales WHERE proyecto_id = p_project_id;
--   DELETE FROM public.proyectos WHERE id = p_project_id;
--   IF v_cotizacion_id IS NOT NULL THEN
--     DELETE FROM public.cotizaciones_items WHERE cotizacion_id = v_cotizacion_id;
--     DELETE FROM public.cotizaciones WHERE id = v_cotizacion_id;
--   END IF;
--   IF v_archivos_paths IS NOT NULL AND array_length(v_archivos_paths, 1) > 0 THEN
--     DELETE FROM storage.objects WHERE bucket_id = 'proyecto_archivos' AND name = ANY(v_archivos_paths);
--   END IF;
-- END; $function$;
-- ============================================================================
