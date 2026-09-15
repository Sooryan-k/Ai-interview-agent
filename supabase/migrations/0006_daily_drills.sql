-- The Daily Drill becomes a stored, once-per-day set: one question per
-- selected technology, generated on the first visit of the user's local day
-- and read back unchanged for the rest of it.
--
-- Previously the drill was recomputed on every request from a hash over a
-- live count of the global question_bank, so it changed whenever anyone
-- seeded the bank, and answer state lived only in React.

create table if not exists public.daily_drills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- The user's OWN calendar date, computed from their timezone and stored
  -- explicitly. Never re-derived from now() on read, so the set can't shift
  -- when they travel or when the server's day rolls over before theirs.
  drill_date date not null,
  stack_id text not null,

  -- Stable display order. New stacks added mid-day get the next position so
  -- the questions already on screen don't reshuffle under the user.
  position int not null default 0,

  -- The question is denormalised, not just referenced: the bank is a shared
  -- cache that other users' seeding can grow and reorder, and a row could be
  -- removed. Copying the text is what makes the day's set immutable.
  question_id uuid references public.question_bank (id) on delete set null,
  question text not null,
  ideal_points jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,

  answered_at timestamptz,
  result text check (result in ('got_it', 'missed')),
  created_at timestamptz not null default now(),

  -- One question per technology per day — the core rule, enforced in the
  -- schema rather than only in the route.
  unique (user_id, drill_date, stack_id)
);

create index if not exists daily_drills_user_date_idx
  on public.daily_drills (user_id, drill_date, position);

alter table public.daily_drills enable row level security;
create policy "own daily drills" on public.daily_drills
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------- question_history
-- Asking the same question twice should not create two rows: the duplicate
-- inflates the per-stack count that decides when a technology's pool is
-- "exhausted", which then pushes the interviewer to harder material early.
delete from public.question_history a
using public.question_history b
where a.user_id = b.user_id
  and a.stack_id = b.stack_id
  and a.signature = b.signature
  and a.signature <> ''
  and a.ctid > b.ctid;

create unique index if not exists question_history_unique_signature_idx
  on public.question_history (user_id, stack_id, signature)
  where signature <> '';
