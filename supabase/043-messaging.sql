-- 043: Two-way messaging system with conversations
-- Replaces the flat messages model with a proper conversation-based approach

-- Conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversation participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  last_read_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Conversation messages (separate from legacy messages table)
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_org ON public.conversations(organisation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON public.conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON public.conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_sender ON public.conversation_messages(sender_id);

-- RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see conversations they're part of
CREATE POLICY "Users see own conversations" ON public.conversations FOR SELECT
  USING (id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

CREATE POLICY "Org members create conversations" ON public.conversations FOR INSERT
  WITH CHECK (organisation_id = public.get_my_org());

-- Participants policies
CREATE POLICY "Users see conversation participants" ON public.conversation_participants FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants cp WHERE cp.user_id = auth.uid()));

CREATE POLICY "Users join conversations" ON public.conversation_participants FOR INSERT
  WITH CHECK (conversation_id IN (SELECT id FROM public.conversations WHERE organisation_id = public.get_my_org()));

CREATE POLICY "Users update own read status" ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users read conversation messages" ON public.conversation_messages FOR SELECT
  USING (conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

CREATE POLICY "Users send messages" ON public.conversation_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()));

-- Update conversation.updated_at on new message
CREATE OR REPLACE FUNCTION update_conversation_timestamp() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations SET updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_conversation_message_insert
  AFTER INSERT ON public.conversation_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();
