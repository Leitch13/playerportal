-- 073: One-shot backfill of Jamie Allan Football Academy's 1-2-1 plans.
-- Run AFTER 072. Idempotent (UPDATE … WHERE id =).
--
-- This sets sessions_per_month for the two Jamie plans that have the
-- monthly cadence encoded in their name. All other plans (Mini Ballers,
-- 1 Session / Week, Unlimited, etc.) keep sessions_per_month = NULL and
-- will fall back to calendar-day proration even after Jamie's org flips
-- to session mode.
--
-- Does NOT activate session mode for Jamie's org. That's a separate step
-- (074 or a manual UPDATE) gated on Test Clock probe + preview UAT pass.

update public.subscription_plans
set sessions_per_month = 2
where id = 'bcd4b313-08f6-4f85-bfb2-aff6017ebb78'   -- "1-2-1 - 2 x Per Month"
  and organisation_id = 'd99aa6e4-514b-42db-9c2a-523aab90e678';

update public.subscription_plans
set sessions_per_month = 4
where name = '1-2-1 - 4 Sessions Per Month '         -- trailing space matches DB
  and organisation_id = 'd99aa6e4-514b-42db-9c2a-523aab90e678';

-- Verification (expected: 2 rows, sessions_per_month populated)
select id, name, amount, sessions_per_month
from public.subscription_plans
where organisation_id = 'd99aa6e4-514b-42db-9c2a-523aab90e678'
  and sessions_per_month is not null
order by amount;
