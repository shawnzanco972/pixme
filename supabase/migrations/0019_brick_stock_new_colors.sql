-- =====================================================================
-- Pixipic — make the 6 new catalogue colours available in the studio.
--
-- Bug: the studio only ever offered 25 colours after the palette grew to 31.
-- `usePaletteInventory` resolves availability as
--     brick_stock row  ->  else the palette's `core` flag
-- and brick_stock still held ONLY the 25 legacy rows (all in_stock = true).
-- The 6 new colours had no row, so they fell back to `core = false` and were
-- filtered out of the picker entirely.
--
-- Seed them explicitly. on_hand_grams starts at 0 — they are selectable in the
-- editor and will surface in the low-stock digest until the first order lands.
-- =====================================================================

insert into public.brick_stock (id, color_id, in_stock, on_hand_grams, sort_order)
values
  (25, 'sand-blue',       true, 0, 25),
  (26, 'sand-green',      true, 0, 26),
  (27, 'olive-green',     true, 0, 27),
  (28, 'light-pink',      true, 0, 28),
  (29, 'medium-lavender', true, 0, 29),
  (30, 'dark-purple',     true, 0, 30)
on conflict (id) do update
  set color_id = excluded.color_id,
      in_stock = excluded.in_stock;
