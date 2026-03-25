-- 015: Payment reminder tracking
CREATE TABLE IF NOT EXISTS public.payment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id),
  organisation_id uuid REFERENCES public.organisations(id),
  reminder_type text NOT NULL CHECK (reminder_type IN ('3_day', '7_day', '14_day', 'custom')),
  sent_at timestamptz DEFAULT now(),
  email_sent boolean DEFAULT false
);

ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage reminders' AND tablename = 'payment_reminders') THEN
    CREATE POLICY "Admins manage reminders" ON public.payment_reminders
      FOR ALL USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() = 'admin'
      );
  END IF;
END $$;
