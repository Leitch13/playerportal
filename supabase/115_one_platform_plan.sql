-- 115: one platform plan.
-- The fee-model change (18 Aug) priced Starter/Pro/Enterprise all at £35 with
-- identical feature_keys but left all three ACTIVE, so the trial-ended lock
-- screen and /dashboard/billing still offered three identical "options"
-- (Ryan Turner, Talent FA, 10 Sep). Keep one: "Player Portal" (the old Pro
-- row, id baceb247…). Repoint every org on Starter/Enterprise to it — same
-- feature set, so nothing changes for them; their Stripe subscriptions are
-- untouched (the price object lives on the subscription, not the plan row).
UPDATE public.platform_plans
   SET name = 'Player Portal', sort_order = 1
 WHERE id = 'baceb247-98b1-4394-8d3e-885557c9622f';

UPDATE public.platform_plans
   SET is_active = false
 WHERE slug IN ('starter', 'enterprise');

UPDATE public.organisations
   SET platform_plan_id = 'baceb247-98b1-4394-8d3e-885557c9622f'
 WHERE platform_plan_id IN ('02aa37d7-b155-4143-8fcb-18ee0f4946af',
                            '8e7acc66-493c-4fdf-ba1c-80b898c0ef60');

SELECT name, slug, monthly_price, is_active FROM public.platform_plans ORDER BY sort_order;
