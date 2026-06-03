-- 076: Class-level cancellation tracking
--
-- Extends the existing cancellations table so it can record class-level
-- cancellations alongside subscription-level cancellations. ONE audit
-- table, ONE retention-analytics query, gives the academy a unified
-- view of why families cancel and what we offered them.
--
-- Backwards-compatible:
--   • Both new columns nullable, no defaults required for old rows.
--   • Existing rows backfilled to cancellation_type = 'subscription' so
--     analytics queries can group by type immediately.
--   • CHECK constraint on reason extended to include 'schedule_conflict'
--     (the class-cancel modal has a "Schedule doesn't work" reason that
--     didn't fit the legacy subscription-level enum). Adding a value to
--     a CHECK is safe — no existing rows reject.

alter table public.cancellations
  add column if not exists enrolment_id uuid references public.enrolments(id) on delete set null;

alter table public.cancellations
  add column if not exists cancellation_type text;

update public.cancellations
  set cancellation_type = 'subscription'
  where cancellation_type is null;

-- Extend the reason CHECK constraint. Drop + recreate is the standard
-- pattern for adding a value safely.
alter table public.cancellations drop constraint if exists cancellations_reason_check;
alter table public.cancellations add constraint cancellations_reason_check
  check (reason in (
    'too_expensive',
    'not_using',
    'switching',
    'child_stopped',
    'unhappy',
    'other',
    'schedule_conflict'   -- new: class-level "Schedule doesn't work"
  ));

-- Index for the admin "why are families cancelling" analytics surface.
create index if not exists idx_cancellations_type_org
  on public.cancellations (organisation_id, cancellation_type, created_at desc);

-- Index for joining a specific enrolment back to its cancellation row.
create index if not exists idx_cancellations_enrolment
  on public.cancellations (enrolment_id) where enrolment_id is not null;

comment on column public.cancellations.enrolment_id is
  'For class-level cancellations: the enrolment row that was cancelled. NULL for subscription-level cancellations.';
comment on column public.cancellations.cancellation_type is
  'subscription | class — drives admin analytics filtering. Backfilled to subscription for legacy rows.';
