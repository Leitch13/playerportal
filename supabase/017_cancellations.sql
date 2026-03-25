-- 017: Cancellation tracking for retention flow
CREATE TABLE IF NOT EXISTS public.cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id),
  organisation_id uuid REFERENCES public.organisations(id),
  subscription_id text, -- Stripe subscription ID
  reason text CHECK (reason IN ('too_expensive', 'not_using', 'switching', 'child_stopped', 'unhappy', 'other')),
  reason_detail text,
  offered_discount boolean DEFAULT false,
  accepted_discount boolean DEFAULT false,
  discount_percent integer DEFAULT 25,
  final_status text DEFAULT 'pending' CHECK (final_status IN ('pending', 'retained', 'cancelled', 'winback_sent', 'winback_accepted')),
  cancelled_at timestamptz,
  winback_sent_at timestamptz,
  winback_accepted_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cancellations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own cancellations' AND tablename = 'cancellations') THEN
    CREATE POLICY "Users see own cancellations" ON public.cancellations
      FOR ALL USING (profile_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins see org cancellations' AND tablename = 'cancellations') THEN
    CREATE POLICY "Admins see org cancellations" ON public.cancellations
      FOR SELECT USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() = 'admin'
      );
  END IF;
END $$;
