-- =====================================================================
-- Pixipic — supply confirmation flag
--
-- Supply confirmation is SEPARATE from availability:
--   in_stock          = "the studio may use this colour" (drives matching)
--   supply_confirmed  = "we have physically verified the supplier can make it"
--
-- Keeping them apart means the whole palette stays testable in the studio while
-- still showing honestly which colours are validated and which are waiting on
-- the supplier. Seeded from the original catalogue (engine ids 0–24 — the
-- colours that existed before the identity + realism expansions).
-- =====================================================================

alter table public.brick_stock
  add column if not exists supply_confirmed boolean not null default false;

update public.brick_stock set supply_confirmed = (id <= 24);

comment on column public.brick_stock.supply_confirmed is
  'Supplier has confirmed/sampled this colour. Independent of in_stock.';
