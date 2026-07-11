-- ============================================================ STAR story bank
-- Personal behavioral-interview stories. The agent injects the user's polished
-- stories into behavioral rounds so it can probe their real experiences.

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  raw_md text not null default '',        -- what the user typed
  polished_md text,                        -- AI-polished STAR version (cached on the row)
  tags text[] not null default '{}',       -- e.g. {leadership, conflict}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stories enable row level security;
create policy "own stories" on public.stories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index stories_user_idx on public.stories (user_id, updated_at desc);
