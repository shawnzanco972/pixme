-- =====================================================================
-- Pixipic — B2B "project" model
--
-- Reframes a B2B purchase from a loose batch of licenses into an owned
-- PROJECT: the company buys a fixed bundle (size tier × seats), becomes the
-- project owner (secret owner_token → dashboard), pre-loads an employee ROSTER,
-- and tracks each employee's status. Employees redeem a personalized seat link;
-- the purchased size is locked (they can't pick their own).
--
-- Owner dashboard + seat submission run server-side with the service-role key,
-- so the roster table is RLS-locked to admins only (no anon access).
-- =====================================================================

-- 1) Extend b2b_orders with the purchased bundle + project metadata.
alter table public.b2b_orders
  add column if not exists bundle_id    text,
  add column if not exists project_name text,
  add column if not exists plates_x     integer not null default 2 check (plates_x between 1 and 5),
  add column if not exists plates_y     integer not null default 2 check (plates_y between 1 and 5),
  add column if not exists owner_token  uuid    not null default gen_random_uuid();

create unique index if not exists idx_b2b_orders_owner_token
  on public.b2b_orders(owner_token);

-- 2) Employee roster — who the owner expects to participate.
create table if not exists public.employee_roster (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.b2b_workspaces(id) on delete cascade,
  name          text not null,
  email         text,
  invite_token  uuid not null default gen_random_uuid(),
  submission_id uuid references public.employee_submissions(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists idx_employee_roster_invite
  on public.employee_roster(invite_token);
create index if not exists idx_employee_roster_workspace
  on public.employee_roster(workspace_id);

drop trigger if exists trg_employee_roster_updated_at on public.employee_roster;
create trigger trg_employee_roster_updated_at
  before update on public.employee_roster
  for each row execute function public.set_updated_at();

-- 3) Link a submission back to its roster seat (so we can show who's done).
alter table public.employee_submissions
  add column if not exists roster_id uuid
    references public.employee_roster(id) on delete set null;

-- 4) RLS — roster is service-role / admin only (owner dashboard & seat API use
--    the service-role key, which bypasses RLS). No anon access.
alter table public.employee_roster enable row level security;

drop policy if exists "Admins manage roster" on public.employee_roster;
create policy "Admins manage roster"
  on public.employee_roster
  for all
  to authenticated
  using (true)
  with check (true);
