CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid REFERENCES public.organisations(id),
  user_id uuid REFERENCES public.profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins read audit log' AND tablename = 'audit_log') THEN
    CREATE POLICY "Admins read audit log" ON public.audit_log
      FOR SELECT USING (
        organisation_id = public.get_my_org()
        AND public.get_my_role() = 'admin'
      );
  END IF;
END $$;

-- Authenticated users can insert (to log their own actions)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert audit log' AND tablename = 'audit_log') THEN
    CREATE POLICY "Users insert audit log" ON public.audit_log
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_log_org_created ON public.audit_log (organisation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log (action);
