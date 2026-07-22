-- supabase/migrations/2026-07-22c_productos_cliente_multi_material_servicio.sql
-- Una pieza puede usar varios materiales y varios servicios (ej. corte
-- láser + pintura electrostática), así que material_id/servicio_id (uno
-- solo) se reemplazan por arreglos. catalogo_productos_cliente no tiene
-- filas reales todavía (solo pruebas ya borradas), así que se puede
-- reemplazar directo sin migrar datos.
-- ponytail: sin FK sobre los elementos del arreglo (Postgres no lo soporta
-- de forma nativa); la integridad la controla el combo en el front. Si
-- llegan a aparecer ids huérfanos, mover a tablas puente sería el upgrade.

ALTER TABLE public.catalogo_productos_cliente
  DROP COLUMN material_id,
  DROP COLUMN servicio_id;

ALTER TABLE public.catalogo_productos_cliente
  ADD COLUMN material_ids integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN servicio_ids integer[] NOT NULL DEFAULT '{}';
