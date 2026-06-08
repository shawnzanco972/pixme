-- =====================================================================
-- Pixme — Finance ledger, clients CRM, and key/value settings
--
--  transactions: an auditable money row written once per order when it is
--    provisioned (by the iCount webhook or the sandbox), independent of the
--    order row so refunds/reconciliation have a home.
--  clients: a CRM record per contact email (notes/tags), upserted on order
--    provisioning. Aggregates (orders, lifetime value) are still derived from
--    the order tables by email.
--  settings: key/value config (PDF copy, packing constants) editable without a
--    deploy.
-- All admin-only RLS.
-- =====================================================================

-- Transactions ledger ---------------------------------------------------
create table if not exists public.transactions (
  id                uuid primary key default gen_random_uuid(),
  order_track       text not null check (order_track in ('b2c', 'b2b')),
  order_id          uuid not null,
  icount_invoice_id text,
  gross             numeric(12, 2) not null default 0,
  status            text not null default 'paid',
  raw               jsonb,
  created_at        timestamptz not null default now(),
  unique (order_track, order_id)
);

alter table public.transactions enable row level security;
drop policy if exists "Admins manage transactions" on public.transactions;
create policy "Admins manage transactions"
  on public.transactions for all to authenticated using (true) with check (true);

-- Clients CRM -----------------------------------------------------------
create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique,
  name       text,
  company    text,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

alter table public.clients enable row level security;
drop policy if exists "Admins manage clients" on public.clients;
create policy "Admins manage clients"
  on public.clients for all to authenticated using (true) with check (true);

-- Settings key/value ----------------------------------------------------
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
drop policy if exists "Admins manage settings" on public.settings;
create policy "Admins manage settings"
  on public.settings for all to authenticated using (true) with check (true);

-- Seed editable PDF copy defaults.
insert into public.settings (key, value) values
  ('pdf_cover_title', '"פסיפס הלבנים שלכם"'::jsonb),
  ('pdf_footer', '"Pixipic · פיקסיפיק"'::jsonb)
on conflict (key) do nothing;
