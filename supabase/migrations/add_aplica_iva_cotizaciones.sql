-- Permitir cambiar estatus fiscal (Con IVA / Sin IVA) desde el registro de pago.
-- El total de la cotización se recalcula: con IVA = subtotal * 1.16, sin IVA = subtotal.
ALTER TABLE cotizaciones
ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN cotizaciones.aplica_iva IS 'Si true, total incluye IVA 16%. Si false, total es subtotal.';
