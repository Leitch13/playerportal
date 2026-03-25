-- 012: Waitlist system
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  training_group_id uuid REFERENCES public.training_groups(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profiles(id),
  organisation_id uuid REFERENCES public.organisations(id),
  position integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'offered', 'accepted', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  offered_at timestamptz,
  expires_at timestamptz
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents see own waitlist' AND tablename = 'waitlist') THEN
    CREATE POLICY "Parents see own waitlist" ON public.waitlist
      FOR SELECT USING (parent_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents insert own waitlist' AND tablename = 'waitlist') THEN
    CREATE POLICY "Parents insert own waitlist" ON public.waitlist
      FOR INSERT WITH CHECK (parent_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Parents update own waitlist' AND tablename = 'waitlist') THEN
    CREATE POLICY "Parents update own waitlist" ON public.waitlist
      FOR UPDATE USING (parent_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins manage waitlist' AND tablename = 'waitlist') THEN
    CREATE POLICY "Admins manage waitlist" ON public.waitlist
      FOR ALL USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() IN ('admin', 'coach')
      );
  END IF;
END $$;

-- Function to promote next person on waitlist
CREATE OR REPLACE FUNCTION public.promote_waitlist(group_id uuid)
RETURNS uuid AS $$
DECLARE
  next_entry RECORD;
BEGIN
  SELECT * INTO next_entry
  FROM public.waitlist
  WHERE training_group_id = group_id
    AND status = 'waiting'
  ORDER BY position ASC
  LIMIT 1;

  IF next_entry IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.waitlist
  SET status = 'offered',
      offered_at = now(),
      expires_at = now() + interval '48 hours'
  WHERE id = next_entry.id;

  -- Create notification for the parent
  INSERT INTO public.notifications (profile_id, organisation_id, type, title, body, link)
  VALUES (
    next_entry.parent_id,
    next_entry.organisation_id,
    'waitlist',
    'A spot has opened up!',
    'A spot has become available in the class. You have 48 hours to confirm.',
    '/dashboard/waitlist'
  );

  RETURN next_entry.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
