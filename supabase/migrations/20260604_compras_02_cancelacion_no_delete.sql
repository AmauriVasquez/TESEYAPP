-- =============================================================================
-- Compras 02 — Cancelación lógica de OC (no eliminación física)
-- =============================================================================
-- El spec exige que las OC se CANCELEN (estatus='Cancelada'), nunca se borren.
-- El front se actualiza para no exponer DELETE; aquí endurecemos la capa de BD
-- para que el borrado físico de OC quede bloqueado para usuarios de la app.
--
-- Decisión conservadora: en lugar de soltar la policy de DELETE existente
-- (`oc_delete`/`oci_delete` con es_admin()), la reemplazamos por una que niega
-- siempre el DELETE a roles de la aplicación. El borrado real (correcciones,
-- mantenimiento) queda únicamente en manos de `service_role`, que NO está sujeto
-- a RLS. Así se evita la eliminación accidental desde la UI o por un admin.
--
-- Riesgo: bajo (tabla vacía; no hay OC que se dependa de poder borrar).
-- =============================================================================

-- OC: prohibir DELETE desde la app (cancelar en su lugar) --------------------
DROP POLICY IF EXISTS oc_delete ON public.ordenes_compra;
CREATE POLICY oc_delete ON public.ordenes_compra
  FOR DELETE
  USING (false);

-- Items de OC: idem (el borrado de items solo en edición controlada via UPDATE/
-- reemplazo dentro de una transacción de edición, no como acción de usuario).
DROP POLICY IF EXISTS oci_delete ON public.ordenes_compra_items;
CREATE POLICY oci_delete ON public.ordenes_compra_items
  FOR DELETE
  USING (false);

COMMENT ON POLICY oc_delete ON public.ordenes_compra IS
  'Borrado físico deshabilitado: las OC se cancelan (estatus=Cancelada). Solo service_role puede borrar (bypassa RLS).';
COMMENT ON POLICY oci_delete ON public.ordenes_compra_items IS
  'Borrado físico deshabilitado para usuarios de la app; el reemplazo de partidas en edición lo hace service_role o el flujo controlado.';

-- Nota sobre pedidos: el spec pide "mismo principio donde corresponda". Los
-- pedidos NO tienen aún columna de estado de cancelación y su borrado se usa
-- operativamente; el front migra a cancelación lógica usando estatus='Cancelada'
-- (columna ya existente `pedidos_materiales.estatus`). No se cambia su RLS aquí
-- para no romper el borrado de borradores; queda como mejora futura si se desea
-- forzarlo a nivel BD.
