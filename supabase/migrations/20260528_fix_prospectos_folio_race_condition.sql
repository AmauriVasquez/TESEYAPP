-- Fix: race condition en generación de folio para prospectos
--
-- Root cause: la función crm_generar_folio_prospecto usaba MAX+1 con un loop de
-- verificación posterior. En inserts concurrentes (READ COMMITTED), dos transacciones
-- podían calcular el mismo MAX+1 antes de que cualquiera hiciera commit, pasando
-- ambas el loop check y produciendo un folio duplicado al momento del INSERT.
--
-- Fix: pg_advisory_xact_lock serializa la generación de folios por marca.
-- El lock se libera automáticamente al finalizar la transacción.

CREATE OR REPLACE FUNCTION public.crm_generar_folio_prospecto()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_num integer;
  v_folio text;
  v_attempts integer := 0;
  v_lock_key bigint;
BEGIN
  IF new.folio IS NULL OR new.folio = '' THEN
    -- Lock exclusivo por marca para serializar inserts concurrentes.
    -- Sin esto, dos transacciones simultáneas calculan el mismo MAX+1 antes
    -- de que cualquiera haga commit, produciendo folio duplicado.
    v_lock_key := hashtext('prospecto_folio_' || lower(COALESCE(new.marca_origen, 'default')));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT COALESCE(
      MAX(
        CASE WHEN folio ~ ('^PRO-' || UPPER(new.marca_origen) || '-[0-9]+$')
        THEN substring(folio FROM '[0-9]+$')::integer
        END
      ),
      0
    ) + 1 INTO v_num
    FROM public.prospectos
    WHERE marca_origen = new.marca_origen;

    LOOP
      v_folio := 'PRO-' || UPPER(new.marca_origen) || '-' || LPAD(v_num::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.prospectos WHERE folio = v_folio);
      v_num := v_num + 1;
      v_attempts := v_attempts + 1;
      IF v_attempts > 100 THEN
        RAISE EXCEPTION 'No se pudo generar un folio único para prospecto marca=%', new.marca_origen;
      END IF;
    END LOOP;

    new.folio := v_folio;
  END IF;
  RETURN new;
END;
$function$;
