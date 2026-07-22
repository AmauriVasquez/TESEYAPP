-- supabase/migrations/2026-07-22b_productos_cliente_observaciones_servicio.sql
-- Dos campos que faltaban en catalogo_productos_cliente:
-- - observaciones: comentario libre sobre la pieza.
-- - servicio_id: qué servicio del catálogo general (corte láser, pintura
--   electrostática, doblez, etc.) se usa para producirla, para que se
--   pueda arrastrar a la partida de la cotización al cargar la pieza.

ALTER TABLE public.catalogo_productos_cliente
  ADD COLUMN observaciones text,
  ADD COLUMN servicio_id integer REFERENCES public.catalogo_servicios(id) ON DELETE SET NULL;
