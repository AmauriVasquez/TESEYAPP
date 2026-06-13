-- ROLLBACK del módulo de Inventario (almacén).
-- NO está en supabase/migrations/ a propósito: no debe aplicarse automáticamente.
-- Ejecutar manualmente SOLO si se quiere revertir el módulo por completo.
--
-- Es seguro y reversible: los cambios fueron aditivos. Esto quita la tabla kardex,
-- los triggers y las funciones nuevas, y deja materiales.existencias editable como antes.
-- Las existencias actuales en materiales NO se borran (siguen con su último valor).

begin;

-- 1. Quitar el guard para que existencias vuelva a ser editable desde el catálogo
drop trigger if exists trg_guard_existencias on public.materiales;
drop function if exists public.fn_guard_existencias();

-- 2. Quitar el kardex y su trigger (CASCADE elimina el trigger dependiente)
drop table if exists public.inventario_movimientos cascade;
drop function if exists public.fn_aplicar_movimiento_inventario();

-- 3. Quitar las RPCs nuevas
drop function if exists public.registrar_movimiento_inventario(integer,text,numeric,text,text,integer,text,boolean);
drop function if exists public.crear_pedido_restock(jsonb, text);

-- 4. (Opcional) folio atómico y unicidad de folio. Se pueden conservar sin problema;
--    descomenta solo si quieres revertirlos también.
-- drop function if exists public.siguiente_folio_pedido();
-- drop index if exists public.ux_pedidos_materiales_folio;

commit;
