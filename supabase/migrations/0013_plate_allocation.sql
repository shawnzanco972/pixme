-- =====================================================================
-- Pixme — B2B per-employee plate allocation + credit top-ups
--
-- The company buys a pool of mosaic capacity (employees × the chosen size).
-- Internally that's a pool of 24×24 "plate credits" the project owner can
-- redistribute between employees — e.g. give one person a bigger mosaic for a
-- milestone — as long as the total never exceeds what was purchased.
--   - employee_roster.plates_allocated: plates assigned to this seat. NULL means
--     "the default even share" (the order's plates_x × plates_y).
--   - b2b_orders.extra_plate_credits: extra plates added after purchase
--     ("buy more credits"), on top of employees × default size.
--
-- NOTE: "plates/credits" is internal vocabulary — never surface it in B2B
-- marketing copy (the sales page talks only about mosaic size per employee).
-- =====================================================================

alter table public.employee_roster
  add column if not exists plates_allocated integer;

alter table public.b2b_orders
  add column if not exists extra_plate_credits integer not null default 0;
