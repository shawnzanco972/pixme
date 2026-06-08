-- =====================================================================
-- Pixme — Inventory generalization + sandbox test flag
--
--  1. inventory_supplies: physical supplies beyond the color catalog
--     (baseplates, connectors, packaging) tracked by count, with a
--     reorder threshold so the low-stock engine can flag them.
--  2. brick_stock.reorder_point_grams: the low-stock floor for colors
--     (compared against on_hand_grams − committed demand).
--  3. b2c_orders.is_test / b2b_orders.is_test: marks orders created by
--     the admin sandbox so test data is distinguishable and cleanable.
-- =====================================================================

-- 1. Generic supplies inventory ---------------------------------------
create table if not exists public.inventory_supplies (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in
                  ('baseplate', 'connector', 'packaging', 'other')),
  name          text not null,
  unit          text not null default 'pcs',
  on_hand       numeric(12, 2) not null default 0,
  reorder_point numeric(12, 2) not null default 0,
  reorder_qty   numeric(12, 2),
  supplier      text,
  sku           text,
  notes         text,
  sort_order    integer not null default 0,
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_inventory_supplies_updated_at on public.inventory_supplies;
create trigger trg_inventory_supplies_updated_at
  before update on public.inventory_supplies
  for each row execute function public.set_updated_at();

alter table public.inventory_supplies enable row level security;

-- Admin-only: no public read (unlike brick_stock, the studio never needs this).
drop policy if exists "Admins manage inventory supplies" on public.inventory_supplies;
create policy "Admins manage inventory supplies"
  on public.inventory_supplies
  for all
  to authenticated
  using (true)
  with check (true);

-- 2. Color reorder threshold ------------------------------------------
alter table public.brick_stock
  add column if not exists reorder_point_grams numeric(10, 1) not null default 0;

-- 3. Sandbox test flag ------------------------------------------------
alter table public.b2c_orders
  add column if not exists is_test boolean not null default false;
alter table public.b2b_orders
  add column if not exists is_test boolean not null default false;
