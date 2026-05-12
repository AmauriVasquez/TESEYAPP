-- Branding por cotización (persistente e idempotente)
ALTER TABLE public.cotizaciones
    ADD COLUMN IF NOT EXISTS branding text;

UPDATE public.cotizaciones
SET branding = 'iihemsa'
WHERE branding IS NULL OR trim(branding) = '';

ALTER TABLE public.cotizaciones
    ALTER COLUMN branding SET DEFAULT 'iihemsa';

ALTER TABLE public.cotizaciones
    DROP CONSTRAINT IF EXISTS cotizaciones_branding_chk;

ALTER TABLE public.cotizaciones
    ADD CONSTRAINT cotizaciones_branding_chk
    CHECK (branding IN ('iihemsa', 'tesey'));

COMMENT ON COLUMN public.cotizaciones.branding IS
'Marca emisora de la cotización para render dinámico de logo y colores.';
