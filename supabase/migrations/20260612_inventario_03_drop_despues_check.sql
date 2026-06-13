-- El guard de existencias negativas vive en el trigger (con opt-in permitir_negativo).
-- El CHECK rígido impedía esa excepción legítima; se elimina.
alter table public.inventario_movimientos
  drop constraint if exists inventario_movimientos_existencia_despues_check;
