-- Fix: los permisos por usuario "no se guardaban".
-- Causa raíz: UNIQUE (usuario_id, modulo, submodulo) trata NULL como distinto,
-- así que con submodulo NULL el ON CONFLICT de admin_set_permiso nunca disparaba
-- y cada guardado INSERTABA una fila nueva. tiene_permiso hace LIMIT 1 sin ORDER BY
-- y leía la fila vieja (editar=false), por eso el cambio "no se aplicaba".

-- 1) Eliminar duplicados: conservar la fila más reciente por (usuario_id, modulo, submodulo)
DELETE FROM public.usuario_permisos a
USING public.usuario_permisos b
WHERE a.usuario_id = b.usuario_id
  AND a.modulo = b.modulo
  AND a.submodulo IS NOT DISTINCT FROM b.submodulo
  AND a.id <> b.id
  AND (a.updated_at < b.updated_at
       OR (a.updated_at = b.updated_at AND a.id < b.id));

-- 2) Recrear el UNIQUE tratando NULL como igual (Postgres 15+),
--    con esto el ON CONFLICT existente pasa a actualizar en vez de insertar.
ALTER TABLE public.usuario_permisos
  DROP CONSTRAINT usuario_permisos_unique;

ALTER TABLE public.usuario_permisos
  ADD CONSTRAINT usuario_permisos_unique
  UNIQUE NULLS NOT DISTINCT (usuario_id, modulo, submodulo);

-- Verificación: debe regresar 0 filas
SELECT usuario_id, modulo, submodulo, count(*)
FROM public.usuario_permisos
GROUP BY 1, 2, 3
HAVING count(*) > 1;
