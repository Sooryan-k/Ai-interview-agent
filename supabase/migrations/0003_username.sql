-- ============================================================ username
-- Required, unique handle collected post-signup (magic-link + Google OAuth
-- give us no chance to ask for one at signup time, so it's gated in-app: a
-- blocking prompt shows for any signed-in user whose profile lacks one).

alter table public.profiles
  add column username text unique;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create index profiles_username_idx on public.profiles (username);
