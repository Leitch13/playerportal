-- Add early bird, sibling discount, and consent fields to camps table
ALTER TABLE public.camps
  ADD COLUMN IF NOT EXISTS early_bird_price decimal(10,2),
  ADD COLUMN IF NOT EXISTS early_bird_deadline date,
  ADD COLUMN IF NOT EXISTS sibling_discount_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sibling_discount_percent integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS collect_medical_info boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_consent boolean DEFAULT false;

-- Camp bookings table
CREATE TABLE IF NOT EXISTS public.camp_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camp_id uuid REFERENCES public.camps(id) ON DELETE CASCADE,
  organisation_id uuid REFERENCES public.organisations(id),
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text,
  child_name text NOT NULL,
  child_age integer,
  medical_info text,
  consent_given boolean DEFAULT false,
  amount_paid decimal(10,2),
  stripe_session_id text,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.camp_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public book camps' AND tablename = 'camp_bookings') THEN
    CREATE POLICY "Public book camps" ON public.camp_bookings FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage camp bookings' AND tablename = 'camp_bookings') THEN
    CREATE POLICY "Admins manage camp bookings" ON public.camp_bookings FOR ALL USING (organisation_id = public.get_my_org() AND public.get_my_role() IN ('admin', 'coach'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read camp bookings count' AND tablename = 'camp_bookings') THEN
    CREATE POLICY "Public read camp bookings count" ON public.camp_bookings FOR SELECT USING (true);
  END IF;
END $$;
