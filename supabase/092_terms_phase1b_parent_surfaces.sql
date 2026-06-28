-- 092_terms_phase1b_parent_surfaces.sql
-- ═══════════════════════════════════════════════════════════════════
-- Terms Phase 1B — connect existing Terms infrastructure to classes
-- and expose to parents.
-- ═══════════════════════════════════════════════════════════════════
--
-- Reason for this migration
-- ─────────────────────────
-- Migration 028 created public.terms + public.holidays with admin CRUD
-- and own-org SELECT policies. Production has 5 active term rows
-- (Jamie Allan + Gold & Gray + system) but no connection to classes
-- and no parent-facing surfaces. This migration adds the missing
-- connective tissue:
--
--   1. terms.parent_message — academy's parent-facing copy block,
--      surfaced on public booking, class detail, parent dashboard,
--      Membership Hub, booking + subscription emails. Optional.
--
--   2. training_groups.term_id — nullable FK linking a class to one
--      term. ON DELETE SET NULL so deleting a term unlinks classes
--      without losing the classes themselves.
--
--   3. Anon SELECT policy on terms (gated to published orgs) — needed
--      for unauthenticated visitors on /book/[slug] to render term
--      information for the class they're considering.
--
-- All changes are additive. Existing rows (5 terms, 0 holidays, all
-- training_groups) remain functionally identical until an admin
-- explicitly assigns a class to a term via the updated TermManager or
-- the class edit form.
--
-- Surfaces this migration MUST preserve
-- ─────────────────────────────────────
--   • Existing TermManager admin UI behaves identically until the
--     parent_message textarea + class assignment UI are deployed in
--     the same release.
--   • Existing "Admins manage terms" + "Parents read terms" policies
--     unchanged.
--   • Existing holidays table + cascade behaviour unchanged.
--   • No Stripe / billing / subscription / refund / cancellation /
--     attendance / camp / trial / staff path touched.
--
-- Rollback plan
-- ─────────────
--   ALTER TABLE public.training_groups DROP COLUMN IF EXISTS term_id;
--   ALTER TABLE public.terms DROP COLUMN IF EXISTS parent_message;
--   DROP POLICY IF EXISTS "Anon read terms for published orgs" ON public.terms;
-- (Idempotent — safe to re-run.)

BEGIN;

-- ─── 1. parent_message column on terms ───
-- Plain text only (renders in emails and HTML; sanitization at render time
-- is React's default escape). Length capped to 1000 chars to keep emails
-- + UI reasonable.

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS parent_message text;

ALTER TABLE public.terms
  DROP CONSTRAINT IF EXISTS chk_terms_parent_message_len;
ALTER TABLE public.terms
  ADD CONSTRAINT chk_terms_parent_message_len
  CHECK (parent_message IS NULL OR length(parent_message) <= 1000);

COMMENT ON COLUMN public.terms.parent_message IS
  'Optional academy message shown to parents alongside term dates on public booking, class detail, parent dashboard, Membership Hub, and confirmation emails. Plain text only; 1000 char max. Phase 1B (092).';

-- ─── 2. term_id column on training_groups ───
-- Nullable FK. Default behaviour: no term assigned = identical to today.
-- ON DELETE SET NULL: existing TermManager allows admin to delete a term;
-- when that happens, any classes linked to it simply unlink (term info
-- drops off the UI) rather than the classes themselves disappearing.

ALTER TABLE public.training_groups
  ADD COLUMN IF NOT EXISTS term_id uuid
  REFERENCES public.terms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_groups_term_id
  ON public.training_groups(term_id);

COMMENT ON COLUMN public.training_groups.term_id IS
  'Optional link to public.terms. When set, parent-facing surfaces render the term name + dates + parent_message. Phase 1B (092).';

-- ─── 3. Anon SELECT policy for published-org terms ───
-- Public booking pages (/book/[slug]) are unauthenticated. To render
-- the term banner on a class card, anon must be able to SELECT terms
-- where the parent organisation is published. Pattern matches the
-- existing anon SELECT policies on organisations / training_groups /
-- subscription_plans established in migrations 064 + 077.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Anon read terms for published orgs'
      AND tablename  = 'terms'
      AND schemaname = 'public'
  ) THEN
    CREATE POLICY "Anon read terms for published orgs" ON public.terms
      FOR SELECT TO anon
      USING (EXISTS (
        SELECT 1
        FROM public.organisations
        WHERE organisations.id = terms.organisation_id
          AND organisations.is_published = true
      ));
  END IF;
END $$;

-- ─── 4. Verification rows ───
-- Per CLAUDE.md "Trusting 'applied' without proof row" — every
-- migration ends with SELECTs the user can paste back to confirm
-- the state change took.

SELECT
  'terms.parent_message column' AS check,
  count(*) FILTER (WHERE true) AS total_terms,
  count(parent_message) AS terms_with_message
FROM public.terms;

SELECT
  'training_groups.term_id column' AS check,
  count(*) AS total_classes,
  count(term_id) AS classes_with_term
FROM public.training_groups;

SELECT
  'anon SELECT on terms' AS check,
  policyname,
  roles
FROM pg_policies
WHERE tablename = 'terms'
  AND schemaname = 'public'
  AND roles::text LIKE '%anon%';

SELECT
  'training_groups.term_id index' AS check,
  indexname
FROM pg_indexes
WHERE tablename = 'training_groups'
  AND indexname = 'idx_training_groups_term_id';

COMMIT;
