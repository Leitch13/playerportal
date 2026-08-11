-- 103 — Class publish/unpublish
--
-- Adds an is_published flag to training_groups so an academy can HIDE a class
-- from the public booking surfaces while keeping all its records (registers,
-- attendance, past enrolments, billing) fully intact. This is the "unpublish
-- instead of delete" capability the class delete-error already promised but
-- that never existed.
--
-- DEFAULT true + NOT NULL => every existing class is published, so this
-- migration changes NO behaviour on its own. The public booking pages only
-- start hiding a class once an admin flips it to false.
--
-- ⚠️ DEPLOY ORDER: this migration MUST be applied BEFORE the app code that
-- filters on is_published. A prior "consistency" patch filtered this column
-- before it existed and blanked every academy's Weekly Classes section
-- (the PostgREST query errored -> zero rows). Column first, then deploy.

ALTER TABLE public.training_groups
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.training_groups.is_published IS
  'When false, the class is hidden from public booking surfaces (booking page, embed, trial, class detail) but remains fully operational for enrolled families and staff. Default true.';
