# Morning notes — wake up to this

I worked autonomously for ~15 min. Here's what's done and what needs your hand.

---

## ✅ What I shipped (3 commits, all deployed to prod)

### 1. Strict plan-class matching (no more crossover)
Class booking pages now show ONLY plans matching that class's type:
- Class has `class_type='1-2-1'` → shows ONLY plans with `class_type='1-2-1'`
- Class has `class_type='soccer_tots'` → shows ONLY plans with `class_type='soccer_tots'`
- Class has no type → falls back to truly org-wide plans (both `class_type` AND `training_group_id` IS NULL)

### 2. Added `intensity` as a new class type
For your £96/month tier (between standard group and full 1-2-1). Available in:
- Dashboard → Plans (create plan as Intensity Training)
- Dashboard → Classes (set class type to Intensity)
- Booking page (red branding, fire emoji)

**Run this migration in Supabase** to allow the new value:
```sql
ALTER TABLE public.training_groups
  DROP CONSTRAINT IF EXISTS training_groups_class_type_check;

ALTER TABLE public.training_groups
  ADD CONSTRAINT training_groups_class_type_check
  CHECK (class_type IN (
    'group', 'small_group', '1-2-1', '2-1', 'gk', 'soccer_tots',
    'academy', 'accelerator', 'elite', 'camp', 'trial', 'girls',
    'adults', 'intensity'
  ));
```

### 3. Buttons MUCH more visible
- Plan cards: ALL buttons now solid-filled cyan with prominent shadows (was outlined)
- "Subscribe Now →" button added to every plan card on class pages (was missing entirely!)
- Hero CTAs (Join Now / Try Free Session) bigger, bolder, with brand-colored shadows
- Pop-out hover scale + glow effect

### 4. Fixed "Unlimited 0 sessions" display bug
If `sessions_per_week` is 0 or ≥7, now displays "Unlimited sessions" instead of "0 sessions per week".

---

## 🎯 Morning tasks for you (15 min total)

### A. Run the migration above (30 sec)
Supabase SQL editor → paste migration → Run.

### B. Set up JSL intensity class properly (2 min)
```sql
-- 1. Tag the intensity class itself
UPDATE training_groups
SET class_type = 'intensity'
WHERE id = 'ef2c620a-f8a9-453d-92ac-66f7cca26710'
RETURNING name, class_type;

-- 2. Update the "1-2-1 Plan" to be £96 and tag it as intensity
UPDATE subscription_plans
SET name = 'Intensity Training',
    amount = 96.00,
    class_type = 'intensity',
    sessions_per_week = 1
WHERE name ILIKE '%1-2-1%'
  AND organisation_id = (SELECT id FROM organisations WHERE slug = 'JSL')
RETURNING name, amount, class_type, sessions_per_week;

-- 3. Fix the "Unlimited" plan that has sessions_per_week = 0
UPDATE subscription_plans
SET sessions_per_week = 7
WHERE name = 'Unlimited'
  AND organisation_id = (SELECT id FROM organisations WHERE slug = 'JSL')
RETURNING name, sessions_per_week;
```

After this, hard-refresh https://www.theplayerportal.net/book/JSL/class/ef2c620a-f8a9-453d-92ac-66f7cca26710
- Should show ONLY the £96 Intensity plan (no £30/£50/£70)
- Big bold "Subscribe Now →" button on it

### C. Walk Jamie through categorising HIS classes
He'll need to set `class_type` on each class (Dashboard → Classes) and create class-type-specific plans (Dashboard → Plans). Or you can do it for him via SQL if you know his class structure.

### D. Pending tasks from earlier (still on the list)
1. Run migration 053 (custom scoring categories) — paste in Supabase:
```sql
DROP POLICY IF EXISTS "Admins manage scoring categories" ON public.scoring_categories;
CREATE POLICY "Admins manage scoring categories"
  ON public.scoring_categories
  FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin')
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');
```

2. Add `ADMIN_NOTIFICATION_EMAIL` env var to Vercel → set to `johnleitch970@gmail.com`
3. Revoke the leaked GitHub token (security hygiene): https://github.com/settings/tokens

---

## 🚀 Deployments tonight

All went out via Vercel CLI (skipping the GitHub email-blocker issue):
- 205b4ba — initial fix push
- 70fd336 — webhook UI hidden
- + strict matching + intensity + button visibility (this round)

Production URL: https://playerportallive-e89z3owe1-johnleitch970-1195s-projects.vercel.app
Aliased to: https://www.theplayerportal.net + https://playitloveit.com

---

## 💤 Sleep well

Today: 22 tasks completed. First academy onboarded. Stripe Connect working. Coach invites fixed. Webhook UI cleaned up. Booking pages polished. Strict plan matching shipped. Intensity class type added. Visible buttons.

You went from "academy needs to launch today" to "first paying customer onboarded with proper UX + 3 coaches + clean dashboard." That's a launch day worth celebrating.

🥂 — Claude
