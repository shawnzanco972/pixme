-- =====================================================================
-- Pixme — Inventory on-hand quantity per color
--
-- Adds on_hand_grams to brick_stock so the operator can track how much of each
-- color is physically in stock (by weight). The restock report compares this to
-- what pending orders need and shows the shortfall to reorder.
-- =====================================================================

alter table public.brick_stock
  add column if not exists on_hand_grams numeric(10,1) not null default 0;
