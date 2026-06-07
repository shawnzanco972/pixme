-- =====================================================================
-- Pixme — Brick color stock flags
--
-- The color CATALOG (names/hex/recommended) lives in code
-- (src/lib/brick-engine/palette.ts). This table only overrides per-color
-- AVAILABILITY so the operator can mark a color out of stock without a deploy.
--
-- Convention: NO ROW for a color id == in stock. Insert/flip a row to mark a
-- color out of stock (in_stock = false). The studio reads this to disable
-- out-of-stock colors; the engine then only matches available colors, and
-- existing pixel_maps can be remapped to the nearest available color.
-- =====================================================================

create table if not exists public.brick_stock (
  id          integer     primary key,         -- catalog color id
  in_stock    boolean     not null default true,
  sort_order  integer     not null default 0,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_brick_stock_updated_at on public.brick_stock;
create trigger trg_brick_stock_updated_at
  before update on public.brick_stock
  for each row execute function public.set_updated_at();

alter table public.brick_stock enable row level security;

-- Anyone may read availability (the studio needs it to disable colors).
drop policy if exists "Public read brick stock" on public.brick_stock;
create policy "Public read brick stock"
  on public.brick_stock
  for select
  to anon, authenticated
  using (true);

-- Only authenticated admins may change availability.
drop policy if exists "Admins manage brick stock" on public.brick_stock;
create policy "Admins manage brick stock"
  on public.brick_stock
  for all
  to authenticated
  using (true)
  with check (true);
