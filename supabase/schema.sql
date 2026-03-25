-- ============================================================
-- Player Portal & CRM — Supabase Schema
-- Run this in the Supabase SQL Editor to set up your database.
-- ============================================================

-- 1. ENUMS
create type public.user_role as enum ('admin', 'coach', 'parent');
create type public.payment_status as enum ('pending', 'paid', 'overdue', 'waived');
create type public.enrolment_status as enum ('active', 'paused', 'cancelled');

-- 2. PROFILES (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role public.user_role not null default 'parent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. PLAYERS (children)
create table public.players (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  age_group text,          -- e.g. "U10", "U12"
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. TRAINING GROUPS
create table public.training_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,       -- e.g. "U10 Monday"
  day_of_week text,
  time_slot text,           -- e.g. "17:00–18:00"
  location text,
  coach_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 5. ENROLMENTS (player ↔ training group)
create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  status public.enrolment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  unique (player_id, group_id)
);

-- 6. ATTENDANCE
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  group_id uuid not null references public.training_groups(id) on delete cascade,
  session_date date not null,
  present boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  unique (player_id, group_id, session_date)
);

-- 7. PROGRESS REVIEWS (coach feedback on a player)
create table public.progress_reviews (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  coach_id uuid not null references public.profiles(id),
  review_date date not null default current_date,
  -- Scores 1–5
  attitude smallint not null check (attitude between 1 and 5),
  effort smallint not null check (effort between 1 and 5),
  technical_quality smallint not null check (technical_quality between 1 and 5),
  game_understanding smallint not null check (game_understanding between 1 and 5),
  confidence smallint not null check (confidence between 1 and 5),
  physical_movement smallint not null check (physical_movement between 1 and 5),
  -- Text feedback
  strengths text,
  focus_next text,
  parent_summary text,      -- parent-friendly plain-English summary
  created_at timestamptz not null default now()
);

-- 8. MESSAGES (coach/admin → parent)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  recipient_id uuid not null references public.profiles(id),
  subject text,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- 9. PAYMENTS
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.profiles(id),
  player_id uuid references public.players(id),
  amount numeric(10,2) not null,
  description text,          -- e.g. "March term fees – U10"
  status public.payment_status not null default 'pending',
  due_date date,
  paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. TRAINING PLANS (visible to parents)
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups(id) on delete cascade,
  week_starting date not null,
  title text not null,
  description text,
  focus_areas text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.training_groups enable row level security;
alter table public.enrolments enable row level security;
alter table public.attendance enable row level security;
alter table public.progress_reviews enable row level security;
alter table public.messages enable row level security;
alter table public.payments enable row level security;
alter table public.training_plans enable row level security;

-- Helper: get current user's role
create or replace function public.get_my_role()
returns public.user_role
language sql
stable
security definer
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- PROFILES
create policy "Users can view own profile"
  on public.profiles for select using (id = auth.uid());
create policy "Admins and coaches can view all profiles"
  on public.profiles for select using (public.get_my_role() in ('admin', 'coach'));
create policy "Users can update own profile"
  on public.profiles for update using (id = auth.uid());
create policy "Admins can manage all profiles"
  on public.profiles for all using (public.get_my_role() = 'admin');

-- PLAYERS
create policy "Parents see own children"
  on public.players for select using (parent_id = auth.uid());
create policy "Admins and coaches see all players"
  on public.players for select using (public.get_my_role() in ('admin', 'coach'));
create policy "Parents can insert own children"
  on public.players for insert with check (parent_id = auth.uid());
create policy "Parents can update own children"
  on public.players for update using (parent_id = auth.uid());
create policy "Admins can manage all players"
  on public.players for all using (public.get_my_role() = 'admin');

-- TRAINING GROUPS
create policy "Anyone authenticated can view training groups"
  on public.training_groups for select using (auth.uid() is not null);
create policy "Admins can manage training groups"
  on public.training_groups for all using (public.get_my_role() = 'admin');
create policy "Coaches can manage their groups"
  on public.training_groups for all using (coach_id = auth.uid());

-- ENROLMENTS
create policy "Parents see own children enrolments"
  on public.enrolments for select using (
    player_id in (select id from public.players where parent_id = auth.uid())
  );
create policy "Admins and coaches see all enrolments"
  on public.enrolments for select using (public.get_my_role() in ('admin', 'coach'));
create policy "Admins can manage enrolments"
  on public.enrolments for all using (public.get_my_role() = 'admin');
create policy "Coaches can manage enrolments"
  on public.enrolments for all using (public.get_my_role() in ('coach'));

-- ATTENDANCE
create policy "Parents see own children attendance"
  on public.attendance for select using (
    player_id in (select id from public.players where parent_id = auth.uid())
  );
create policy "Admins and coaches see all attendance"
  on public.attendance for select using (public.get_my_role() in ('admin', 'coach'));
create policy "Coaches can manage attendance"
  on public.attendance for all using (public.get_my_role() in ('admin', 'coach'));

-- PROGRESS REVIEWS
create policy "Parents see own children reviews"
  on public.progress_reviews for select using (
    player_id in (select id from public.players where parent_id = auth.uid())
  );
create policy "Coaches see all reviews"
  on public.progress_reviews for select using (public.get_my_role() in ('admin', 'coach'));
create policy "Coaches can create reviews"
  on public.progress_reviews for insert with check (public.get_my_role() in ('admin', 'coach'));
create policy "Coaches can update own reviews"
  on public.progress_reviews for update using (coach_id = auth.uid());
create policy "Admins can manage all reviews"
  on public.progress_reviews for all using (public.get_my_role() = 'admin');

-- MESSAGES
create policy "Users see own messages"
  on public.messages for select using (recipient_id = auth.uid() or sender_id = auth.uid());
create policy "Admins and coaches can send messages"
  on public.messages for insert with check (public.get_my_role() in ('admin', 'coach'));
create policy "Admins can manage all messages"
  on public.messages for all using (public.get_my_role() = 'admin');

-- PAYMENTS
create policy "Parents see own payments"
  on public.payments for select using (parent_id = auth.uid());
create policy "Admins and coaches see all payments"
  on public.payments for select using (public.get_my_role() in ('admin', 'coach'));
create policy "Admins can manage payments"
  on public.payments for all using (public.get_my_role() = 'admin');
create policy "Coaches can manage payments"
  on public.payments for all using (public.get_my_role() = 'coach');

-- TRAINING PLANS
create policy "Anyone authenticated can view training plans"
  on public.training_plans for select using (auth.uid() is not null);
create policy "Admins can manage training plans"
  on public.training_plans for all using (public.get_my_role() = 'admin');
create policy "Coaches can manage training plans"
  on public.training_plans for all using (public.get_my_role() = 'coach');

-- ============================================================
-- TRIGGER: auto-create profile on sign-up
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'parent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_players_parent on public.players(parent_id);
create index idx_enrolments_player on public.enrolments(player_id);
create index idx_enrolments_group on public.enrolments(group_id);
create index idx_attendance_player on public.attendance(player_id);
create index idx_attendance_session on public.attendance(session_date);
create index idx_reviews_player on public.progress_reviews(player_id);
create index idx_messages_recipient on public.messages(recipient_id);
create index idx_payments_parent on public.payments(parent_id);
