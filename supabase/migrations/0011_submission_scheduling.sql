-- =====================================================================
-- Pixme — Per-seat scheduling + owner review timestamps
--
-- B2B owners place orders per employee (e.g. a gift on each birthday), so a
-- submission can be APPROVED now but scheduled to be produced/shipped later.
--   - scheduled_for: optional target fulfillment date for one employee's mosaic.
--   - approved_at:   when the owner approved (status → ready), for the queue.
-- Both nullable; existing rows are unaffected.
-- =====================================================================

alter table public.employee_submissions
  add column if not exists scheduled_for timestamptz,
  add column if not exists approved_at   timestamptz;
