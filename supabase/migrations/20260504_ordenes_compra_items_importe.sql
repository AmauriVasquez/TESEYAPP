-- Importe explícito por línea de OC (alineado con generación desde pedido).
ALTER TABLE ordenes_compra_items
  ADD COLUMN IF NOT EXISTS importe numeric;

COMMENT ON COLUMN ordenes_compra_items.importe IS 'cantidad * precio_unitario (snapshot al crear la línea)';
