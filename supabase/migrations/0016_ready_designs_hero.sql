-- =====================================================================
-- Pixipic — Ready-made designs: optional "hero" flag.
--
-- The homepage hero showpiece can be driven by a chosen ready-made design
-- (rendered as a brick mosaic) instead of the built-in smiley starter. At most
-- one design is the hero at a time (partial unique index). When none is set the
-- homepage falls back to the smiley.
-- =====================================================================
alter table public.ready_designs
  add column if not exists is_hero boolean not null default false;

create unique index if not exists ready_designs_one_hero
  on public.ready_designs (is_hero)
  where is_hero;
