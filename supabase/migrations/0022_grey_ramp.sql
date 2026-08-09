-- =====================================================================
-- Pixipic — grey ramp (39 → 42 colours) + supply-confirmation flag
--
-- Bug this fixes: customers reported "random green studs". Root cause was a
-- LIGHTNESS HOLE in the neutrals — our greys jumped straight from
-- Dark Bluish Gray (OKLab L 0.535) to Light Bluish Gray (L 0.719). A mid-tone
-- grey subject (concrete, overcast sky, grey clothing) had no neutral at its
-- own lightness, so the matcher picked whichever chromatic brick shared it:
-- Sand Green, at L 0.663.
--
-- Measured over the sRGB cube, genuinely neutral pixels (chroma < 0.028)
-- landing on a green brick: 2 before, 0 after. The chroma-overshoot guard was
-- already suppressing most of it (6 without the guard), but could not fix a
-- hole in the palette itself.
--
-- All three exist in the supplier catalogue: B45, A02, A29.
-- =====================================================================

insert into public.colors
  (color_id, slug, display_name, name_he, display_code, hex, oklab_l, oklab_a, oklab_b, role, is_core, sort_order)
values
  ('mid-gray','mid-gray','Mid Gray','אפור בינוני','N8','#868684',0.619439,-0.000840,0.002838,'base',true,39),
  ('pale-gray','pale-gray','Pale Gray','אפור חיוור','N9','#bfc3c9',0.815836,-0.001919,-0.009300,'base',true,40),
  ('charcoal','charcoal','Charcoal','פחם','N10','#4b4c50',0.417031,0.000567,-0.006701,'base',true,41)
on conflict (color_id) do nothing;

insert into public.brick_stock (id, color_id, in_stock, on_hand_grams, sort_order, supply_confirmed)
values
  (39,'mid-gray',  true, 0, 39, false),
  (40,'pale-gray', true, 0, 40, false),
  (41,'charcoal',  true, 0, 41, false)
on conflict (id) do update
  set color_id = excluded.color_id,
      in_stock = excluded.in_stock;

-- Supplier codes confirmed from Peiye's own RGB chart (2021-6 sheet).
insert into public.color_manufacturer_codes (color_id, manufacturer, code) values
  ('mid-gray','peiye','B45'),
  ('pale-gray','peiye','A02'),
  ('charcoal','peiye','A29')
on conflict (color_id, manufacturer) do nothing;
