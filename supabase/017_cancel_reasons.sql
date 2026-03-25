-- 017: Cancel reason tracking for churn analysis
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'cancel_reason') THEN
    ALTER TABLE public.subscriptions ADD COLUMN cancel_reason text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'cancel_reason_text') THEN
    ALTER TABLE public.subscriptions ADD COLUMN cancel_reason_text text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'cancelled_at') THEN
    ALTER TABLE public.subscriptions ADD COLUMN cancelled_at timestamptz;
  END IF;
END $$;
