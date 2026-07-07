-- AI Interview Agent — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ============================================================ profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  target_role text,
  resume_text text,
  resume_struct jsonb,
  skills jsonb not null default '{}'::jsonb,
  streak_count int not null default 0,
  last_active_date date,
  preferred_lang text not null default 'en',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select using (auth.uid() = id);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create a profile row on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ curricula (GLOBAL CACHE)
create table public.curricula (
  id uuid primary key default gen_random_uuid(),
  stack_key text not null unique,        -- slug, e.g. 'react-node--beginner'
  stack_label text not null,             -- 'React + Node.js'
  level_range text not null default 'scratch-expert',
  structure jsonb not null,              -- levels -> modules -> topics
  version int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.curricula enable row level security;
create policy "curricula readable by signed-in users" on public.curricula
  for select to authenticated using (true);
-- writes: service role only (bypasses RLS)

-- ============================================================ study_materials (GLOBAL CACHE)
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  topic_key text not null,
  topic_title text not null,
  content_md text not null,
  cheat_sheet_md text,
  resources jsonb not null default '[]'::jsonb,
  interview_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (curriculum_id, topic_key)
);

alter table public.study_materials enable row level security;
create policy "study materials readable by signed-in users" on public.study_materials
  for select to authenticated using (true);

-- ============================================================ quizzes (GLOBAL CACHE)
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  module_key text not null,
  questions jsonb not null,              -- [{type:'mcq'|'short', q, options?, answer?, ideal_points?}]
  created_at timestamptz not null default now(),
  unique (curriculum_id, module_key)
);

alter table public.quizzes enable row level security;
create policy "quizzes readable by signed-in users" on public.quizzes
  for select to authenticated using (true);

-- ============================================================ user_track_progress
create table public.user_track_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  curriculum_id uuid not null references public.curricula (id) on delete cascade,
  topic_status jsonb not null default '{}'::jsonb,   -- {topic_key: 'todo'|'learning'|'mastered'}
  quiz_scores jsonb not null default '{}'::jsonb,    -- {module_key: {score, total, at}}
  current_level int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, curriculum_id)
);

alter table public.user_track_progress enable row level security;
create policy "own progress" on public.user_track_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================ interviews
create table public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  curriculum_id uuid references public.curricula (id) on delete set null,
  curriculum_level int,
  role_track text not null,
  round_type text not null,              -- behavioral|system_design|dsa|hr|technical
  difficulty text not null,              -- easy|medium|hard
  persona jsonb not null default '{}'::jsonb,
  jd_text text,
  status text not null default 'active', -- active|complete|abandoned
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table public.interviews enable row level security;
create policy "own interviews" on public.interviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================ turns
create table public.turns (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews (id) on delete cascade,
  idx int not null,
  speaker text not null check (speaker in ('ai', 'user')),
  text text not null,
  eval jsonb,                            -- {score, note, tags} for user turns
  speech_metrics jsonb,                  -- {fillers, wpm, long_pauses} client-computed
  created_at timestamptz not null default now(),
  unique (interview_id, idx)
);

alter table public.turns enable row level security;
create policy "own turns" on public.turns
  for all using (
    exists (
      select 1 from public.interviews i
      where i.id = interview_id and i.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.interviews i
      where i.id = interview_id and i.user_id = auth.uid()
    )
  );

-- ============================================================ reports
create table public.reports (
  interview_id uuid primary key references public.interviews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  overall_score int,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  per_question jsonb not null default '[]'::jsonb,   -- [{q, answer_summary, model_answer, score}]
  recommendations jsonb not null default '[]'::jsonb,
  share_slug text unique,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;
create policy "own reports" on public.reports
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "shared reports are public" on public.reports
  for select using (share_slug is not null);

-- ============================================================ question_bank (GLOBAL CACHE)
create table public.question_bank (
  id uuid primary key default gen_random_uuid(),
  role_track text not null,
  round_type text not null,
  difficulty text not null,
  question text not null,
  ideal_points jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  source text not null default 'seeded',  -- seeded|trend|generated
  company_pack text,
  created_at timestamptz not null default now()
);

alter table public.question_bank enable row level security;
create policy "question bank readable by signed-in users" on public.question_bank
  for select to authenticated using (true);

-- ============================================================ user_question_stats (spaced repetition)
create table public.user_question_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.question_bank (id) on delete cascade,
  ease real not null default 2.5,
  interval_days int not null default 0,
  due_at timestamptz not null default now(),
  lapses int not null default 0,
  last_result text,
  primary key (user_id, question_id)
);

alter table public.user_question_stats enable row level security;
create policy "own question stats" on public.user_question_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================ knowledge_items
create table public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- 'hn' | 'devto'
  title text not null,
  url text not null unique,
  summary text,
  tags text[] not null default '{}',
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

alter table public.knowledge_items enable row level security;
create policy "knowledge readable by signed-in users" on public.knowledge_items
  for select to authenticated using (true);

-- ============================================================ daily_usage (quota guard)
create table public.daily_usage (
  day date not null,
  scope text not null,                   -- 'global' | user uuid | 'user:<uuid>:interviews'
  calls int not null default 0,
  primary key (day, scope)
);

alter table public.daily_usage enable row level security;
-- no client policies: accessed only via the security-definer function below

-- Atomically increments the counter for (today, scope); returns true while
-- the count stays within p_max. One row per scope per day.
create or replace function public.increment_usage(p_scope text, p_max int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_calls int;
begin
  insert into public.daily_usage (day, scope, calls)
  values (current_date, p_scope, 1)
  on conflict (day, scope)
  do update set calls = public.daily_usage.calls + 1
  returning calls into v_calls;
  return v_calls <= p_max;
end;
$$;

grant execute on function public.increment_usage(text, int) to authenticated;
grant execute on function public.increment_usage(text, int) to service_role;

-- Read-only peek used by UI to show remaining quota without incrementing.
create or replace function public.get_usage(p_scope text)
returns int
language sql
security definer set search_path = public
as $$
  select coalesce(
    (select calls from public.daily_usage where day = current_date and scope = p_scope),
    0
  );
$$;

grant execute on function public.get_usage(text) to authenticated;

-- Helpful indexes
create index turns_interview_idx on public.turns (interview_id, idx);
create index interviews_user_idx on public.interviews (user_id, started_at desc);
create index knowledge_tags_idx on public.knowledge_items using gin (tags);
create index question_bank_track_idx on public.question_bank (role_track, round_type, difficulty);
