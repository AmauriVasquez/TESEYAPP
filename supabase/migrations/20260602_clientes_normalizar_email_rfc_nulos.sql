-- Causa raiz: clientes_email_key es UNIQUE(email). Cuando se marca "No aplica"
-- (o se deja vacio) el front guardaba email = '' (cadena vacia). En Postgres
-- multiples NULL son distintos en un UNIQUE, pero las cadenas vacias NO: el
-- segundo cliente sin correo chocaba -> 23505 -> PostgREST 409.
--
-- Solucion definitiva en la capa de datos: normalizar email/rfc vacios a NULL
-- en CUALQUIER ruta de escritura (formulario ClienteDialog, RPC
-- crm_convertir_prospecto, importaciones, API directa). Se conserva el UNIQUE
-- para correos reales (higiene de datos: no duplicar clientes por correo).

-- 1) Backfill de datos existentes: cadenas vacias -> NULL
UPDATE public.clientes
SET email = NULL
WHERE email IS NOT NULL AND btrim(email) = '';

UPDATE public.clientes
SET rfc = NULL
WHERE rfc IS NOT NULL AND btrim(rfc) = '';

-- 2) Trigger de normalizacion (defensa en profundidad)
CREATE OR REPLACE FUNCTION public.clientes_normalizar_campos_opcionales()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  -- email: vacio/espacios -> NULL ; en otro caso recortar espacios
  IF NEW.email IS NOT NULL THEN
    NEW.email := NULLIF(btrim(NEW.email), '');
  END IF;

  -- rfc: vacio/espacios -> NULL ; en otro caso recortar espacios
  IF NEW.rfc IS NOT NULL THEN
    NEW.rfc := NULLIF(btrim(NEW.rfc), '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_normalizar_campos ON public.clientes;
CREATE TRIGGER trg_clientes_normalizar_campos
  BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.clientes_normalizar_campos_opcionales();
