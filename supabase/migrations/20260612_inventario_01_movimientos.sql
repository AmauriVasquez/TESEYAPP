-- Módulo de Inventario (Almacén) — kardex de movimientos + control de existencias
-- Diseño: docs/superpowers/specs/2026-06-12-inventario-almacen-design.md (v2)
-- Convención: RLS por tiene_permiso('materiales', ...). SET search_path = public.
--
-- Reglas clave (council + abogado):
--  * El ÚNICO escritor de materiales.existencias es el trigger de movimientos.
--  * inventario_movimientos es inmutable a nivel app (sin policy UPDATE/DELETE).
--  * El trigger es la autoridad: recomputa cantidad (delta firmado), antes/después,
--    creado_por y costo_unitario; ignora lo que mande el cliente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.inventario_movimientos (
  id                 bigint generated always as identity primary key,
  material_id        integer not null references public.materiales(id) on delete restrict,
  tipo               text not null check (tipo in ('entrada','salida','ajuste')),
  cantidad           numeric not null check (cantidad <> 0),     -- delta firmado (lo fija el trigger)
  existencia_antes   numeric not null,
  existencia_despues numeric not null,  -- el guard de negativos vive en el trigger (opt-in permitir_negativo)
  costo_unitario     numeric,
  motivo             text,
  referencia         text,
  proyecto_id        integer references public.proyectos(id) on delete set null,
  observaciones      text,
  creado_por         uuid default auth.uid(),                    -- nullable: seed/migración = NULL
  created_at         timestamptz not null default now()
);

create index if not exists idx_inv_mov_material_fecha
  on public.inventario_movimientos (material_id, created_at desc);

alter table public.inventario_movimientos enable row level security;

drop policy if exists inv_mov_select on public.inventario_movimientos;
create policy inv_mov_select on public.inventario_movimientos
  for select using (public.tiene_permiso('materiales','ver'));

drop policy if exists inv_mov_insert on public.inventario_movimientos;
create policy inv_mov_insert on public.inventario_movimientos
  for insert with check (
    public.tiene_permiso('materiales','editar') and creado_por = auth.uid()
  );
-- Sin policy UPDATE/DELETE ⇒ inmutable para roles de la app (admins incluidos, que
-- pasan por el rol `authenticated` y no tienen BYPASSRLS). El mantenimiento por
-- service_role sigue siendo posible para correcciones excepcionales de BD.

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Trigger que aplica el movimiento a materiales.existencias (autoridad)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_aplicar_movimiento_inventario()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_antes  numeric;
  v_costo  numeric;
  v_despues numeric;
  v_permitir_negativo boolean := coalesce(current_setting('app.permitir_negativo', true), '0') = '1';
begin
  -- Lock de la fila del material (anti-carrera entre movimientos)
  select existencias, costo_unitario into v_antes, v_costo
  from public.materiales where id = NEW.material_id for update;
  if not found then
    raise exception 'El material % no existe', NEW.material_id;
  end if;
  v_antes := coalesce(v_antes, 0);

  if NEW.tipo = 'entrada' then
    if NEW.cantidad is null or NEW.cantidad <= 0 then
      raise exception 'La cantidad de una entrada debe ser mayor a 0';
    end if;
    v_despues := v_antes + abs(NEW.cantidad);
    NEW.cantidad := abs(NEW.cantidad);                  -- delta +

  elsif NEW.tipo = 'salida' then
    if NEW.cantidad is null or NEW.cantidad <= 0 then
      raise exception 'La cantidad de una salida debe ser mayor a 0';
    end if;
    v_despues := v_antes - abs(NEW.cantidad);
    if v_despues < 0 and not v_permitir_negativo then
      raise exception 'Existencias insuficientes: hay % y se intentan sacar %. Registra primero la entrada o marca "permitir negativo".',
        v_antes, abs(NEW.cantidad);
    end if;
    NEW.cantidad := -abs(NEW.cantidad);                 -- delta -

  elsif NEW.tipo = 'ajuste' then
    -- En ajuste, NEW.cantidad llega como el CONTEO físico (existencia real)
    if NEW.cantidad is null or NEW.cantidad < 0 then
      raise exception 'El conteo de un ajuste debe ser mayor o igual a 0';
    end if;
    v_despues := NEW.cantidad;
    if v_despues = v_antes then
      raise exception 'El ajuste no modifica las existencias (el conteo es igual al actual: %)', v_antes;
    end if;
    NEW.cantidad := v_despues - v_antes;                -- delta firmado

  else
    raise exception 'Tipo de movimiento inválido: %', NEW.tipo;
  end if;

  NEW.existencia_antes   := v_antes;
  NEW.existencia_despues := v_despues;
  NEW.creado_por         := auth.uid();                 -- anti-spoofing
  if NEW.costo_unitario is null then
    NEW.costo_unitario := v_costo;
  end if;

  -- Aplicar a existencias con el flag que autoriza al guard trigger
  perform set_config('app.mov_inventario', '1', true);
  update public.materiales set existencias = v_despues where id = NEW.material_id;
  perform set_config('app.mov_inventario', '0', true);

  return NEW;
end;
$$;

drop trigger if exists trg_aplicar_movimiento on public.inventario_movimientos;
create trigger trg_aplicar_movimiento
  before insert on public.inventario_movimientos
  for each row execute function public.fn_aplicar_movimiento_inventario();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Guard: materiales.existencias sólo cambia vía el trigger de movimientos
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.fn_guard_existencias()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if NEW.existencias is distinct from OLD.existencias
     and coalesce(current_setting('app.mov_inventario', true), '0') <> '1' then
    raise exception 'Las existencias sólo pueden cambiar mediante movimientos de inventario (módulo Inventario).';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_guard_existencias on public.materiales;
create trigger trg_guard_existencias
  before update on public.materiales
  for each row execute function public.fn_guard_existencias();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Semilla de saldo inicial para los materiales ya existentes (con trigger off)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.inventario_movimientos disable trigger trg_aplicar_movimiento;
insert into public.inventario_movimientos
  (material_id, tipo, cantidad, existencia_antes, existencia_despues, costo_unitario, motivo, creado_por)
select id, 'entrada', existencias, 0, existencias, costo_unitario, 'saldo_inicial', null
from public.materiales
where coalesce(existencias, 0) <> 0;
alter table public.inventario_movimientos enable trigger trg_aplicar_movimiento;
