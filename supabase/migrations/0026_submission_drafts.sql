-- =====================================================================
-- Pixipic — employee "save for later" drafts
--
-- An employee picking the photo for their own gift is not filling a form; they
-- try three photos, ask their partner, and come back in the evening. Without a
-- draft state the only way to keep work was to SUBMIT it, which lit the seat up
-- as "ממתין לאישורכם" on the manager's dashboard and invited them to approve a
-- design the employee wasn't finished with.
--
-- `is_draft` keeps the row invisible to the review queue until the employee
-- actually submits. It is NOT a new submission_status value because status is
-- also the production lifecycle (pending → ready → …) and a draft is orthogonal
-- to it: a draft is always 'pending', it just hasn't been handed over yet.
-- =====================================================================

alter table public.employee_submissions
  add column if not exists is_draft boolean not null default false;

-- Existing rows were all real submissions; the default already reflects that.
create index if not exists idx_employee_submissions_draft
  on public.employee_submissions(workspace_id, is_draft);
