-- 027: Add thread_id to messages for conversation threading
-- The messages table already exists; we only need to add thread_id.

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS thread_id uuid;

-- Backfill: each existing message becomes its own thread
UPDATE public.messages SET thread_id = id WHERE thread_id IS NULL;

-- Index for fast thread lookups
CREATE INDEX IF NOT EXISTS idx_messages_thread ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at DESC);

-- Ensure the column read exists (schema uses "read", some migrations use "is_read")
-- The original schema uses "read" so we keep that.
