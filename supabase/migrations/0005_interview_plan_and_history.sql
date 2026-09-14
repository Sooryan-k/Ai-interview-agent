-- Interview planning, honest scoring, and per-user question history.
--
-- Three things change:
--  1. An interview's planned length is stored ON the session at creation time,
--     instead of being re-derived (or invented by the model) later.
--  2. Reports carry a tally computed from the per-answer evals, so the headline
--     score can be recomputed rather than trusted.
--  3. Every question a user is asked is recorded, so the next session can
--     exclude it.

-- ---------------------------------------------------------------- interviews
alter table public.interviews
  add column if not exists planned_questions int,
  add column if not exists stack_ids text[] not null default '{}',
  add column if not exists question_plan jsonb;

comment on column public.interviews.planned_questions is
  'Total main questions decided at creation. The session runs until this many interviewer questions have been asked; only the candidate can end it sooner.';
comment on column public.interviews.stack_ids is
  'Catalog ids (lib/stacks.ts) this round covers. Drives planned_questions and the rotation.';
comment on column public.interviews.question_plan is
  '{"perStack":[{"stackId","count"}],"sequence":[stackId,...]} — the rotation the interviewer follows.';

-- Backfill the planned length for sessions created before this column existed,
-- so in-flight interviews keep a sane progress denominator.
update public.interviews
set planned_questions = coalesce((persona ->> 'question_count')::int, 6)
where planned_questions is null;

-- ------------------------------------------------------------------- reports
alter table public.reports
  add column if not exists tally jsonb not null default '{}'::jsonb;

comment on column public.reports.tally is
  '{"asked","answered","unanswered","correct","partially_correct","incorrect"} counted from per-answer evals, not from the model.';

-- ---------------------------------------------------------- question_history
-- One row per question actually put to a user. Keyed by user + stack so the
-- next session for that stack can exclude what they have already been asked.
create table if not exists public.question_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  interview_id uuid references public.interviews (id) on delete set null,
  stack_id text not null,
  topic text not null default '',
  difficulty text not null default 'medium',
  question text not null,
  -- Order-independent content signature used for near-duplicate detection, so a
  -- reworded version of the same question is still recognised as a repeat.
  signature text not null default '',
  asked_at timestamptz not null default now()
);

create index if not exists question_history_user_stack_idx
  on public.question_history (user_id, stack_id, asked_at desc);
create index if not exists question_history_signature_idx
  on public.question_history (user_id, signature);

alter table public.question_history enable row level security;
create policy "own question history" on public.question_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
