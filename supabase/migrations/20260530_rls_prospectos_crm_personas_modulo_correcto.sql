-- Mismo bug que crm_interacciones: las políticas de ESCRITURA de prospectos y
-- crm_personas exigían permiso de 'cotizaciones', que ningún rol no-admin tiene
-- → solo admins podían crear/editar. VENTAS tiene 'prospectos' y 'crm_personas'
-- completos, así que las políticas deben basarse en el módulo propio.
-- Sin regresiones: admins siguen por el atajo de tiene_permiso(); ningún rol
-- no-admin tenía cotizaciones.crear/editar/eliminar.
-- Las políticas de SELECT se dejan intactas (cotizaciones.ver) para no romper
-- lecturas existentes (p. ej. dashboard de ventas para COMPRAS_FACTURACION).

-- prospectos
ALTER POLICY pros_insert ON public.prospectos
  WITH CHECK (public.tiene_permiso('prospectos', 'crear'));
ALTER POLICY pros_update ON public.prospectos
  USING (public.tiene_permiso('prospectos', 'editar'))
  WITH CHECK (public.tiene_permiso('prospectos', 'editar'));
ALTER POLICY pros_delete ON public.prospectos
  USING (public.tiene_permiso('prospectos', 'eliminar'));

-- crm_personas (política ALL de escritura)
ALTER POLICY crmp_write ON public.crm_personas
  USING (public.tiene_permiso('crm_personas', 'editar'))
  WITH CHECK (public.tiene_permiso('crm_personas', 'editar'));
