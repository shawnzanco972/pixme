-- =====================================================================
-- Pixipic — Ready-made designs: admin-authored default engine settings.
--
-- Beyond the artwork + size, the admin tunes the brick-engine adjustments
-- (crop/zoom, contrast, saturation, line-art, etc.) and saves them as the
-- design's starting point. When a customer opens the design these settings
-- seed the studio; the customer can still change anything.
--
-- Stored as JSONB (shape: src/lib/design-settings.ts → EngineSettings). NULL
-- means "use the studio's built-in defaults".
-- =====================================================================
alter table public.ready_designs
  add column if not exists settings jsonb;
