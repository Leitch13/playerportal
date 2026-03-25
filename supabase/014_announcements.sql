-- 014: Announcements system
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  author_id uuid REFERENCES public.profiles(id),
  title text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('all', 'group')),
  target_group_id uuid REFERENCES public.training_groups(id),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid REFERENCES public.announcements(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id),
  read_at timestamptz DEFAULT now(),
  UNIQUE(announcement_id, profile_id)
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

-- Admins CRUD announcements
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage announcements' AND tablename = 'announcements') THEN
    CREATE POLICY "Admins manage announcements" ON public.announcements
      FOR ALL USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() IN ('admin', 'coach')
      );
  END IF;
END $$;

-- Parents read sent announcements
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents read announcements' AND tablename = 'announcements') THEN
    CREATE POLICY "Parents read announcements" ON public.announcements
      FOR SELECT USING (
        organisation_id = public.get_my_org()
        AND status = 'sent'
      );
  END IF;
END $$;

-- Anyone can insert/read their own reads
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own reads' AND tablename = 'announcement_reads') THEN
    CREATE POLICY "Users manage own reads" ON public.announcement_reads
      FOR ALL USING (profile_id = auth.uid());
  END IF;
END $$;

-- Admins can see all reads for reporting
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins read all reads' AND tablename = 'announcement_reads') THEN
    CREATE POLICY "Admins read all reads" ON public.announcement_reads
      FOR SELECT USING (
        public.get_my_role() IN ('admin', 'coach')
      );
  END IF;
END $$;
