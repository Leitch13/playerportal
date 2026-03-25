-- 009: ClassForKids rival features
-- Trial classes, promo codes, referrals, sibling discounts,
-- makeup classes, holiday camps, photo gallery, achievements,
-- digital waivers, coach management, reminders, check-in

-- ─── Trial / Taster Classes ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrolments' AND column_name = 'is_trial') THEN
    ALTER TABLE enrolments ADD COLUMN is_trial BOOLEAN DEFAULT false;
    ALTER TABLE enrolments ADD COLUMN trial_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- ─── Promo Codes ───
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  code TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL,
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'subscription', 'one_off', 'trial')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organisation_id, code)
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promo_codes_select" ON promo_codes FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "promo_codes_insert" ON promo_codes FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "promo_codes_update" ON promo_codes FOR UPDATE USING (organisation_id = public.get_my_org());
CREATE POLICY "promo_codes_delete" ON promo_codes FOR DELETE USING (organisation_id = public.get_my_org());

-- ─── Referrals ───
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  referred_id UUID REFERENCES profiles(id),
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'rewarded')),
  reward_amount NUMERIC DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_select" ON referrals FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "referrals_insert" ON referrals FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "referrals_update" ON referrals FOR UPDATE USING (organisation_id = public.get_my_org());

-- ─── Sibling Discount Config ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'sibling_discount_pct') THEN
    ALTER TABLE organisations ADD COLUMN sibling_discount_pct NUMERIC DEFAULT 10;
    ALTER TABLE organisations ADD COLUMN sibling_discount_from INTEGER DEFAULT 2;
    ALTER TABLE organisations ADD COLUMN referral_reward_amount NUMERIC DEFAULT 10;
  END IF;
END $$;

-- ─── Holiday Camps / Events ───
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'holiday_camp' CHECK (event_type IN ('holiday_camp', 'tournament', 'workshop', 'social', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  max_capacity INTEGER DEFAULT 30,
  price NUMERIC DEFAULT 0,
  age_groups TEXT[],
  coach_id UUID REFERENCES profiles(id),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON events FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "events_update" ON events FOR UPDATE USING (organisation_id = public.get_my_org());
CREATE POLICY "events_delete" ON events FOR DELETE USING (organisation_id = public.get_my_org());

-- ─── Event Bookings ───
CREATE TABLE IF NOT EXISTS event_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waitlisted')),
  payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  amount_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, player_id)
);

ALTER TABLE event_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_bookings_select" ON event_bookings FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "event_bookings_insert" ON event_bookings FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "event_bookings_update" ON event_bookings FOR UPDATE USING (organisation_id = public.get_my_org());

-- ─── Photo Gallery ───
CREATE TABLE IF NOT EXISTS gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  title TEXT,
  description TEXT,
  photo_url TEXT NOT NULL,
  group_id UUID REFERENCES training_groups(id),
  event_id UUID REFERENCES events(id),
  session_date DATE,
  visible_to_parents BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery_photos_select" ON gallery_photos FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "gallery_photos_insert" ON gallery_photos FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "gallery_photos_update" ON gallery_photos FOR UPDATE USING (organisation_id = public.get_my_org());
CREATE POLICY "gallery_photos_delete" ON gallery_photos FOR DELETE USING (organisation_id = public.get_my_org());

-- ─── Achievements / Certificates ───
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  name TEXT NOT NULL,
  description TEXT,
  badge_emoji TEXT DEFAULT '⭐',
  badge_color TEXT DEFAULT '#4ecde6',
  achievement_type TEXT DEFAULT 'badge' CHECK (achievement_type IN ('badge', 'certificate', 'milestone')),
  criteria TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_select" ON achievements FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "achievements_insert" ON achievements FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "achievements_update" ON achievements FOR UPDATE USING (organisation_id = public.get_my_org());

CREATE TABLE IF NOT EXISTS player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  awarded_by UUID REFERENCES profiles(id),
  awarded_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE(player_id, achievement_id)
);

ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "player_achievements_select" ON player_achievements FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "player_achievements_insert" ON player_achievements FOR INSERT WITH CHECK (organisation_id = public.get_my_org());

-- ─── Digital Waivers / Consent Forms ───
CREATE TABLE IF NOT EXISTS waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  required BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waivers_select" ON waivers FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "waivers_insert" ON waivers FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "waivers_update" ON waivers FOR UPDATE USING (organisation_id = public.get_my_org());

CREATE TABLE IF NOT EXISTS waiver_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  waiver_id UUID NOT NULL REFERENCES waivers(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  player_id UUID REFERENCES players(id),
  signed_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  UNIQUE(waiver_id, parent_id, player_id)
);

ALTER TABLE waiver_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "waiver_signatures_select" ON waiver_signatures FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "waiver_signatures_insert" ON waiver_signatures FOR INSERT WITH CHECK (organisation_id = public.get_my_org());

-- ─── Coach Management ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'hourly_rate') THEN
    ALTER TABLE profiles ADD COLUMN hourly_rate NUMERIC;
    ALTER TABLE profiles ADD COLUMN coach_bio TEXT;
    ALTER TABLE profiles ADD COLUMN coach_qualifications TEXT[];
    ALTER TABLE profiles ADD COLUMN availability JSONB;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS coach_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  coach_id UUID NOT NULL REFERENCES profiles(id),
  session_date DATE NOT NULL,
  hours NUMERIC NOT NULL,
  group_id UUID REFERENCES training_groups(id),
  event_id UUID REFERENCES events(id),
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE coach_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coach_hours_select" ON coach_hours FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "coach_hours_insert" ON coach_hours FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "coach_hours_update" ON coach_hours FOR UPDATE USING (organisation_id = public.get_my_org());

-- ─── Makeup Classes ───
CREATE TABLE IF NOT EXISTS makeup_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  missed_group_id UUID NOT NULL REFERENCES training_groups(id),
  missed_date DATE NOT NULL,
  makeup_group_id UUID REFERENCES training_groups(id),
  makeup_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'booked', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE makeup_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "makeup_bookings_select" ON makeup_bookings FOR SELECT USING (organisation_id = public.get_my_org());
CREATE POLICY "makeup_bookings_insert" ON makeup_bookings FOR INSERT WITH CHECK (organisation_id = public.get_my_org());
CREATE POLICY "makeup_bookings_update" ON makeup_bookings FOR UPDATE USING (organisation_id = public.get_my_org());

-- ─── Check-in Codes ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_groups' AND column_name = 'checkin_code') THEN
    ALTER TABLE training_groups ADD COLUMN checkin_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'attendance' AND column_name = 'checked_in_at') THEN
    ALTER TABLE attendance ADD COLUMN checked_in_at TIMESTAMPTZ;
    ALTER TABLE attendance ADD COLUMN check_in_method TEXT DEFAULT 'manual' CHECK (check_in_method IN ('manual', 'code', 'qr'));
  END IF;
END $$;

-- ─── Public page settings on org ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'public_page_enabled') THEN
    ALTER TABLE organisations ADD COLUMN public_page_enabled BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'hero_image_url') THEN
    ALTER TABLE organisations ADD COLUMN hero_image_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'description') THEN
    ALTER TABLE organisations ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'contact_email') THEN
    ALTER TABLE organisations ADD COLUMN contact_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'contact_phone') THEN
    ALTER TABLE organisations ADD COLUMN contact_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'social_facebook') THEN
    ALTER TABLE organisations ADD COLUMN social_facebook TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'social_instagram') THEN
    ALTER TABLE organisations ADD COLUMN social_instagram TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organisations' AND column_name = 'primary_color') THEN
    ALTER TABLE organisations ADD COLUMN primary_color TEXT DEFAULT '#4ecde6';
  END IF;
END $$;

-- ─── Referral code on profiles ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'referral_code') THEN
    ALTER TABLE profiles ADD COLUMN referral_code TEXT;
    ALTER TABLE profiles ADD COLUMN referred_by UUID REFERENCES profiles(id);
  END IF;
END $$;

-- ─── Storage bucket for gallery ───
-- Note: Run this in Supabase Dashboard > Storage > Create bucket: "gallery"
-- Set it to public
