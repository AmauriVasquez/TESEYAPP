-- Columna para indicar si el empleado aplica para toma de asistencia (pasa lista).
-- Si no existe, ejecutar en SQL Editor de Supabase.

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS requiere_asistencia BOOLEAN DEFAULT true;

COMMENT ON COLUMN empleados.requiere_asistencia IS 'Si true, el empleado aparece en la lista de asistencia (pasa lista).';

NOTIFY pgrst, 'reload schema';
