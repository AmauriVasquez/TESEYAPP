-- ============================================================================
-- Prospectos: guardia de conversión + fix del prospecto huérfano "DR CANUL ANDRADE"
-- ============================================================================
--
-- Contexto:
--   ProspectoDialog permitía marcar etapa='convertido' con un UPDATE plano que NO
--   llamaba crm_convertir_prospecto, dejando el prospecto en 'convertido' sin
--   cliente (cliente_id NULL). El front ya quitó esa opción del dropdown; esta
--   migración cierra el agujero a nivel de base de datos y corrige el dato suelto.
--
-- Esta migración hace dos cosas:
--   (a) Conversión retroactiva idempotente del prospecto huérfano
--       4dda72b6-eb97-4a50-aca7-25ce839ed1d6 (DR CANUL ANDRADE).
--   (b) Trigger BEFORE UPDATE que impide poner etapa='convertido' con cliente_id NULL.
--
-- NOTA: ambas partes son idempotentes; re-aplicar la migración no duplica datos.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- (a) Fix retroactivo del prospecto huérfano.
--
--     La RPC crm_convertir_prospecto RECHAZA cuando etapa='convertido'
--     ("El prospecto ya fue convertido."), así que no podemos llamarla para este
--     caso. En su lugar replicamos su lógica de inserción directamente, dentro de
--     un bloque idempotente: solo crea el cliente si el prospecto sigue huérfano
--     (cliente_id IS NULL) y aún no existe un cliente enlazado por prospecto_id.
--
--     Se replican exactamente los mismos campos y fuente_origen='prospecto_convertido'
--     que usa la RPC, además de los UPDATE colaterales sobre crm_personas y
--     crm_interacciones, para dejar el estado idéntico a una conversión normal.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_prospecto_id uuid := '4dda72b6-eb97-4a50-aca7-25ce839ed1d6';
  v_prospecto    public.prospectos%ROWTYPE;
  v_cliente_id   integer;
BEGIN
  SELECT * INTO v_prospecto
  FROM public.prospectos
  WHERE id = v_prospecto_id AND eliminado = false;

  IF NOT FOUND THEN
    RAISE NOTICE 'Prospecto % no encontrado (o eliminado); nada que hacer.', v_prospecto_id;
    RETURN;
  END IF;

  -- Idempotencia: si ya tiene cliente_id, no hacemos nada.
  IF v_prospecto.cliente_id IS NOT NULL THEN
    RAISE NOTICE 'Prospecto % ya tiene cliente_id=%; no se duplica.', v_prospecto_id, v_prospecto.cliente_id;
    RETURN;
  END IF;

  -- Por si una corrida previa ya creó el cliente pero no enlazó el prospecto:
  -- reutilizamos el cliente existente enlazado por prospecto_id en vez de crear otro.
  SELECT id INTO v_cliente_id
  FROM public.clientes
  WHERE prospecto_id = v_prospecto_id
  ORDER BY id
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (
      nombre, nombre_contacto, rfc, telefono, email,
      direccion, ciudad, estado, industria, observaciones,
      marca_origen, tipo_persona, razon_social,
      fuente_origen, prospecto_id, ultima_actividad
    ) VALUES (
      v_prospecto.nombre,
      v_prospecto.nombre_contacto,
      v_prospecto.rfc,
      v_prospecto.telefono,
      v_prospecto.email,
      v_prospecto.direccion,
      v_prospecto.ciudad,
      v_prospecto.estado,
      v_prospecto.industria,
      v_prospecto.observaciones,
      v_prospecto.marca_origen,
      v_prospecto.tipo_persona,
      v_prospecto.razon_social,
      'prospecto_convertido',
      v_prospecto_id,
      now()
    )
    RETURNING id INTO v_cliente_id;
    RAISE NOTICE 'Cliente % creado para prospecto huérfano %.', v_cliente_id, v_prospecto_id;
  ELSE
    RAISE NOTICE 'Cliente % ya existía enlazado a %; se reutiliza.', v_cliente_id, v_prospecto_id;
  END IF;

  -- UPDATEs colaterales idénticos a la RPC.
  UPDATE public.crm_personas
  SET cliente_id = v_cliente_id
  WHERE prospecto_id = v_prospecto_id;

  UPDATE public.crm_interacciones
  SET cliente_id = v_cliente_id
  WHERE prospecto_id = v_prospecto_id;

  -- Enlazamos el prospecto. Ya está etapa='convertido'; aquí solo seteamos
  -- cliente_id y convertido_en (si faltaba). El trigger de guardia (abajo) permite
  -- este UPDATE porque cliente_id ya NO es NULL.
  UPDATE public.prospectos
  SET
    cliente_id    = v_cliente_id,
    convertido_en = COALESCE(convertido_en, now()),
    updated_at    = now()
  WHERE id = v_prospecto_id;
END;
$$;


-- ----------------------------------------------------------------------------
-- (b) Guardia: impedir etapa='convertido' sin cliente_id.
--
--     La conversión legítima (crm_convertir_prospecto) siempre setea cliente_id
--     antes/junto con etapa='convertido', así que NO se ve afectada. Cualquier
--     otro UPDATE que intente marcar 'convertido' sin cliente es rechazado.
--
--     Convención del repo: funciones nuevas con SET search_path.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crm_prospecto_guardia_convertido()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF new.etapa = 'convertido' AND new.cliente_id IS NULL THEN
    RAISE EXCEPTION
      'No se puede marcar el prospecto como convertido sin un cliente vinculado (cliente_id). Usa la conversión (crm_convertir_prospecto).'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prospectos_guardia_convertido ON public.prospectos;

CREATE TRIGGER trg_prospectos_guardia_convertido
  BEFORE UPDATE ON public.prospectos
  FOR EACH ROW
  EXECUTE FUNCTION public.crm_prospecto_guardia_convertido();
