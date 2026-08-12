-- =====================================================================
-- Pixipic — 0024: realign the palette to the SUPPLIER as source of truth,
-- and fix the `coffee` colour-map bug.
--
-- Context: nothing in this project has been physically validated yet. The one
-- real source of truth we have is Shantou Chenghai Peiye Toys' own published
-- RGB chart (workbook sheet "2021-6", 94 colours). Until now `colors.hex` held
-- LEGO/BrickLink values, so the studio preview and the PDF legend showed a
-- colour the customer would never receive — up to 0.106 OKLab away from the
-- plate we actually ship (`reddish-brown`: our #582a12 vs their #73483a).
--
-- Three changes:
--
-- 1. HEX + OKLAB REALIGNMENT (all 42 colours)
--    Every colour with a Peiye SKU adopts that SKU's exact RGB. `color_id`,
--    `display_code`, role and sort_order are untouched, so every persisted
--    pixel_map keeps decoding. Notable shifts:
--      black             #1b1b1b -> #302e32  (Peiye has NO true black; their
--                                             darkest plate is OKLab L 0.305)
--      reddish-brown     #582a12 -> #73483a
--      dark-brown        #3b2412 -> #523e37
--      dark-red          #720e0f -> #853433
--      light-pink        #f6adc6 -> #dfc8df
--    Deep shadows will read lighter than they did. That is a property of the
--    bricks we can buy, not a regression.
--
-- 2. FIX `coffee` -> B32 (BUG)
--    Migration 0023 mapped `coffee` (a deep-brown skin/hair tone, #4e3524) to
--    Peiye B32 #38453a — which is 军绿, ARMY GREEN. It was picked by plain
--    OKLab distance, where a dark desaturated green sits close to a dark brown,
--    and the collision-avoidance pass in 0023 had already taken 308. Left in
--    place this would put green studs through dark hair — the exact class of
--    bug commit fe89bce ("kill the random green studs") was written to fix.
--    Peiye simply has no brown darker than 308, so `coffee` now has NO
--    manufacturer code and is out of stock; `remapPixelMap` folds it onto
--    `dark-brown`. Re-add it only when a supplier actually carries it.
--
-- 3. FIRST-ORDER STOCK (19 core -> 30 core)
--    `is_core`/`brick_stock.in_stock` now reflect the 30 colours in the first
--    Peiye order (350,000 pcs of part 3024, ~52.5 kg). Selection was measured:
--    greedy minimisation of weighted OKLab error over the 42-colour catalogue
--    picked these 30 at error 0.08410, vs 0.16238 for the 24 sampled colours
--    and 0.06997 for an optimal 40. See Pixipic_FirstOrder_Peiye_Brief.md.
--    The 12 non-core colours each keep a DISTINCT Peiye SKU (except `coffee`),
--    so the second order is a data change only.
-- =====================================================================

-- 1. hex + OKLab -------------------------------------------------------
update public.colors as c
   set hex = v.hex, oklab_l = v.l, oklab_a = v.a, oklab_b = v.b
  from (values
  ('white','#f7f0e3',0.957070,0.002271,0.018668),
  ('light-bluish-gray','#a3a9aa',0.730285,-0.006124,-0.003363),
  ('dark-bluish-gray','#6f7176',0.548546,-0.000213,-0.008088),
  ('black','#302e32',0.304804,0.004699,-0.005975),
  ('sand','#c0bba2',0.789409,-0.004710,0.034404),
  ('sand-blue','#576c7a',0.519445,-0.017988,-0.028214),
  ('sand-green','#749883',0.646547,-0.047367,0.018175),
  ('mid-gray','#868684',0.619439,-0.000840,0.002838),
  ('pale-gray','#bfc3c9',0.815836,-0.001919,-0.009300),
  ('charcoal','#4b4c50',0.417031,0.000567,-0.006701),
  ('light-nougat','#ffd4b9',0.899894,0.035625,0.048806),
  ('nougat','#de9064',0.723345,0.072292,0.085284),
  ('medium-nougat','#b37c51',0.632697,0.047492,0.076644),
  ('dark-tan','#998769',0.631791,0.008036,0.047142),
  ('tan','#dfc790',0.836882,0.003911,0.076385),
  ('reddish-brown','#73483a',0.447425,0.049516,0.039797),
  ('dark-brown','#523e37',0.383500,0.023384,0.019731),
  ('blush','#ffd7c3',0.907861,0.034995,0.039032),
  ('light-peach','#f1b993',0.827589,0.046784,0.067929),
  ('peach','#ebc0a4',0.838460,0.035950,0.050868),
  ('warm-nougat','#eca279',0.775193,0.067364,0.079358),
  ('taupe','#aa8b6e',0.658114,0.023761,0.050294),
  ('sienna','#ab5827',0.551779,0.083119,0.093168),
  ('deep-umber','#724345',0.439160,0.062286,0.019433),
  ('coffee','#4e3524',0.353477,0.026083,0.037129),
  ('red','#cd2928',0.552006,0.177735,0.090727),
  ('dark-red','#853433',0.438456,0.102710,0.044785),
  ('orange','#ff7e30',0.730650,0.120827,0.132083),
  ('yellow','#ffd300',0.878884,-0.011234,0.179726),
  ('bright-green','#00a64d',0.633953,-0.150679,0.086116),
  ('dark-green','#00863a',0.541651,-0.130065,0.076581),
  ('olive-green','#99a444',0.690105,-0.051418,0.109709),
  ('blue','#0065b2',0.500990,-0.047657,-0.136807),
  ('dark-blue','#23415d',0.365606,-0.022448,-0.056248),
  ('medium-blue','#58a3da',0.689899,-0.051087,-0.098006),
  ('bright-light-blue','#93bce6',0.780672,-0.026242,-0.069874),
  ('medium-azure','#00b5cc',0.708765,-0.105655,-0.062747),
  ('bright-pink','#edaad6',0.814322,0.090585,-0.033017),
  ('dark-pink','#c081a1',0.676887,0.085993,-0.018489),
  ('light-pink','#dfc8df',0.858777,0.033214,-0.022470),
  ('medium-lavender','#ae78c2',0.654661,0.088409,-0.083719),
  ('dark-purple','#673e87',0.445868,0.075200,-0.095683)
       ) as v(color_id, hex, l, a, b)
 where c.color_id = v.color_id;

-- 2. manufacturer codes: full authoritative rewrite for peiye ----------
--    `coffee` is deliberately absent (no Peiye equivalent — see header).
delete from public.color_manufacturer_codes where manufacturer = 'peiye';

insert into public.color_manufacturer_codes (color_id, manufacturer, code) values
  ('white','peiye','1'),
  ('light-bluish-gray','peiye','194'),
  ('dark-bluish-gray','peiye','199'),
  ('black','peiye','26'),
  ('sand','peiye','B23'),
  ('sand-blue','peiye','B44'),
  ('sand-green','peiye','151'),
  ('mid-gray','peiye','B45'),
  ('pale-gray','peiye','A02'),
  ('charcoal','peiye','A29'),
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
  ('red','peiye','21'),
  ('dark-red','peiye','154'),
  ('orange','peiye','106'),
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
  ('light-pink','peiye','B01'),
  ('medium-lavender','peiye','324'),
  ('dark-purple','peiye','268')
on conflict (color_id, manufacturer) do update set code = excluded.code;

-- 3. first-order stock: the 30 core colours ----------------------------
update public.colors as c
   set is_core = v.core
  from (values
  ('white',true),
  ('light-bluish-gray',true),
  ('dark-bluish-gray',true),
  ('black',true),
  ('sand',false),
  ('sand-blue',false),
  ('sand-green',true),
  ('mid-gray',true),
  ('pale-gray',true),
  ('charcoal',true),
  ('light-nougat',true),
  ('nougat',true),
  ('medium-nougat',true),
  ('dark-tan',true),
  ('tan',true),
  ('reddish-brown',true),
  ('dark-brown',true),
  ('blush',false),
  ('light-peach',true),
  ('peach',false),
  ('warm-nougat',false),
  ('taupe',false),
  ('sienna',true),
  ('deep-umber',false),
  ('coffee',false),
  ('red',true),
  ('dark-red',true),
  ('orange',true),
  ('yellow',true),
  ('bright-green',true),
  ('dark-green',true),
  ('olive-green',false),
  ('blue',true),
  ('dark-blue',true),
  ('medium-blue',true),
  ('bright-light-blue',true),
  ('medium-azure',true),
  ('bright-pink',true),
  ('dark-pink',false),
  ('light-pink',false),
  ('medium-lavender',true),
  ('dark-purple',false)
       ) as v(color_id, core)
 where c.color_id = v.color_id;

insert into public.brick_stock (id, color_id, in_stock, sort_order, supply_confirmed)
values
  (0,'white',true,0,false),
  (1,'light-bluish-gray',true,1,false),
  (2,'dark-bluish-gray',true,2,false),
  (3,'black',true,3,false),
  (23,'sand',false,23,false),
  (25,'sand-blue',false,25,false),
  (26,'sand-green',true,26,false),
  (39,'mid-gray',true,39,false),
  (40,'pale-gray',true,40,false),
  (41,'charcoal',true,41,false),
  (10,'light-nougat',true,10,false),
  (9,'nougat',true,9,false),
  (8,'medium-nougat',true,8,false),
  (6,'dark-tan',true,6,false),
  (7,'tan',true,7,false),
  (4,'reddish-brown',true,4,false),
  (5,'dark-brown',true,5,false),
  (31,'blush',false,31,false),
  (32,'light-peach',true,32,false),
  (33,'peach',false,33,false),
  (34,'warm-nougat',false,34,false),
  (35,'taupe',false,35,false),
  (36,'sienna',true,36,false),
  (37,'deep-umber',false,37,false),
  (38,'coffee',false,38,false),
  (11,'red',true,11,false),
  (12,'dark-red',true,12,false),
  (13,'orange',true,13,false),
  (14,'yellow',true,14,false),
  (15,'bright-green',true,15,false),
  (16,'dark-green',true,16,false),
  (27,'olive-green',false,27,false),
  (17,'blue',true,17,false),
  (18,'dark-blue',true,18,false),
  (19,'medium-blue',true,19,false),
  (20,'bright-light-blue',true,20,false),
  (24,'medium-azure',true,24,false),
  (22,'bright-pink',true,22,false),
  (21,'dark-pink',false,21,false),
  (28,'light-pink',false,28,false),
  (29,'medium-lavender',true,29,false),
  (30,'dark-purple',false,30,false)
on conflict (id) do update
  set color_id = excluded.color_id,
      in_stock = excluded.in_stock;
