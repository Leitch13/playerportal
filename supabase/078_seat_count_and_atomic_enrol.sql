-- ═══════════════════════════════════════════════════════════════════
-- Migration 078 — public seat-count RPC (display fix)
-- ═══════════════════════════════════════════════════════════════════
-- Closes a regression introduced by 077b. The public booking page uses
-- the anon Supabase server client to count enrolments per group, and
-- 077b restricted enrolments SELECT to authenticated only. The page
-- now displays `max_capacity` spots available on every class card,
-- including ones that are actually full. End-to-end overbookable.
--
-- Fix: a SECURITY DEFINER RPC that returns ONLY {group_id, seat_count}
-- aggregates for an org. Anon-callable. Exposes no PII. Returns the
-- exact same information that was public on the booking page before
-- 077b — no more, no less.
--
-- RLS on enrolments stays exactly as 077b left it (authenticated-only,
-- org-scoped, parent-own-children + staff-org-wide). This migration
-- does NOT reopen any direct SELECT on enrolments.
--
-- Scope notes (per the booking-safety patch brief):
--   • Capacity counts active + pending only (matches existing logic).
--   • Cancelled enrolments excluded.
--   • Trial bookings live in `trial_bookings`, not `enrolments` — never
--     counted toward class capacity. No change to trial behaviour.
--   • Waitlist lives in `waitlist`, not `enrolments` — never counted
--     toward class capacity. No change to waitlist behaviour.
--   • No Stripe, subscription, billing, cancellation, messaging, or
--     Parent Hub code is touched.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_group_seat_counts(p_org_id uuid)
RETURNS TABLE(group_id uuid, seat_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Aggregate-only output. No row-level data leaves this function:
  -- caller gets one row per group with at least one filled seat,
  -- and the seat count for that group. Groups with zero filled
  -- seats are omitted (caller defaults to 0).
  --
  -- Capacity-counted statuses: 'active' + 'pending' only.
  --   • 'active'    — billing live, seat occupied
  --   • 'pending'   — Stage 3 future-start; seat reserved at signup
  --                   (matches pre-077b page behaviour and the
  --                   existing comment in /book/[slug]/page.tsx)
  --   • 'cancelled' — explicitly excluded
  SELECT
    e.group_id,
    count(*)::bigint
  FROM public.enrolments e
  WHERE e.organisation_id = p_org_id
    AND e.status IN ('active', 'pending')
  GROUP BY e.group_id;
$$;

REVOKE ALL ON FUNCTION public.get_group_seat_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_group_seat_counts(uuid) TO anon, authenticated, service_role;


-- ─── Sanity check (returns one row) ───
SELECT
  (SELECT 1 FROM pg_proc
     WHERE proname = 'get_group_seat_counts'
       AND pronamespace = 'public'::regnamespace) AS function_created,
  (SELECT count(*) FROM pg_policies
     WHERE schemaname='public' AND tablename='enrolments') AS enrolments_policy_count;

-- Expected:
--   function_created          = 1
--   enrolments_policy_count   = 5  (unchanged from 077b — no SELECT
--                                   policy added or removed)
