-- ============================================================
-- 007: Multi-Organisation Support
-- Run this in Supabase SQL Editor.
-- Safe to re-run — uses IF NOT EXISTS / IF EXISTS throughout.
-- ============================================================


-- ─────────────────────────────────────────────
-- STEP 1: Create organisations table
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organisations (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  logo_url    text,
  primary_color text DEFAULT '#0a0a0a',
  accent_color  text DEFAULT '#4ecde6',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organisations_slug ON public.organisations(slug);

-- Insert default org for existing data
INSERT INTO public.organisations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organisation', 'default')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────
-- STEP 2: Add organisation_id to profiles FIRST
-- ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);

UPDATE public.profiles
  SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN organisation_id SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN organisation_id SET DEFAULT '00000000-0000-0000-0000-000000000001';

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organisation_id);


-- ─────────────────────────────────────────────
-- STEP 3: Create helper functions
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT organisation_id FROM public.profiles WHERE id = auth.uid();
$$;


-- ─────────────────────────────────────────────
-- STEP 4: Ensure prerequisite tables exist
-- (from migrations 004 and 006)
-- ─────────────────────────────────────────────

-- Documents table (from 004)
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text NOT NULL,
  doc_type text DEFAULT 'link',
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  folder text DEFAULT 'General',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Session notes table (from 004)
CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  notes text NOT NULL,
  focus_areas text,
  players_of_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

-- Subscription plans table (from 006)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  amount numeric(10,2) NOT NULL,
  interval text NOT NULL DEFAULT 'month',
  sessions_per_week integer DEFAULT 1,
  stripe_price_id text,
  stripe_product_id text,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Subscriptions table (from 006)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'incomplete',
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────
-- STEP 5: Add organisation_id to ALL other tables
-- ─────────────────────────────────────────────

-- PLAYERS
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.players SET organisation_id = (
  SELECT p.organisation_id FROM public.profiles p WHERE p.id = players.parent_id
) WHERE organisation_id IS NULL;
UPDATE public.players SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.players ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_org ON public.players(organisation_id);

-- TRAINING GROUPS
ALTER TABLE public.training_groups
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.training_groups SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.training_groups ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_groups_org ON public.training_groups(organisation_id);

-- ENROLMENTS
ALTER TABLE public.enrolments
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.enrolments SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.enrolments ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_enrolments_org ON public.enrolments(organisation_id);

-- ATTENDANCE
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.attendance SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.attendance ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_org ON public.attendance(organisation_id);

-- PROGRESS REVIEWS
ALTER TABLE public.progress_reviews
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.progress_reviews SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.progress_reviews ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_org ON public.progress_reviews(organisation_id);

-- MESSAGES
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.messages SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_org ON public.messages(organisation_id);

-- PAYMENTS
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.payments SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.payments ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_org ON public.payments(organisation_id);

-- TRAINING PLANS
ALTER TABLE public.training_plans
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.training_plans SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.training_plans ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_training_plans_org ON public.training_plans(organisation_id);

-- DOCUMENTS
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.documents SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.documents ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organisation_id);

-- SESSION NOTES
ALTER TABLE public.session_notes
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.session_notes SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.session_notes ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_notes_org ON public.session_notes(organisation_id);

-- SUBSCRIPTION PLANS
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.subscription_plans SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.subscription_plans ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscription_plans_org ON public.subscription_plans(organisation_id);

-- SUBSCRIPTIONS
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS organisation_id uuid REFERENCES public.organisations(id);
UPDATE public.subscriptions SET organisation_id = '00000000-0000-0000-0000-000000000001'
  WHERE organisation_id IS NULL;
ALTER TABLE public.subscriptions ALTER COLUMN organisation_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON public.subscriptions(organisation_id);


-- ─────────────────────────────────────────────
-- STEP 6: Organisation RLS (now that profiles has the column)
-- ─────────────────────────────────────────────
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view organisations" ON public.organisations;
CREATE POLICY "Anyone can view organisations"
  ON public.organisations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage own organisation" ON public.organisations;
CREATE POLICY "Admins manage own organisation"
  ON public.organisations FOR ALL
  USING (
    id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  )
  WITH CHECK (
    id = public.get_my_org()
    AND public.get_my_role() = 'admin'
  );


-- ─────────────────────────────────────────────
-- STEP 7: Drop old RLS policies & recreate with org scoping
-- ─────────────────────────────────────────────

-- ─── PROFILES ───
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and coaches can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "Org members can view org profiles"
  ON public.profiles FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins can manage org profiles"
  ON public.profiles FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- ─── PLAYERS ───
DROP POLICY IF EXISTS "Parents see own children" ON public.players;
DROP POLICY IF EXISTS "Admins and coaches see all players" ON public.players;
DROP POLICY IF EXISTS "Parents can insert own children" ON public.players;
DROP POLICY IF EXISTS "Parents can update own children" ON public.players;
DROP POLICY IF EXISTS "Admins can manage all players" ON public.players;

CREATE POLICY "Parents see own children"
  ON public.players FOR SELECT
  USING (parent_id = auth.uid() AND organisation_id = public.get_my_org());

CREATE POLICY "Staff see org players"
  ON public.players FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Parents can insert own children"
  ON public.players FOR INSERT
  WITH CHECK (parent_id = auth.uid() AND organisation_id = public.get_my_org());

CREATE POLICY "Parents can update own children"
  ON public.players FOR UPDATE
  USING (parent_id = auth.uid() AND organisation_id = public.get_my_org());

CREATE POLICY "Admins manage org players"
  ON public.players FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- ─── TRAINING GROUPS ───
DROP POLICY IF EXISTS "Anyone authenticated can view training groups" ON public.training_groups;
DROP POLICY IF EXISTS "Admins can manage training groups" ON public.training_groups;
DROP POLICY IF EXISTS "Coaches can manage their groups" ON public.training_groups;

CREATE POLICY "Org members can view org groups"
  ON public.training_groups FOR SELECT
  USING (organisation_id = public.get_my_org());

CREATE POLICY "Admins manage org groups"
  ON public.training_groups FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

CREATE POLICY "Coaches manage own org groups"
  ON public.training_groups FOR ALL
  USING (organisation_id = public.get_my_org() AND coach_id = auth.uid());

-- ─── ENROLMENTS ───
DROP POLICY IF EXISTS "Parents see own children enrolments" ON public.enrolments;
DROP POLICY IF EXISTS "Admins and coaches see all enrolments" ON public.enrolments;
DROP POLICY IF EXISTS "Admins can manage enrolments" ON public.enrolments;
DROP POLICY IF EXISTS "Coaches can manage enrolments" ON public.enrolments;

CREATE POLICY "Parents see own children enrolments"
  ON public.enrolments FOR SELECT
  USING (organisation_id = public.get_my_org()
    AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid()));

CREATE POLICY "Staff see org enrolments"
  ON public.enrolments FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Staff manage org enrolments"
  ON public.enrolments FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- ─── ATTENDANCE ───
DROP POLICY IF EXISTS "Parents see own children attendance" ON public.attendance;
DROP POLICY IF EXISTS "Admins and coaches see all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Coaches can manage attendance" ON public.attendance;

CREATE POLICY "Parents see own children attendance"
  ON public.attendance FOR SELECT
  USING (organisation_id = public.get_my_org()
    AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid()));

CREATE POLICY "Staff see org attendance"
  ON public.attendance FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Staff manage org attendance"
  ON public.attendance FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- ─── PROGRESS REVIEWS ───
DROP POLICY IF EXISTS "Parents see own children reviews" ON public.progress_reviews;
DROP POLICY IF EXISTS "Coaches see all reviews" ON public.progress_reviews;
DROP POLICY IF EXISTS "Coaches can create reviews" ON public.progress_reviews;
DROP POLICY IF EXISTS "Coaches can update own reviews" ON public.progress_reviews;
DROP POLICY IF EXISTS "Admins can manage all reviews" ON public.progress_reviews;

CREATE POLICY "Parents see own children reviews"
  ON public.progress_reviews FOR SELECT
  USING (organisation_id = public.get_my_org()
    AND player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid()));

CREATE POLICY "Staff see org reviews"
  ON public.progress_reviews FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Staff create org reviews"
  ON public.progress_reviews FOR INSERT
  WITH CHECK (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Coaches update own reviews"
  ON public.progress_reviews FOR UPDATE
  USING (organisation_id = public.get_my_org() AND coach_id = auth.uid());

CREATE POLICY "Admins manage org reviews"
  ON public.progress_reviews FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- ─── MESSAGES ───
DROP POLICY IF EXISTS "Users see own messages" ON public.messages;
DROP POLICY IF EXISTS "Admins and coaches can send messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can manage all messages" ON public.messages;
DROP POLICY IF EXISTS "Parents can send messages" ON public.messages;

CREATE POLICY "Users see own org messages"
  ON public.messages FOR SELECT
  USING (organisation_id = public.get_my_org()
    AND (recipient_id = auth.uid() OR sender_id = auth.uid()));

CREATE POLICY "Org members can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (organisation_id = public.get_my_org() AND sender_id = auth.uid());

CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (organisation_id = public.get_my_org() AND recipient_id = auth.uid());

CREATE POLICY "Admins manage org messages"
  ON public.messages FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- ─── PAYMENTS ───
DROP POLICY IF EXISTS "Parents see own payments" ON public.payments;
DROP POLICY IF EXISTS "Admins and coaches see all payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Coaches can manage payments" ON public.payments;

CREATE POLICY "Parents see own org payments"
  ON public.payments FOR SELECT
  USING (organisation_id = public.get_my_org() AND parent_id = auth.uid());

CREATE POLICY "Staff see org payments"
  ON public.payments FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Staff manage org payments"
  ON public.payments FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- ─── TRAINING PLANS ───
DROP POLICY IF EXISTS "Anyone authenticated can view training plans" ON public.training_plans;
DROP POLICY IF EXISTS "Admins can manage training plans" ON public.training_plans;
DROP POLICY IF EXISTS "Coaches can manage training plans" ON public.training_plans;

CREATE POLICY "Org members view org training plans"
  ON public.training_plans FOR SELECT
  USING (organisation_id = public.get_my_org());

CREATE POLICY "Staff manage org training plans"
  ON public.training_plans FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- ─── DOCUMENTS ───
DROP POLICY IF EXISTS "Staff can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Parents can view their documents" ON public.documents;
DROP POLICY IF EXISTS "Parents see own documents" ON public.documents;
DROP POLICY IF EXISTS "Staff see all documents" ON public.documents;
DROP POLICY IF EXISTS "Staff can manage documents" ON public.documents;

CREATE POLICY "Org members view org documents"
  ON public.documents FOR SELECT
  USING (organisation_id = public.get_my_org());

CREATE POLICY "Staff manage org documents"
  ON public.documents FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- ─── SESSION NOTES ───
DROP POLICY IF EXISTS "Staff can manage session notes" ON public.session_notes;
DROP POLICY IF EXISTS "Parents can view session notes for their groups" ON public.session_notes;
DROP POLICY IF EXISTS "Staff see all session notes" ON public.session_notes;
DROP POLICY IF EXISTS "Staff can manage session notes" ON public.session_notes;

CREATE POLICY "Staff see org session notes"
  ON public.session_notes FOR SELECT
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

CREATE POLICY "Staff manage org session notes"
  ON public.session_notes FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));

-- ─── SUBSCRIPTION PLANS ───
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admins manage plans" ON public.subscription_plans;

CREATE POLICY "Org members view org plans"
  ON public.subscription_plans FOR SELECT
  USING (organisation_id = public.get_my_org()
    AND (active = true OR public.get_my_role() IN ('admin', 'coach')));

CREATE POLICY "Admins manage org plans"
  ON public.subscription_plans FOR ALL
  USING (organisation_id = public.get_my_org() AND public.get_my_role() = 'admin');

-- ─── SUBSCRIPTIONS ───
DROP POLICY IF EXISTS "Parents see own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "System manages subscriptions" ON public.subscriptions;

CREATE POLICY "Parents see own org subscriptions"
  ON public.subscriptions FOR SELECT
  USING (organisation_id = public.get_my_org()
    AND (parent_id = auth.uid() OR public.get_my_role() IN ('admin', 'coach')));

CREATE POLICY "Org members manage org subscriptions"
  ON public.subscriptions FOR ALL
  USING (organisation_id = public.get_my_org()
    AND (public.get_my_role() = 'admin' OR parent_id = auth.uid()))
  WITH CHECK (organisation_id = public.get_my_org()
    AND (public.get_my_role() = 'admin' OR parent_id = auth.uid()));


-- ─────────────────────────────────────────────
-- STEP 8: Update signup trigger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id uuid;
BEGIN
  IF new.raw_user_meta_data->>'org_slug' IS NOT NULL THEN
    SELECT id INTO org_id
    FROM public.organisations
    WHERE slug = new.raw_user_meta_data->>'org_slug';
  END IF;

  IF org_id IS NULL THEN
    org_id := '00000000-0000-0000-0000-000000000001';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, phone, role, organisation_id)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'parent'),
    org_id
  );
  RETURN new;
END;
$$;
