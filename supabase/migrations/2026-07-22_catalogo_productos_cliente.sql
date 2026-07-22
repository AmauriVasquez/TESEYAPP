-- supabase/migrations/2026-07-22_catalogo_productos_cliente.sql
-- Catálogo de piezas específicas por cliente: código del cliente + código
-- interno propio (iniciales + consecutivo) + precio de referencia, para
-- dejar de escribir la descripción a mano y cobrar siempre lo mismo por
-- la misma pieza. producto_cliente_id en cotizaciones_items da trazabilidad
-- (historial de uso por pieza) sin depender de que el catálogo siga vivo.

CREATE TABLE public.catalogo_productos_cliente (
  id serial PRIMARY KEY,
  cliente_id integer NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  codigo_cliente text,
  codigo_interno text NOT NULL,
  descripcion text NOT NULL,
  unidad text,
  precio_unitario numeric(12,2),
  material_id integer REFERENCES public.materiales(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_productos_cliente_codigo_interno_key UNIQUE (codigo_interno)
);

CREATE INDEX idx_catalogo_productos_cliente_cliente_id
  ON public.catalogo_productos_cliente (cliente_id);

ALTER TABLE public.catalogo_productos_cliente ENABLE ROW LEVEL SECURITY;

CREATE POLICY cpc_select ON public.catalogo_productos_cliente
  FOR SELECT USING (true);

CREATE POLICY cpc_write ON public.catalogo_productos_cliente
  FOR ALL
  USING (public.tiene_permiso('cotizaciones', 'editar'))
  WITH CHECK (public.tiene_permiso('cotizaciones', 'editar'));

ALTER TABLE public.cotizaciones_items
  ADD COLUMN producto_cliente_id integer
    REFERENCES public.catalogo_productos_cliente(id) ON DELETE SET NULL;

CREATE INDEX idx_cotizaciones_items_producto_cliente_id
  ON public.cotizaciones_items (producto_cliente_id)
  WHERE producto_cliente_id IS NOT NULL;
