-- =====================================================================
-- Pixme — B2C Orders Migration
-- Adds the individual-customer (B2C) fulfillment track.
--
--   b2c_orders — a single guest-checkout order: photo, brick pixel_map,
--                shipping details, price, and iCount linkage.
--
-- Auth model: guest checkout. Anonymous users may INSERT their own order
-- during checkout; only authenticated admins may read / update / delete.
-- Orders are looked up by a secure token (the row UUID) + contact_email.
-- =====================================================================

-- gen_random_uuid() — extension created in 0001, guarded here for idempotency.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Table: b2c_orders
--   shipping_address: JSONB { street, city, zip }
--   pixel_map:        JSONB 2D array of color indexes, e.g. [[0,1,2],[3,1,0]]
-- ---------------------------------------------------------------------
create table if not exists public.b2c_orders (
  id                uuid          primary key default gen_random_uuid(),
  customer_name     text          not null,
  contact_email     text          not null,
  shipping_address  jsonb,
  image_url         text,
  pixel_map         jsonb,
  total_price       numeric(12,2) not null default 0 check (total_price >= 0),
  fulfillment_type  varchar(16)   not null default 'digital'
                      check (fulfillment_type in ('digital', 'physical')),
  icount_invoice_id text,
  status            order_status  not null default 'pending',
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index if not exists idx_b2c_orders_email on public.b2c_orders(contact_email);

-- updated_at maintenance (reuses public.set_updated_at() from 0001).
drop trigger if exists trg_b2c_orders_updated_at on public.b2c_orders;
create trigger trg_b2c_orders_updated_at
  before update on public.b2c_orders
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table public.b2c_orders enable row level security;

-- Guest checkout: anonymous (and authenticated) users may create an order.
-- Server-side trusted code (service role) bypasses RLS, so payment-sensitive
-- fields are reconciled by the iCount webhook, not the client.
drop policy if exists "Public create orders (guest checkout)" on public.b2c_orders;
create policy "Public create orders (guest checkout)"
  on public.b2c_orders
  for insert
  to anon, authenticated
  with check (true);

-- Only authenticated admins may read the order list.
drop policy if exists "Admins read orders" on public.b2c_orders;
create policy "Admins read orders"
  on public.b2c_orders
  for select
  to authenticated
  using (true);

-- Only authenticated admins may update orders (status, fulfillment, etc.).
drop policy if exists "Admins update orders" on public.b2c_orders;
create policy "Admins update orders"
  on public.b2c_orders
  for update
  to authenticated
  using (true)
  with check (true);

-- Only authenticated admins may delete orders.
drop policy if exists "Admins delete orders" on public.b2c_orders;
create policy "Admins delete orders"
  on public.b2c_orders
  for delete
  to authenticated
  using (true);
