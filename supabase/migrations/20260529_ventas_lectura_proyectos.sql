-- VENTAS necesita LECTURA de proyectos/pagos para que el Dashboard de Ventas
-- (ingresos desde proyecto_pagos) y el Calendario carguen vía RLS.
-- Solo se concede 'ver' (no crear/editar/eliminar). El módulo de Proyectos NO
-- se abre en el frontend: eso lo controla ROLE_PERMISSIONS en el cliente, que
-- no se modifica. Este cambio afecta únicamente al rol VENTAS.
CREATE OR REPLACE FUNCTION public.permiso_por_defecto_rol(p_rol app_role, p_modulo text, p_accion text, p_submodulo text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
BEGIN
    CASE p_rol
        WHEN 'RH_ALMACEN' THEN RETURN CASE
            WHEN p_modulo IN ('personal','asistencias','empleados','rh_incidencias') THEN true
            WHEN p_modulo IN ('almacen','inventario','materiales','material_unidades') THEN true
            WHEN p_modulo = 'proyectos' AND p_submodulo = 'control_financiero' THEN false
            WHEN p_modulo IN ('proyectos','proyecto_bitacora','proyecto_archivos','proyecto_entregas') AND p_accion IN ('ver','editar') THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'ordenes'     THEN p_accion = 'ver'
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos'     AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'proveedores' AND p_accion = 'ver' THEN true
            WHEN p_modulo IN ('entregas','logistica') AND p_accion IN ('ver','editar') THEN true
            ELSE false END;

        WHEN 'COMPRAS_FACTURACION' THEN RETURN CASE
            WHEN p_modulo = 'clientes'     AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'clientes'     THEN false
            WHEN p_modulo = 'cotizaciones' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'cotizaciones' THEN false
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos'     AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos'     THEN false
            WHEN p_modulo = 'compras' AND p_submodulo = 'proveedores' THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'ordenes'     AND p_accion = 'eliminar' THEN false
            WHEN p_modulo = 'compras' AND p_submodulo = 'ordenes'     THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'oc_pagos'    THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'oc_facturas' THEN true
            WHEN p_modulo IN ('proyectos','proyecto_pagos') AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'finanzas'  AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'finanzas'  THEN false
            WHEN p_modulo IN ('activos','activos_operativos','categorias_activos','historial_activos','responsivas') AND p_accion = 'ver' THEN true
            ELSE false END;

        WHEN 'SUPERVISOR_CAMPO' THEN RETURN CASE
            WHEN p_modulo = 'proyectos' AND p_submodulo = 'control_financiero' THEN false
            WHEN p_modulo = 'proyectos' AND p_submodulo = 'cotizacion'         THEN false
            WHEN p_modulo IN ('proyectos','proyecto_bitacora','proyecto_archivos','proyecto_entregas','proyecto_materiales') AND p_accion IN ('ver','editar') THEN true
            WHEN p_modulo = 'compras' AND p_submodulo = 'pedidos' AND p_accion IN ('ver','crear') THEN true
            WHEN p_modulo IN ('entregas','logistica') AND p_accion IN ('ver','editar') THEN true
            ELSE false END;

        WHEN 'OPERADOR' THEN RETURN CASE
            WHEN p_modulo IN ('proyecto_bitacora','proyecto_archivos') AND p_accion = 'ver'   THEN true
            WHEN p_modulo = 'proyecto_bitacora'                        AND p_accion = 'crear' THEN true
            WHEN p_modulo = 'proyectos'                                AND p_accion = 'ver'   THEN true
            ELSE false END;

        WHEN 'VENTAS' THEN RETURN CASE
            -- Clientes: crear y editar (no eliminar)
            WHEN p_modulo = 'clientes' AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo = 'clientes' AND p_accion = 'eliminar' THEN false
            -- Prospectos: acceso total
            WHEN p_modulo = 'prospectos' THEN true
            -- CRM personas e interacciones: acceso total
            WHEN p_modulo IN ('crm_personas','crm_interacciones') THEN true
            -- Cotizaciones: solo ver
            WHEN p_modulo = 'cotizaciones' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'cotizaciones' THEN false
            -- cotizaciones_items: solo ver (para poder ver el detalle)
            WHEN p_modulo = 'cotizaciones_items' AND p_accion = 'ver' THEN true
            WHEN p_modulo = 'cotizaciones_items' THEN false
            -- Proyectos / proyecto_pagos: SOLO lectura, para que el Dashboard de
            -- Ventas (ingresos) y el Calendario carguen vía RLS. Cubre el
            -- submódulo control_financiero exigido por la política de pagos.
            -- No abre el módulo de Proyectos en el frontend (ROLE_PERMISSIONS).
            WHEN p_modulo IN ('proyectos','proyecto_pagos') AND p_accion = 'ver' THEN true
            WHEN p_modulo IN ('proyectos','proyecto_pagos') THEN false
            -- KPIs: ver, crear y editar (no eliminar definiciones)
            WHEN p_modulo IN ('kpi_definitions','kpi_values','kpi_snapshots') AND p_accion IN ('ver','crear','editar') THEN true
            WHEN p_modulo IN ('kpi_definitions','kpi_values','kpi_snapshots') AND p_accion = 'eliminar' THEN false
            ELSE false END;

        ELSE RETURN false;
    END CASE;
END;$function$;
