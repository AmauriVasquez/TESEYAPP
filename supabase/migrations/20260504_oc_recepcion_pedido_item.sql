-- Vínculo OC ítem ↔ línea de pedido; recepción en pedido
ALTER TABLE ordenes_compra_items
  ADD COLUMN IF NOT EXISTS pedido_item_id bigint REFERENCES pedidos_materiales_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordenes_compra_items_pedido_item_id ON ordenes_compra_items(pedido_item_id);

ALTER TABLE pedidos_materiales_items
  ADD COLUMN IF NOT EXISTS cantidad_recibida numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN ordenes_compra_items.pedido_item_id IS 'Línea de pedido origen (si la OC se generó desde pedido)';
COMMENT ON COLUMN pedidos_materiales_items.cantidad_recibida IS 'Acumulado recepciones vinculadas a OC (sincronizado al recibir en OC)';
