-- =====================================================================
-- Pixipic — migrate stored data from the RETIRED integer palette (ids 0–24)
-- to canonical color_id slugs.
--
-- Determinism is preserved: this only RELABELS cells (int → slug) via a fixed
-- 1:1 map; it never re-runs image processing. The same image+options still
-- reproduces the same pixel_map, now in color_id space. Guarded so it is
-- idempotent (skips rows already in slug form).
--
-- Depends on 0017 (colors table). Mirrors LEGACY_ID_TO_SLUG in palette.ts.
-- =====================================================================

-- Permanent mapping table (kept as the migration's audit note).
create table if not exists public.legacy_color_map (
  legacy_id int  primary key,
  color_id  text not null references public.colors(color_id)
);

insert into public.legacy_color_map (legacy_id, color_id) values
  (0,'white'),(1,'light-bluish-gray'),(2,'dark-bluish-gray'),(3,'black'),
  (4,'reddish-brown'),(5,'dark-brown'),(6,'dark-tan'),(7,'tan'),
  (8,'medium-nougat'),(9,'nougat'),(10,'light-nougat'),(11,'red'),
  (12,'dark-red'),(13,'orange'),(14,'yellow'),(15,'bright-green'),
  (16,'dark-green'),(17,'blue'),(18,'dark-blue'),(19,'medium-blue'),
  (20,'bright-light-blue'),(21,'dark-pink'),(22,'bright-pink'),(23,'sand'),
  (24,'medium-azure')
on conflict (legacy_id) do nothing;

-- Relabel a 2D int JSONB pixel_map → 2D slug JSONB, preserving order.
create or replace function public._pm_int_to_slug(pm jsonb)
returns jsonb language sql stable as $$
  select case
    when pm is null or jsonb_typeof(pm) <> 'array' then pm
    else coalesce((
      select jsonb_agg(
        (
          select jsonb_agg(lc.color_id order by c.ord)
          from jsonb_array_elements(r.value) with ordinality as c(val, ord)
          join public.legacy_color_map lc on lc.legacy_id = (c.val)::int
        )
        order by r.ord
      )
      from jsonb_array_elements(pm) with ordinality as r(value, ord)
    ), pm)
  end
$$;

-- Backfill every table that stores a pixel_map. Guard: only rows still in
-- integer form (first cell is a JSON number) — idempotent + safe to re-run.
do $$
declare
  tbl text;
begin
  foreach tbl in array array['orders','b2c_orders','employee_submissions'] loop
    if to_regclass('public.' || tbl) is not null then
      execute format(
        'update public.%I
           set pixel_map = public._pm_int_to_slug(pixel_map)
         where pixel_map is not null
           and jsonb_typeof(pixel_map) = ''array''
           and jsonb_array_length(pixel_map) > 0
           and jsonb_typeof(pixel_map->0) = ''array''
           and jsonb_array_length(pixel_map->0) > 0
           and jsonb_typeof(pixel_map->0->0) = ''number''',
        tbl
      );
    end if;
  end loop;
end $$;

-- ------------------------------------------------- re-key brick_stock → color_id
-- Add the canonical key alongside the legacy integer id (kept for a transition;
-- the studio's default availability still falls back to palette `core`).
alter table public.brick_stock
  add column if not exists color_id text references public.colors(color_id);

update public.brick_stock bs
   set color_id = lc.color_id
  from public.legacy_color_map lc
 where lc.legacy_id = bs.id
   and bs.color_id is null;

create unique index if not exists idx_brick_stock_color_id
  on public.brick_stock (color_id);
