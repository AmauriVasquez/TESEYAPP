import React from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';

/**
 * Renderiza `children` solo si el usuario tiene permiso; en caso contrario muestra `fallback`.
 *
 * @example
 * // Ocultar botón crear OC
 * <PermissionGate modulo="compras" accion="crear" submodulo="ordenes">
 *   <Button>Nueva OC</Button>
 * </PermissionGate>
 *
 * @example
 * // Mostrar botón deshabilitado como fallback
 * <PermissionGate modulo="finanzas" accion="editar"
 *   fallback={<Button disabled>Sin permiso</Button>}>
 *   <Button>Editar finanzas</Button>
 * </PermissionGate>
 */
export function PermissionGate({
  modulo,
  accion,
  submodulo,
  fallback = null,
  children,
}) {
  const { can, loading } = usePermissions();

  if (loading || !can(modulo, accion, submodulo)) {
    return fallback ?? null;
  }

  return children;
}

export default PermissionGate;
