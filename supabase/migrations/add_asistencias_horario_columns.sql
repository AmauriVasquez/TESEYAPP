-- Columnas de horario diario por registro de asistencia (E, S, E, S).
-- Ejecutar solo si la tabla asistencias no tiene estas columnas.
-- Nombres exactos: hora_entrada, hora_comida_salida, hora_comida_entrada, hora_salida.
ALTER TABLE asistencias
  ADD COLUMN IF NOT EXISTS hora_entrada text,
  ADD COLUMN IF NOT EXISTS hora_comida_salida text,
  ADD COLUMN IF NOT EXISTS hora_comida_entrada text,
  ADD COLUMN IF NOT EXISTS hora_salida text;

COMMENT ON COLUMN asistencias.hora_entrada IS 'Entrada (HH:mm) del día';
COMMENT ON COLUMN asistencias.hora_comida_salida IS 'Salida a comida (HH:mm)';
COMMENT ON COLUMN asistencias.hora_comida_entrada IS 'Regreso de comida (HH:mm)';
COMMENT ON COLUMN asistencias.hora_salida IS 'Salida (HH:mm) del día';
