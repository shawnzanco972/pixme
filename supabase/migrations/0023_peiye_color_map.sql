-- =====================================================================
-- Pixipic — Peiye (Shantou Chenghai Peiye Toys / BCM) colour code map
--
-- Derived by matching our 42-colour palette against the supplier's own
-- published RGB chart (workbook sheet "2021-6", 94 colours) in OKLab space.
-- This is the mapping the procurement export uses to emit reorder lines in
-- THEIR numbering — `color_id` stays canonical and untouched.
--
-- Match quality (OKLab distance to their nearest colour):
--   EXACT/near-exact (<0.02): blush→A08 (0.0000), light-peach→A24 (0.0031),
--     sienna→38 (0.0128), medium-lavender→324 (0.0127), dark-tan→138 (0.0137),
--     medium-nougat→312 (0.0151), peach→283 (0.0154), sand-green→151 (0.0171),
--     light-nougat→B27 (0.0184), white→1 (0.0191), warm-nougat→A25 (0.0199),
--     light-bluish-gray→194 (0.0120)
--   FLAGGED — needs a physical sample before ordering (>0.075):
--     black→26 (0.0830 — their black is #302e32, noticeably lighter than ours)
--     dark-red→154 (0.0854)
--     dark-purple→268 (0.0796)
--
-- Where two of our colours resolved to the SAME supplier SKU, the weaker match
-- was reassigned to a distinct neighbouring colour so we never order one
-- physical brick twice under two names:
--   taupe→B17 · deep-umber→B16 · coffee→B32 · light-pink→B18
-- =====================================================================

insert into public.color_manufacturer_codes (color_id, manufacturer, code) values
  ('white','peiye','1'),
  ('light-bluish-gray','peiye','194'),
  ('dark-bluish-gray','peiye','199'),
  ('black','peiye','26'),
  ('sand','peiye','B23'),
  ('sand-blue','peiye','B44'),
  ('sand-green','peiye','151'),
  ('light-nougat','peiye','B27'),
  ('nougat','peiye','18'),
  ('medium-nougat','peiye','312'),
  ('dark-tan','peiye','138'),
  ('tan','peiye','5'),
  ('reddish-brown','peiye','192'),
  ('dark-brown','peiye','308'),
  ('blush','peiye','A08'),
  ('light-peach','peiye','A24'),
  ('peach','peiye','283'),
  ('warm-nougat','peiye','A25'),
  ('taupe','peiye','B17'),
  ('sienna','peiye','38'),
  ('deep-umber','peiye','B16'),
  ('coffee','peiye','B32'),
  ('red','peiye','21'),
  ('dark-red','peiye','154'),
  ('orange','peiye','B20'),
  ('yellow','peiye','24'),
  ('bright-green','peiye','37'),
  ('dark-green','peiye','28'),
  ('olive-green','peiye','B34'),
  ('blue','peiye','23'),
  ('dark-blue','peiye','140'),
  ('medium-blue','peiye','102'),
  ('bright-light-blue','peiye','212'),
  ('medium-azure','peiye','322'),
  ('bright-pink','peiye','222'),
  ('dark-pink','peiye','B03'),
  ('light-pink','peiye','B18'),
  ('medium-lavender','peiye','324'),
  ('dark-purple','peiye','268')
on conflict (color_id, manufacturer) do nothing;
