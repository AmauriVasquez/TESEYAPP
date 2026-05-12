-- Vincular pedidos de materiales a proyectos (para "Pedir Materiales" desde detalle de proyecto).
-- Ejecutar en SQL Editor de Supabase si la columna no existe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'pedidos_materiales' AND column_name = 'proyecto_id'
  ) THEN
    ALTER TABLE public.pedidos_materiales
    ADD COLUMN proyecto_id integer REFERENCES public.proyectos(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_pedidos_materiales_proyecto_id ON public.pedidos_materiales(proyecto_id);
    RAISE NOTICE 'Columna proyecto_id agregada a pedidos_materiales.';
  ELSE
    RAISE NOTICE 'La columna proyecto_id ya existe en pedidos_materiales.';
  END IF;
END $$;
