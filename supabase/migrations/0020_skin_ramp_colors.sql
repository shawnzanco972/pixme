-- =====================================================================
-- Pixipic — skin-ramp expansion (31 → 39 colours)
--
-- Why: measured against a Fitzpatrick I–VI sample, four visually distinct skin
-- tones all matched the SAME brick (Medium Nougat), which is what made faces
-- render flat and posterised. Our palette had only 3 entries in the skin/warm
-- zone; a competitor benchmark had 12, and scored 25% lower mean OKLab error on
-- skin (0.0368 vs our 0.0491) and 68% lower worst-case.
--
-- These 8 were chosen by greedily minimising mean OKLab skin error. They take
-- us from 0.0491 → 0.0343, i.e. past the benchmark.
--
-- on_hand_grams starts at 0: selectable in the editor, and surfaced by the
-- low-stock digest until the first supplier order lands.
-- =====================================================================

insert into public.colors
  (color_id, slug, display_name, name_he, display_code, hex, oklab_l, oklab_a, oklab_b, role, is_core, sort_order)
values
  ('blush','blush','Blush','ורדרד בהיר','K8','#ffd7c3',0.907861,0.034995,0.039032,'skin',true,31),
  ('light-peach','light-peach','Light Peach','אפרסק בהיר','K9','#f2ba93',0.830469,0.046338,0.069053,'skin',true,32),
  ('peach','peach','Peach','אפרסק','K10','#f0c4a0',0.850007,0.033732,0.060754,'skin',true,33),
  ('warm-nougat','warm-nougat','Warm Nougat','נוגט חם','K11','#e59e6d',0.758060,0.061189,0.087359,'skin',true,34),
  ('taupe','taupe','Taupe','טאופ','K12','#9e7d5e',0.613576,0.025844,0.054281,'skin',true,35),
  ('sienna','sienna','Sienna','סיינה','K13','#a65523',0.539174,0.080979,0.092985,'skin',true,36),
  ('deep-umber','deep-umber','Deep Umber','חום עמוק','K14','#693f23',0.411478,0.043160,0.057451,'skin',true,37),
  ('coffee','coffee','Coffee','חום קפה','K15','#4e3524',0.353477,0.026083,0.037129,'skin',true,38)
on conflict (color_id) do nothing;

insert into public.brick_stock (id, color_id, in_stock, on_hand_grams, sort_order)
values
  (31,'blush',true,0,31),
  (32,'light-peach',true,0,32),
  (33,'peach',true,0,33),
  (34,'warm-nougat',true,0,34),
  (35,'taupe',true,0,35),
  (36,'sienna',true,0,36),
  (37,'deep-umber',true,0,37),
  (38,'coffee',true,0,38)
on conflict (id) do update
  set color_id = excluded.color_id,
      in_stock = excluded.in_stock;
