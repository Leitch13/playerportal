-- 044: Waitlist auto-promote — trigger-based automatic promotion when enrolments are cancelled

-- Add 'declined' to the allowed status values if not already present
ALTER TABLE public.waitlist DROP CONSTRAINT IF EXISTS waitlist_status_check;
ALTER TABLE public.waitlist ADD CONSTRAINT waitlist_status_check
  CHECK (status IN ('waiting', 'offered', 'accepted', 'declined', 'expired', 'cancelled'));

-- Add offer_expires_at as alias-friendly column (mirrors expires_at for clarity)
-- The table already has: position, status, offered_at, expires_at
-- We keep using expires_at as the canonical column name.

-- Update the promote_waitlist function to be more robust
CREATE OR REPLACE FUNCTION public.promote_waitlist(group_id uuid)
RETURNS uuid AS $$
DECLARE
  next_entry RECORD;
BEGIN
  SELECT * INTO next_entry
  FROM public.waitlist
  WHERE training_group_id = group_id
    AND status = 'waiting'
  ORDER BY position ASC, created_at ASC
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

-- Trigger function: auto-promote when an enrolment is cancelled/deleted
CREATE OR REPLACE FUNCTION public.on_enrolment_cancelled_promote_waitlist()
RETURNS TRIGGER AS $$
BEGIN
  -- On DELETE: always try to promote
  IF TG_OP = 'DELETE' THEN
    PERFORM public.promote_waitlist(OLD.group_id);
    RETURN OLD;
  END IF;

  -- On UPDATE: promote when status changes to cancelled or inactive
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('cancelled', 'inactive') AND OLD.status NOT IN ('cancelled', 'inactive') THEN
      PERFORM public.promote_waitlist(NEW.group_id);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present, then create
DROP TRIGGER IF EXISTS trg_enrolment_cancelled_promote ON public.enrolments;
CREATE TRIGGER trg_enrolment_cancelled_promote
  AFTER UPDATE OR DELETE ON public.enrolments
  FOR EACH ROW
  EXECUTE FUNCTION public.on_enrolment_cancelled_promote_waitlist();
