-- ═══════════════════════════════════════════
-- 004: Enhanced profiles, documents, session notes
-- ═══════════════════════════════════════════

-- ─── Enhanced Player profiles ───
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS position text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS medical_info text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS kit_size text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS school text;

-- ─── Enhanced Parent profiles ───
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_contact_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS secondary_contact_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes text;

-- ─── Documents / Folders (linked to players or general) ───
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text NOT NULL,                    -- external link (Canva, Google Drive, etc.)
  doc_type text DEFAULT 'link',         -- 'link', 'canva', 'pdf', 'image', 'video'
  player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  folder text DEFAULT 'General',        -- folder/category name
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Staff can see all documents
CREATE POLICY "Staff can manage all documents"
  ON public.documents FOR ALL
  USING (public.get_my_role() IN ('admin', 'coach'));

-- Parents can see documents linked to them or their children
CREATE POLICY "Parents can view their documents"
  ON public.documents FOR SELECT
  USING (
    parent_id = auth.uid()
    OR player_id IN (SELECT id FROM public.players WHERE parent_id = auth.uid())
  );

-- ─── Session Notes (coach notes per training session) ───
CREATE TABLE IF NOT EXISTS public.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.training_groups(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  coach_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  notes text NOT NULL,
  focus_areas text,
  players_of_note text,                 -- comma-separated player names or highlights
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.session_notes ENABLE ROW LEVEL SECURITY;

-- Staff can manage session notes
CREATE POLICY "Staff can manage session notes"
  ON public.session_notes FOR ALL
  USING (public.get_my_role() IN ('admin', 'coach'));

-- Parents can read session notes for groups their children are in
CREATE POLICY "Parents can view session notes for their groups"
  ON public.session_notes FOR SELECT
  USING (
    group_id IN (
      SELECT e.group_id FROM public.enrolments e
      JOIN public.players p ON e.player_id = p.id
      WHERE p.parent_id = auth.uid() AND e.status = 'active'
    )
  );

-- ─── Indexes ───
CREATE INDEX IF NOT EXISTS idx_documents_player_id ON public.documents(player_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON public.documents(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder);
CREATE INDEX IF NOT EXISTS idx_session_notes_group_id ON public.session_notes(group_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_session_date ON public.session_notes(session_date);
