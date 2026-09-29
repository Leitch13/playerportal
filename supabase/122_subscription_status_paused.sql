-- 122 · Let a membership be 'paused'.
--
-- The Pause button on Payments has written status = 'paused' since it was built,
-- but subscriptions_status_check never allowed that value, so every pause was
-- refused by the database, silently (the browser code never checked the error).
-- Found 29 Sep 2026 while fixing Pause for Gold & Gray: Pause now goes through
-- Stripe (pause_collection) and then saves 'paused' here.
--
-- The live list of allowed statuses differs from the migration files (it has
-- 'pending_migration', added directly), so this reads the live constraint and
-- adds 'paused' to it, keeping every existing value. Safe to run twice.

DO $$
DECLARE
  def  text;
  vals text[];
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO def
  FROM pg_constraint c
  WHERE c.conname = 'subscriptions_status_check'
    AND c.conrelid = 'public.subscriptions'::regclass;

  IF def IS NULL THEN
    RAISE NOTICE 'No subscriptions_status_check constraint: any status is already allowed.';
    RETURN;
  END IF;
  IF def LIKE '%''paused''%' THEN
    RAISE NOTICE 'paused is already allowed: %', def;
    RETURN;
  END IF;

  SELECT array_agg(DISTINCT m[1]) INTO vals
  FROM regexp_matches(def, '''([a-z_]+)''', 'g') AS m;
  vals := array_append(vals, 'paused');

  EXECUTE 'ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_status_check';
  EXECUTE format('ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status = ANY (%L::text[]))', vals);
END $$;

-- Shows the allowed statuses now. 'paused' should be in the list, alongside
-- every status that was there before (active, trialing, pending_migration, ...).
SELECT pg_get_constraintdef(c.oid) AS allowed_statuses
FROM pg_constraint c
WHERE c.conname = 'subscriptions_status_check'
  AND c.conrelid = 'public.subscriptions'::regclass;
