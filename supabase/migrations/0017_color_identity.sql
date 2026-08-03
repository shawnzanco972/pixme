-- =====================================================================
-- Pixipic — Manufacturer-agnostic COLOR IDENTITY
--
-- Three-layer identity (see src/lib/brick-engine/palette.ts):
--   1. color_id      — canonical, stable, internal slug (PK). What the
--                      pixel_map, brick_stock, and orders reference.
--   2. display_code  — OUR short code printed on instructions/legend (N/K/A).
--   3. color_manufacturer_codes — a swappable mapping to each supplier's SKU,
--                      so we reorder in any manufacturer's numbering without
--                      ever coupling color_id to a supplier's scheme.
--
-- OKLab values are authoritative and MUST match palette.ts (computed from the
-- BrickLink-verified hex with the exact formula in color.ts).
-- RLS: public read (catalogue), admin-only write.
-- =====================================================================

-- ---------------------------------------------------------------- colors
create table if not exists public.colors (
  color_id     text        primary key,
  slug         text        not null,
  display_name text        not null,
  name_he      text        not null default '',
  display_code text        not null unique,
  hex          text        not null,
  oklab_l      numeric     not null,
  oklab_a      numeric     not null,
  oklab_b      numeric     not null,
  role         text        not null check (role in ('base','skin','accent')),
  material     text        not null default 'solid',
  is_core      boolean     not null default false,
  sort_order   integer     not null default 0,
  active       boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_colors_updated_at on public.colors;
create trigger trg_colors_updated_at
  before update on public.colors
  for each row execute function public.set_updated_at();

alter table public.colors enable row level security;

drop policy if exists "Public read colors" on public.colors;
create policy "Public read colors"
  on public.colors for select to anon, authenticated using (true);

drop policy if exists "Admins manage colors" on public.colors;
create policy "Admins manage colors"
  on public.colors for all to authenticated using (true) with check (true);

-- Seed: 31 colours (sort_order = engine index). is_core → first order (19).
insert into public.colors
  (color_id, slug, display_name, name_he, display_code, hex, oklab_l, oklab_a, oklab_b, role, is_core, sort_order)
values
  ('white','white','White','לבן','N1','#f2f3f2',0.963111,-0.001396,0.000958,'base',true,0),
  ('light-bluish-gray','light-bluish-gray','Light Bluish Gray','אפור בהיר','N2','#a0a5a9',0.719118,-0.003861,-0.007174,'base',true,1),
  ('dark-bluish-gray','dark-bluish-gray','Dark Bluish Gray','אפור כהה','N3','#6c6e68',0.534583,-0.005000,0.008071,'base',true,2),
  ('black','black','Black','שחור','N4','#1b1b1b',0.222129,0.000000,0.000000,'base',true,3),
  ('sand','sand','Sand','חול','N5','#c2b280',0.765006,-0.002930,0.069047,'base',false,4),
  ('sand-blue','sand-blue','Sand Blue','כחול חול','N6','#5a748c',0.547702,-0.019179,-0.044441,'base',false,5),
  ('sand-green','sand-green','Sand Green','ירוק חול','N7','#7d9c86',0.662790,-0.042593,0.020719,'base',false,6),
  ('light-nougat','light-nougat','Light Nougat','נוגט בהיר','K1','#f6d7b3',0.896092,0.018966,0.055525,'skin',true,7),
  ('nougat','nougat','Nougat','נוגט','K2','#cc8e69',0.699670,0.056738,0.071446,'skin',true,8),
  ('medium-nougat','medium-nougat','Medium Nougat','נוגט בינוני','K3','#aa7d55',0.624994,0.036584,0.069535,'skin',false,9),
  ('dark-tan','dark-tan','Dark Tan','בז'' כהה','K4','#958a73',0.636777,0.002822,0.035459,'skin',false,10),
  ('tan','tan','Tan','בז''','K5','#e4cd9e',0.856056,0.005980,0.066498,'skin',true,11),
  ('reddish-brown','reddish-brown','Reddish Brown','חום אדמדם','K6','#582a12',0.342609,0.053012,0.055174,'skin',true,12),
  ('dark-brown','dark-brown','Dark Brown','חום כהה','K7','#3b2412',0.284932,0.024447,0.038549,'skin',false,13),
  ('red','red','Red','אדום','A1','#c91a09',0.533542,0.179024,0.104117,'accent',true,14),
  ('dark-red','dark-red','Dark Red','אדום כהה','A2','#720e0f',0.355948,0.118500,0.060405,'accent',false,15),
  ('orange','orange','Orange','כתום','A3','#fe8a18',0.746548,0.097879,0.146693,'accent',true,16),
  ('yellow','yellow','Yellow','צהוב','A4','#f2cd37',0.856067,-0.011958,0.160486,'accent',true,17),
  ('bright-green','bright-green','Bright Green','ירוק','A5','#4b9f4a',0.630002,-0.117458,0.087278,'accent',true,18),
  ('dark-green','dark-green','Dark Green','ירוק כהה','A6','#237841',0.508354,-0.103210,0.056758,'accent',true,19),
  ('olive-green','olive-green','Olive Green','ירוק זית','A7','#9b9a5a',0.672189,-0.026059,0.081570,'accent',false,20),
  ('blue','blue','Blue','כחול','A8','#0055bf',0.475106,-0.035694,-0.177297,'accent',true,21),
  ('dark-blue','dark-blue','Dark Blue','כחול כהה','A9','#0a3463',0.326046,-0.024824,-0.090939,'accent',true,22),
  ('medium-blue','medium-blue','Medium Blue','כחול בינוני','A10','#5a93db',0.655686,-0.032047,-0.119635,'accent',true,23),
  ('bright-light-blue','bright-light-blue','Bright Light Blue','תכלת','A11','#9fc3e9',0.804124,-0.022707,-0.062541,'accent',true,24),
  ('medium-azure','medium-azure','Medium Azure','טורקיז','A12','#36aebf',0.693027,-0.092202,-0.050669,'accent',true,25),
  ('bright-pink','bright-pink','Bright Pink','ורוד','A13','#e4adc8',0.805963,0.071261,-0.015318,'accent',true,26),
  ('dark-pink','dark-pink','Dark Pink','ורוד כהה','A14','#c870a0',0.657766,0.121774,-0.027696,'accent',false,27),
  ('light-pink','light-pink','Light Pink','ורוד בהיר','A15','#f6adc6',0.823779,0.090542,-0.004685,'accent',false,28),
  ('medium-lavender','medium-lavender','Medium Lavender','לבנדר','A16','#ac78ba',0.648939,0.084146,-0.073235,'accent',false,29),
  ('dark-purple','dark-purple','Dark Purple','סגול כהה','A17','#3f3691',0.398410,0.030257,-0.141199,'accent',false,30)
on conflict (color_id) do nothing;

-- ------------------------------------------------ color_manufacturer_codes
create table if not exists public.color_manufacturer_codes (
  id           bigint generated always as identity primary key,
  color_id     text        not null references public.colors(color_id) on delete cascade,
  manufacturer text        not null,
  code         text        not null,
  sku          text,
  created_at   timestamptz not null default now(),
  unique (color_id, manufacturer)
);

create index if not exists idx_cmc_manufacturer
  on public.color_manufacturer_codes (manufacturer);

alter table public.color_manufacturer_codes enable row level security;

drop policy if exists "Public read manufacturer codes" on public.color_manufacturer_codes;
create policy "Public read manufacturer codes"
  on public.color_manufacturer_codes for select to anon, authenticated using (true);

drop policy if exists "Admins manage manufacturer codes" on public.color_manufacturer_codes;
create policy "Admins manage manufacturer codes"
  on public.color_manufacturer_codes for all to authenticated using (true) with check (true);

-- GoBricks (LDraw numbering) — verified from GoBricks_BulkOrder_ColorMapping.csv.
-- Colours absent from that sheet are intentionally left UNMAPPED here and must
-- be backfilled from the supplier catalogue before ordering them.
insert into public.color_manufacturer_codes (color_id, manufacturer, code) values
  ('black','gobricks','0'),
  ('white','gobricks','15'),
  ('light-bluish-gray','gobricks','71'),
  ('dark-bluish-gray','gobricks','72'),
  ('dark-tan','gobricks','28'),
  ('light-nougat','gobricks','78'),
  ('nougat','gobricks','92'),
  ('medium-nougat','gobricks','150'),
  ('reddish-brown','gobricks','70'),
  ('dark-brown','gobricks','308'),
  ('tan','gobricks','19'),
  ('red','gobricks','4'),
  ('dark-red','gobricks','320'),
  ('blue','gobricks','1'),
  ('dark-blue','gobricks','272'),
  ('bright-light-blue','gobricks','212'),
  ('medium-azure','gobricks','322'),
  ('bright-green','gobricks','2'),
  ('dark-green','gobricks','288'),
  ('yellow','gobricks','14'),
  ('orange','gobricks','25')
on conflict (color_id, manufacturer) do nothing;

-- BrickLink — the 6 new colours (authoritative ids from the sourcing brief).
-- Remaining BrickLink ids to be backfilled (data-only) as they are verified.
insert into public.color_manufacturer_codes (color_id, manufacturer, code) values
  ('sand-blue','bricklink','55'),
  ('sand-green','bricklink','48'),
  ('olive-green','bricklink','155'),
  ('light-pink','bricklink','23'),
  ('medium-lavender','bricklink','157'),
  ('dark-purple','bricklink','89')
on conflict (color_id, manufacturer) do nothing;
