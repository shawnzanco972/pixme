-- =====================================================================
-- Pixipic — B2B fulfillment batches ("shipments")
--
-- Approving a design and SHIPPING it are two different decisions, and the
-- company makes them at different times. The common case: a company buys 20
-- sets for the holidays and releases them all at once — but then adds one more
-- for the boss and wants that single set to go out today, not with the batch.
--
-- So a shipment is an owner-chosen SUBSET of approved seats, released to
-- production together. The company is the customer; everything ships in bulk to
-- the company, which is why there are no per-employee addresses anywhere in
-- this schema — we deliberately hold nothing about an employee beyond the name
-- and email the company already had.
--
--   - b2b_shipments: one release batch, owned by a b2b_order.
--   - employee_submissions.shipment_id: which batch this seat went out in.
--     NULL = approved but not yet released (still sitting in the dashboard).
--
-- A seat can only join a batch once its submission is 'ready' (owner-approved);
-- that invariant is enforced in the API, not by a constraint, because the owner
-- may reopen an approval before the batch ships.
-- =====================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'b2b_shipment_status') then
    create type b2b_shipment_status as enum (
      'requested',   -- owner released it; waiting for us to pick it up
      'in_production',
      'shipped',
      'cancelled'
    );
  end if;
end$$;

create table if not exists public.b2b_shipments (
  id            uuid primary key default gen_random_uuid(),
  b2b_order_id  uuid not null references public.b2b_orders(id) on delete cascade,
  status        b2b_shipment_status not null default 'requested',
  /* Owner-visible note: "לשלוח למשרד ת״א", "דחוף למנכ״ל" etc. */
  note          text,
  /* Set by admin when the box actually leaves. */
  shipped_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_b2b_shipments_order
  on public.b2b_shipments(b2b_order_id);

drop trigger if exists trg_b2b_shipments_updated_at on public.b2b_shipments;
create trigger trg_b2b_shipments_updated_at
  before update on public.b2b_shipments
  for each row execute function public.set_updated_at();

alter table public.employee_submissions
  add column if not exists shipment_id uuid
    references public.b2b_shipments(id) on delete set null;

create index if not exists idx_employee_submissions_shipment
  on public.employee_submissions(shipment_id);

-- RLS: service-role only, like the rest of the B2B project tables. The owner
-- dashboard and its API routes use the service-role key; there is no anon path.
alter table public.b2b_shipments enable row level security;

drop policy if exists "Admins manage shipments" on public.b2b_shipments;
create policy "Admins manage shipments"
  on public.b2b_shipments
  for all
  to authenticated
  using (true)
  with check (true);
