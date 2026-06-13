-- Quitar EXECUTE a anon (Supabase lo concede por defecto). Las funciones ya
-- rechazaban a anon en runtime, pero esto limpia el advisor y aplica menor privilegio.
revoke execute on function public.crear_pedido_restock(jsonb, text) from anon;
revoke execute on function public.siguiente_folio_pedido() from anon, public;
revoke execute on function public.registrar_movimiento_inventario(integer,text,numeric,text,text,integer,text,boolean) from anon;
