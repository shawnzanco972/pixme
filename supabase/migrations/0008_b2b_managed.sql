-- =====================================================================
-- Pixipic — B2B pricing correction
--
-- B2B is NOT a digital product: every employee receives their own PHYSICAL
-- gift set. So the price must scale as (employees × the regular mosaic price
-- for the chosen size) — it is never dramatically cheaper than a B2C order.
--
-- The optional value-add (the "managed" upsell) is a dedicated upload link per
-- employee + the project dashboard that runs them, billed per seat. This flag
-- records whether that upsell was purchased.
-- =====================================================================

alter table public.b2b_orders
  add column if not exists managed boolean not null default false;
