-- =============================================================================
-- Versionado de Cotizaciones (Enterprise)
-- Agrega: version, cotizacion_padre_id, es_ultima_version
-- Ejecutar en Supabase SQL Editor o como migración. La app asume que estas
-- columnas existen; sin ellas el listado de cotizaciones puede fallar.
-- Si tu PK de cotizaciones es BIGINT, cambia integer por bigint en cotizacion_padre_id.
-- =============================================================================

-- 1. version: número de versión (1 = original)
ALTER TABLE cotizaciones
ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN cotizaciones.version IS 'Número de versión de la cotización. 1 = original, 2+ = revisiones.';

-- 2. cotizacion_padre_id: referencia a la cotización de la que se clonó (para nueva versión)
-- Nota: Si tu tabla cotizaciones usa id UUID, cambia INTEGER por UUID y ajusta la referencia.
ALTER TABLE cotizaciones
ADD COLUMN IF NOT EXISTS cotizacion_padre_id integer NULL REFERENCES cotizaciones(id) ON DELETE SET NULL;

COMMENT ON COLUMN cotizaciones.cotizacion_padre_id IS 'ID de la cotización original cuando esta es una nueva versión (clon).';

-- 3. es_ultima_version: solo la última versión de cada folio aparece en la lista principal
ALTER TABLE cotizaciones
ADD COLUMN IF NOT EXISTS es_ultima_version boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN cotizaciones.es_ultima_version IS 'Si true, esta fila es la versión vigente para este folio; las anteriores no se listan en la vista principal.';

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_cotizaciones_es_ultima_version ON cotizaciones(es_ultima_version) WHERE es_ultima_version = true;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cotizacion_padre_id ON cotizaciones(cotizacion_padre_id) WHERE cotizacion_padre_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cotizaciones_folio_version ON cotizaciones(folio, version);
