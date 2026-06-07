-- =====================================================================
-- Pixme — Initial Schema Migration
-- Principal Database Architect output for Supabase (PostgreSQL)
--
-- Covers the B2B fulfillment track:
--   * b2b_orders          — a purchased batch of mosaic licenses
--   * b2b_workspaces      — a redeemable workspace tied to an order
--   * employee_submissions — individual photo submissions in a workspace
--
-- Includes RLS policies and a trigger that increments slots_used on insert.
-- =====================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum ('pending', 'paid', 'fulfilled', 'cancelled', 'refunded');
  end if;
  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type submission_status as enum ('pending', 'processing', 'ready', 'rejected');
  end if;
end$$;

-- ---------------------------------------------------------------------
-- Table: b2b_orders
-- ---------------------------------------------------------------------
create table if not exists public.b2b_orders (
  id                  uuid primary key default gen_random_uuid(),
  company_name        text         not null,
  contact_email       text         not null,
  licenses_purchased  integer      not null check (licenses_purchased > 0),
  amount_paid         numeric(12,2) not null default 0 check (amount_paid >= 0),
  icount_invoice_id   text,
  status              order_status not null default 'pending',
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- ---------------------------------------------------------------------
-- Table: b2b_workspaces
-- ---------------------------------------------------------------------
create table if not exists public.b2b_workspaces (
  id              uuid primary key default gen_random_uuid(),
  b2b_order_id    uuid        not null references public.b2b_orders(id) on delete cascade,
  max_slots       integer     not null check (max_slots >= 0),
  slots_used      integer     not null default 0 check (slots_used >= 0),
  active          boolean     not null default true,
  expiration_date timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint slots_used_within_max check (slots_used <= max_slots)
);

create index if not exists idx_b2b_workspaces_order on public.b2b_workspaces(b2b_order_id);

-- ---------------------------------------------------------------------
-- Table: employee_submissions
--   pixel_map: JSONB 2D array of color indexes, e.g. [[0,1,2],[3,1,0], ...]
-- ---------------------------------------------------------------------
create table if not exists public.employee_submissions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid              not null references public.b2b_workspaces(id) on delete cascade,
  employee_name text              not null,
  image_url     text,
  pixel_map     jsonb,
  status        submission_status not null default 'pending',
  created_at    timestamptz       not null default now(),
  updated_at    timestamptz       not null default now()
);

create index if not exists idx_employee_submissions_workspace on public.employee_submissions(workspace_id);

-- ---------------------------------------------------------------------
-- updated_at maintenance trigger (shared)
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_b2b_orders_updated_at on public.b2b_orders;
create trigger trg_b2b_orders_updated_at
  before update on public.b2b_orders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_b2b_workspaces_updated_at on public.b2b_workspaces;
create trigger trg_b2b_workspaces_updated_at
  before update on public.b2b_workspaces
  for each row execute function public.set_updated_at();

drop trigger if exists trg_employee_submissions_updated_at on public.employee_submissions;
create trigger trg_employee_submissions_updated_at
  before update on public.employee_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Function + trigger: increment slots_used on successful submission insert
--   Locks the workspace row to avoid race conditions, validates that the
--   workspace is active, not expired, and has a free slot.
-- ---------------------------------------------------------------------
create or replace function public.increment_workspace_slots_used()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws record;
begin
  -- Lock the target workspace row for the duration of the transaction.
  select * into ws
  from public.b2b_workspaces
  where id = new.workspace_id
  for update;

  if ws.id is null then
    raise exception 'Workspace % does not exist', new.workspace_id;
  end if;

  if not ws.active then
    raise exception 'Workspace % is not active', new.workspace_id;
  end if;

  if ws.expiration_date is not null and ws.expiration_date < now() then
    raise exception 'Workspace % has expired', new.workspace_id;
  end if;

  if ws.slots_used >= ws.max_slots then
    raise exception 'Workspace % has no remaining slots', new.workspace_id;
  end if;

  update public.b2b_workspaces
  set slots_used = slots_used + 1
  where id = new.workspace_id;

  return new;
end;
$$;

drop trigger if exists trg_increment_slots_used on public.employee_submissions;
create trigger trg_increment_slots_used
  after insert on public.employee_submissions
  for each row execute function public.increment_workspace_slots_used();

-- =====================================================================
-- Row-Level Security
-- =====================================================================
alter table public.b2b_orders          enable row level security;
alter table public.b2b_workspaces      enable row level security;
alter table public.employee_submissions enable row level security;

-- ----- b2b_orders: admin-only (authenticated) -----
drop policy if exists "Admins manage orders" on public.b2b_orders;
create policy "Admins manage orders"
  on public.b2b_orders
  for all
  to authenticated
  using (true)
  with check (true);

-- ----- b2b_workspaces -----
-- Public (anon) may READ only active, non-expired workspaces so employees
-- can validate the workspace they are submitting to.
drop policy if exists "Public read active workspaces" on public.b2b_workspaces;
create policy "Public read active workspaces"
  on public.b2b_workspaces
  for select
  to anon, authenticated
  using (
    active = true
    and (expiration_date is null or expiration_date > now())
  );

-- Authenticated admins manage workspaces.
drop policy if exists "Admins manage workspaces" on public.b2b_workspaces;
create policy "Admins manage workspaces"
  on public.b2b_workspaces
  for all
  to authenticated
  using (true)
  with check (true);

-- ----- employee_submissions -----
-- Public (anon) employees may INSERT a submission, but only into a workspace
-- that is active, not expired, and has a free slot.
drop policy if exists "Public submit to active workspace" on public.employee_submissions;
create policy "Public submit to active workspace"
  on public.employee_submissions
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.b2b_workspaces w
      where w.id = employee_submissions.workspace_id
        and w.active = true
        and (w.expiration_date is null or w.expiration_date > now())
        and w.slots_used < w.max_slots
    )
  );

-- Authenticated admins can read/manage all submissions.
drop policy if exists "Admins manage submissions" on public.employee_submissions;
create policy "Admins manage submissions"
  on public.employee_submissions
  for all
  to authenticated
  using (true)
  with check (true);
