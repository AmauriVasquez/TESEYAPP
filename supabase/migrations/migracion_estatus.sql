-- =============================================================================
-- Migración: Unificar flujo en estatus (eliminar columna fase)
-- Ejecutar en Supabase SQL Editor.
-- =============================================================================

-- 1. Migrar valores de fase a estatus para proyectos "En Proceso"
--    (conservamos el paso detallado: Solicitud de Materiales, En Proceso, etc.)
UPDATE proyectos
SET estatus = fase
WHERE estatus = 'En Proceso' AND fase IS NOT NULL AND fase != '';

-- 2. Eliminar la columna fase
ALTER TABLE proyectos DROP COLUMN IF EXISTS fase;
