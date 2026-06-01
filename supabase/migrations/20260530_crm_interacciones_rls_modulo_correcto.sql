-- La política de escritura de crm_interacciones exigía 'cotizaciones'.'editar',
-- permiso que ningún rol no-admin tiene → solo admins podían crear interacciones.
-- VENTAS tiene 'crm_interacciones' completo en permiso_por_defecto_rol, así que la
-- política debe basarse en el módulo correcto. Los admin siguen permitidos por el
-- atajo de tiene_permiso(). No se quita acceso a ningún rol (nadie no-admin tenía
-- cotizaciones.editar).
ALTER POLICY crmi_write ON public.crm_interacciones
  USING (public.tiene_permiso('crm_interacciones', 'editar'))
  WITH CHECK (public.tiene_permiso('crm_interacciones', 'editar'));
