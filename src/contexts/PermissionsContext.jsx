import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export const ROLE_PERMISSIONS = {
  ADMIN_MAESTRO: { _all: true },
  ADMIN_VISUAL: { _all: true },
  VENTAS: {
    clientes: { ver: true, crear: true, editar: true, eliminar: false },
    prospectos: { ver: true, crear: true, editar: true, eliminar: true },
    crm_personas: { ver: true, crear: true, editar: true, eliminar: true },
    crm_interacciones: { ver: true, crear: true, editar: true, eliminar: true },
    cotizaciones: { ver: true, crear: false, editar: false, eliminar: false },
    cotizaciones_items: { ver: true, crear: false, editar: false, eliminar: false },
    kpi_definitions: { ver: true, crear: true, editar: true, eliminar: false },
    kpi_values: { ver: true, crear: true, editar: true, eliminar: false },
    kpi_snapshots: { ver: true, crear: true, editar: true, eliminar: false },
  },
  COMPRAS_FACTURACION: {
    clientes: { ver: true, crear: false, editar: false, eliminar: false },
    cotizaciones: { ver: true, crear: false, editar: false, eliminar: false },
    'compras.pedidos': { ver: true, crear: false, editar: false, eliminar: false },
    'compras.proveedores': { ver: true, crear: true, editar: true, eliminar: true },
    'compras.ordenes': {
      ver: true,
      crear: true,
      editar: true,
      eliminar: false,
      autorizar: true,
    },
    'compras.oc_pagos': { ver: true, crear: true, editar: true, eliminar: false },
    'compras.oc_facturas': { ver: true, crear: true, editar: true, eliminar: false },
    proyectos: { ver: true, crear: false, editar: false, eliminar: false },
    'proyectos.control_financiero': {
      ver: true,
      crear: true,
      editar: false,
      eliminar: false,
    },
    finanzas: { ver: true, crear: false, editar: false, eliminar: false },
    activos: { ver: true, crear: false, editar: false, eliminar: false },
  },
  RH_ALMACEN: {
    personal: { ver: true, crear: true, editar: true, eliminar: true },
    asistencias: { ver: true, crear: true, editar: true, eliminar: true },
    empleados: { ver: true, crear: true, editar: true, eliminar: true },
    rh_incidencias: { ver: true, crear: true, editar: true, eliminar: true },
    almacen: { ver: true, crear: true, editar: true, eliminar: true },
    materiales: { ver: true, crear: true, editar: true, eliminar: true },
    material_unidades: { ver: true, crear: true, editar: true, eliminar: true },
    proyectos: { ver: true, crear: false, editar: true, eliminar: false },
    proyecto_bitacora: { ver: true, crear: true, editar: true, eliminar: false },
    proyecto_archivos: { ver: true, crear: true, editar: false, eliminar: false },
    'proyectos.control_financiero': {
      ver: false,
      crear: false,
      editar: false,
      eliminar: false,
    },
    'compras.pedidos': { ver: true, crear: true, editar: true, eliminar: false },
    'compras.ordenes': { ver: true, crear: false, editar: false, eliminar: false },
    'compras.proveedores': { ver: true, crear: false, editar: false, eliminar: false },
    entregas: { ver: true, crear: false, editar: true, eliminar: false },
  },
  SUPERVISOR_CAMPO: {
    proyectos: { ver: true, crear: false, editar: true, eliminar: false },
    proyecto_bitacora: { ver: true, crear: true, editar: false, eliminar: false },
    proyecto_archivos: { ver: true, crear: false, editar: false, eliminar: false },
    proyecto_entregas: { ver: true, crear: false, editar: true, eliminar: false },
    proyecto_materiales: { ver: true, crear: false, editar: true, eliminar: false },
    'compras.pedidos': { ver: true, crear: true, editar: false, eliminar: false },
    entregas: { ver: true, crear: false, editar: true, eliminar: false },
  },
  OPERADOR: {
    proyectos: { ver: true, crear: false, editar: false, eliminar: false },
    proyecto_bitacora: { ver: true, crear: true, editar: false, eliminar: false },
    proyecto_archivos: { ver: true, crear: false, editar: false, eliminar: false },
  },
};

const ADMIN_ROLES = new Set(['ADMIN_MAESTRO', 'ADMIN_VISUAL']);

function resolvePermissionKey(modulo, submodulo) {
  return submodulo ? `${modulo}.${submodulo}` : modulo;
}

function getRolePermissions(rol, key) {
  const rolePerms = ROLE_PERMISSIONS[rol];
  if (!rolePerms) return undefined;
  if (rolePerms._all) return { ver: true, crear: true, editar: true, eliminar: true, autorizar: true, exportar: true };
  return rolePerms[key];
}

const PermissionsContext = createContext(undefined);

export function PermissionsProvider({ children }) {
  const [userContext, setUserContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const clearContext = useCallback(() => {
    setUserContext(null);
    setError(null);
    setLoading(false);
  }, []);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_mi_contexto');
      if (rpcError) throw rpcError;
      setUserContext(data ?? null);
    } catch (err) {
      console.error('get_mi_contexto error:', err);
      setUserContext(null);
      setError(err?.message ?? 'No se pudo cargar el contexto de permisos.');
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      clearContext();
      return;
    }
    await fetchContext();
  }, [clearContext, fetchContext]);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        await fetchContext();
      } else {
        clearContext();
      }
    };

    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_OUT') {
          clearContext();
          return;
        }

        if (event === 'SIGNED_IN' && session) {
          await fetchContext();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [clearContext, fetchContext]);

  const userRole = userContext?.rol ?? null;
  const userId = userContext?.id ?? null;

  const can = useCallback(
    (modulo, accion, submodulo) => {
      if (loading || !userContext) return false;

      if (ADMIN_ROLES.has(userContext.rol)) return true;

      const key = resolvePermissionKey(modulo, submodulo);
      const override = userContext.permisos_override?.[key];
      const base = getRolePermissions(userContext.rol, key);

      if (override && Object.prototype.hasOwnProperty.call(override, accion)) {
        return Boolean(override[accion]);
      }

      if (base && Object.prototype.hasOwnProperty.call(base, accion)) {
        return Boolean(base[accion]);
      }

      return false;
    },
    [loading, userContext]
  );

  const getHiddenFields = useCallback(
    (modulo, submodulo) => {
      if (!userContext) return [];
      if (ADMIN_ROLES.has(userContext.rol)) return [];

      const key = resolvePermissionKey(modulo, submodulo);
      const override = userContext.permisos_override?.[key];

      if (override?.campos_ocultos && Array.isArray(override.campos_ocultos)) {
        return override.campos_ocultos;
      }

      return [];
    },
    [userContext]
  );

  const hasRole = useCallback(
    (...roles) => {
      if (!userContext?.rol) return false;
      return roles.includes(userContext.rol);
    },
    [userContext]
  );

  const value = useMemo(
    () => ({
      userContext,
      userRole,
      userId,
      loading,
      error,
      can,
      getHiddenFields,
      hasRole,
      reload,
    }),
    [userContext, userRole, userId, loading, error, can, getHiddenFields, hasRole, reload]
  );

  return (
    <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}
