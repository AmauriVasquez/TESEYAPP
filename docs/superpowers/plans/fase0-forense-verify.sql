-- ============================================================================
-- FASE 0 — Paracaídas: forense + verify.sql · Tesey App (czbmqzimjlwwgcglubey)
-- Estado: forense corrido 2026-07-02 (solo lectura). verify.sql = chequeo reutilizable.
-- Correr ANTES de la Fase 1. Nada aquí modifica datos.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. BACKUP (fuera de SQL) — hacer ANTES de la Fase 1:
--    Dashboard Supabase → Database → Backups. Confirmar PITR activo y tomar snapshot.
--    Sin esto, la Fase 1 no tiene "undo" de datos (el DDL sí es reversible; los datos no).
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- B. BASELINE forense — capturado 2026-07-02 (guardar para comparar):
--    proyectos = 171 · cotizaciones = 275 · usuarios = 7 (7 activos)
--    Vistas: entregas_resumen=69 · v_cotizaciones_analitica=262
--            material_costos_historial=0 · v_proyecto_pago_progreso=171
--    Si tras cualquier fase estos números BAJAN sin que tú borraras algo → alarma.
-- ----------------------------------------------------------------------------
select 'proyectos' t, count(*) n from public.proyectos
union all select 'cotizaciones', count(*) from public.cotizaciones
union all select 'usuarios', count(*) from public.usuarios;

-- ----------------------------------------------------------------------------
-- C. ¿Evidencia de explotación previa de las 2 huérfanas?
--    Nota honesta: get_logs del MCP y pg_stat tienen retención corta; NO prueban
--    meses atrás. Para forense real: Dashboard → Logs → Postgres, filtrar por
--    'delete_project_and_related_data' y 'get_users_with_email' en el rango disponible.
--    auditoria_accesos está VACÍA (el log nunca pobló) → no hay rastro propio.
-- ----------------------------------------------------------------------------
select count(*) as eventos_auditoria from public.auditoria_accesos;


-- ============================================================================
-- verify.sql — CHEQUEO DE SALUD DE SEGURIDAD (correr antes/después de cada deploy)
-- Todo debe volver 0 filas / los valores esperados. Si algo aparece, hay un hueco.
-- ============================================================================

-- V1. Funciones ejecutables por anon (esperado tras Fase 1: 0)
select 'anon_exec' chk, p.proname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prokind='f'
  and has_function_privilege('anon', p.oid, 'EXECUTE');

-- V2. Funciones SECURITY DEFINER sin search_path fijado (esperado tras Fase 2: 0)
select 'definer_sin_searchpath' chk, p.proname
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.prosecdef
  and (p.proconfig is null or array_to_string(p.proconfig,',') not like '%search_path%');

-- V3. Vistas SECURITY DEFINER (esperado tras Fase 3: 0)
select 'vista_definer' chk, c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='v'
  and exists (select 1 from pg_rewrite r where r.ev_class=c.oid
              and pg_get_viewdef(c.oid) is not null)
  and c.reloptions::text like '%security_invoker=%' = false;  -- vistas sin security_invoker

-- V4. Tablas con RLS activo y CERO políticas (deny-all silencioso)
select 'rls_sin_policy' chk, c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname)=0;

-- V5. Tablas SIN RLS (nunca debería haber en public con datos)
select 'sin_rls' chk, c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity;
