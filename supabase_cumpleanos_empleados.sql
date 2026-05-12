-- Migración: columnas para cumpleaños y sincronización con Google Calendar (empleados)
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE empleados ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE empleados ADD COLUMN IF NOT EXISTS google_calendar_cumple_id TEXT;

COMMENT ON COLUMN empleados.fecha_nacimiento IS 'Fecha de nacimiento para eventos de cumpleaños en el calendario';
COMMENT ON COLUMN empleados.google_calendar_cumple_id IS 'ID del evento de cumpleaños del año en curso en Google Calendar';

NOTIFY pgrst, 'reload schema';
