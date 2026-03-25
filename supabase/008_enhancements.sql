-- 008: Waitlist, notifications preferences, dark mode
-- Run in Supabase SQL Editor

-- ─── Waitlist table ───
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES training_groups(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'offered', 'accepted', 'expired')),
  position INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  offered_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE(player_id, group_id)
);

ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_select" ON waitlist FOR SELECT USING (
  organisation_id = public.get_my_org()
);
CREATE POLICY "waitlist_insert" ON waitlist FOR INSERT WITH CHECK (
  organisation_id = public.get_my_org()
);
CREATE POLICY "waitlist_update" ON waitlist FOR UPDATE USING (
  organisation_id = public.get_my_org()
);
CREATE POLICY "waitlist_delete" ON waitlist FOR DELETE USING (
  organisation_id = public.get_my_org()
);

-- ─── Max capacity on training groups ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'training_groups' AND column_name = 'max_capacity') THEN
    ALTER TABLE training_groups ADD COLUMN max_capacity INTEGER DEFAULT 20;
  END IF;
END $$;

-- ─── Theme preference on profiles ───
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'theme') THEN
    ALTER TABLE profiles ADD COLUMN theme TEXT DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email_notifications') THEN
    ALTER TABLE profiles ADD COLUMN email_notifications BOOLEAN DEFAULT true;
  END IF;
END $$;

-- ─── Notification log table (for in-app notifications) ───
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment_due', 'payment_overdue', 'message', 'review', 'class_cancelled', 'waitlist_offer', 'general')),
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (
  organisation_id = public.get_my_org()
);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (
  user_id = auth.uid()
);
