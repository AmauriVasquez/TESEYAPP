-- =============================================================================
-- Compras 04 — Alias de material por proveedor
-- =============================================================================
-- El catálogo `materiales` es interno y NO debe crecer ni cambiar con los nombres
-- que cada proveedor le da a un material. Este alias guarda, por (material, proveedor),
-- el nombre y la clave que ESE proveedor usa. El item de OC sigue referenciando
-- `material_id`; la UI muestra el alias del proveedor cuando exista.
--
-- Convención: UNIQUE(material_id, proveedor_id); RLS por tiene_permiso('compras',...).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.material_proveedor_alias (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id      integer NOT NULL REFERENCES public.materiales(id) ON DELETE CASCADE,
  proveedor_id     uuid    NOT NULL REFERENCES public.proveedores(id) ON DELETE CASCADE,
  nombre_proveedor text,    -- cómo llama el proveedor a este material
  clave_proveedor  text,    -- código/clave del proveedor para este material
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT material_proveedor_alias_unq UNIQUE (material_id, proveedor_id)
);

COMMENT ON TABLE public.material_proveedor_alias IS
  'Alias por proveedor de un material del catálogo interno. No altera `materiales`.';
COMMENT ON COLUMN public.material_proveedor_alias.nombre_proveedor IS
  'Nombre que el proveedor da al material (se muestra en partidas de OC de ese proveedor).';
COMMENT ON COLUMN public.material_proveedor_alias.clave_proveedor IS
  'Clave/código del proveedor para el material (opcional).';

CREATE INDEX IF NOT EXISTS idx_material_proveedor_alias_material
  ON public.material_proveedor_alias(material_id);
CREATE INDEX IF NOT EXISTS idx_material_proveedor_alias_proveedor
  ON public.material_proveedor_alias(proveedor_id);

-- updated_at automático ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_material_proveedor_alias()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_touch_material_proveedor_alias ON public.material_proveedor_alias;
CREATE TRIGGER trg_touch_material_proveedor_alias
  BEFORE UPDATE ON public.material_proveedor_alias
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_material_proveedor_alias();

-- RLS ------------------------------------------------------------------------
ALTER TABLE public.material_proveedor_alias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mpa_select ON public.material_proveedor_alias;
CREATE POLICY mpa_select ON public.material_proveedor_alias
  FOR SELECT
  USING (public.tiene_permiso('compras', 'ver', 'ordenes'));

DROP POLICY IF EXISTS mpa_insert ON public.material_proveedor_alias;
CREATE POLICY mpa_insert ON public.material_proveedor_alias
  FOR INSERT
  WITH CHECK (public.tiene_permiso('compras', 'crear', 'ordenes'));

DROP POLICY IF EXISTS mpa_update ON public.material_proveedor_alias;
CREATE POLICY mpa_update ON public.material_proveedor_alias
  FOR UPDATE
  USING (public.tiene_permiso('compras', 'editar', 'ordenes'))
  WITH CHECK (public.tiene_permiso('compras', 'editar', 'ordenes'));

DROP POLICY IF EXISTS mpa_delete ON public.material_proveedor_alias;
CREATE POLICY mpa_delete ON public.material_proveedor_alias
  FOR DELETE
  USING (public.tiene_permiso('compras', 'eliminar', 'ordenes'));
