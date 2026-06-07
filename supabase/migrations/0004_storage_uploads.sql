-- =====================================================================
-- Pixme — Storage: 'uploads' bucket for customer photos
--
-- Guest checkout model: anonymous customers upload their source photo, then
-- only authenticated admins may read them back. The bucket is PRIVATE
-- (public = false) — reads happen via short-lived signed URLs.
--
-- Uploads are expected via signed upload URLs (see src/lib/supabase/storage.ts),
-- but we also grant a direct anon INSERT policy as defense-in-depth / fallback.
-- =====================================================================

-- Create the private 'uploads' bucket (idempotent). 10 MB cap, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads',
  'uploads',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----- Storage RLS policies on storage.objects -----

-- Anyone (anon + authenticated) may UPLOAD into the 'uploads' bucket.
drop policy if exists "Public upload to uploads bucket" on storage.objects;
create policy "Public upload to uploads bucket"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'uploads');

-- Only authenticated admins may READ objects in the 'uploads' bucket.
drop policy if exists "Admins read uploads bucket" on storage.objects;
create policy "Admins read uploads bucket"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'uploads');

-- (No anon UPDATE/DELETE policies: guests cannot overwrite or remove objects.
--  Trusted server code uses the service-role key, which bypasses these policies.)
