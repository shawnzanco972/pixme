-- =====================================================================
-- Pixipic — Ready-made designs gallery
--
-- A curated catalog of starter artworks (AI-generated or free-to-use) that
-- customers can browse on the homepage and open directly in the /create studio
-- pre-loaded with the artwork and its default baseplate dimensions.
--
-- Admins manage the catalog from /admin/designs. The artwork images are public
-- (they're shown on the marketing homepage), so they live in a PUBLIC bucket —
-- unlike customer photo uploads, which stay private.
-- =====================================================================

-- ----- Public 'designs' bucket for ready-made artwork ----------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'designs',
  'designs',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may READ the public designs bucket (objects are served publicly).
drop policy if exists "Public read designs bucket" on storage.objects;
create policy "Public read designs bucket"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'designs');

-- Only authenticated admins may WRITE (insert/update/delete) design artwork.
-- (Trusted server code uses the service-role key and bypasses these anyway.)
drop policy if exists "Admins write designs bucket" on storage.objects;
create policy "Admins write designs bucket"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'designs')
  with check (bucket_id = 'designs');

-- ----- ready_designs catalog table -----------------------------------------
create table if not exists public.ready_designs (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  image_path      text not null,          -- object path within the 'designs' bucket
  default_plates_x integer not null default 2 check (default_plates_x between 1 and 5),
  default_plates_y integer not null default 2 check (default_plates_y between 1 and 5),
  -- Total 1×1 studs at the default size (24 studs per plate edge). Generated so
  -- it always matches the dimensions; "how many bricks it contains".
  brick_count     integer generated always as
                    (default_plates_x * 24 * default_plates_y * 24) stored,
  sort_order      integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists ready_designs_active_sort_idx
  on public.ready_designs (active, sort_order, created_at desc);

alter table public.ready_designs enable row level security;

-- Public (anon + authenticated) may read only ACTIVE designs for the gallery.
drop policy if exists "Public read active ready_designs" on public.ready_designs;
create policy "Public read active ready_designs"
  on public.ready_designs
  for select
  to anon, authenticated
  using (active = true);

-- Authenticated admins may read everything (incl. inactive) and manage rows.
drop policy if exists "Admins read all ready_designs" on public.ready_designs;
create policy "Admins read all ready_designs"
  on public.ready_designs
  for select
  to authenticated
  using (true);

drop policy if exists "Admins manage ready_designs" on public.ready_designs;
create policy "Admins manage ready_designs"
  on public.ready_designs
  for all
  to authenticated
  using (true)
  with check (true);
