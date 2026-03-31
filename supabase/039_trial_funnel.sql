-- 039: Trial conversion funnel — add tracking columns for automated touchpoints
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS reminder_48h_sent boolean DEFAULT false;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean DEFAULT false;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS reminder_2h_sent boolean DEFAULT false;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS followup_sent boolean DEFAULT false;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS conversion_offer_sent boolean DEFAULT false;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS converted boolean DEFAULT false;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS discount_code text;
ALTER TABLE public.trial_bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
