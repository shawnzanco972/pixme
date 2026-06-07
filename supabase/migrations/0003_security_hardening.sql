-- =====================================================================
-- Pixme — Security Hardening
-- Resolves Supabase security advisor warnings:
--   1. function_search_path_mutable on public.set_updated_at
--   2. {anon,authenticated}_security_definer_function_executable on the
--      trigger function public.increment_workspace_slots_used
--
-- Trigger functions do NOT need EXECUTE granted to API roles — triggers fire
-- with the table owner's privileges regardless. Revoking EXECUTE removes them
-- from the auto-exposed PostgREST RPC surface without breaking the triggers.
-- =====================================================================

-- 1. Pin a stable, empty search_path on the updated_at helper.
--    now() resolves from pg_catalog regardless, so no schema refs are needed.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Remove both trigger functions from the public RPC surface.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.increment_workspace_slots_used() from public, anon, authenticated;
