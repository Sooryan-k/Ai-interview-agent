-- ==================================================== target role + tech stacks
-- Replaces the single free-text stack label with a structured selection:
--   role_id          one role from lib/roles.ts (nullable — existing accounts
--                    have none, and we ask rather than guess)
--   role_other       free text, only when role_id = 'other'
--   stack_ids        1-10 catalog ids from lib/stacks.ts
--   primary_stack_id optional emphasis, must be one of stack_ids
--
-- Everything here is nullable or defaulted so existing rows keep working. The
-- old profiles.target_role (a free-text job title) is deliberately LEFT IN
-- PLACE: it's a different thing from the role taxonomy, still feeds the
-- interviewer prompt, and keeping it means the backfill is reversible.

alter table public.profiles
  add column role_id text,
  add column role_other text,
  add column stack_ids text[] not null default '{}',
  add column primary_stack_id text,
  -- Set by scripts/migrate-stacks.ts so a re-run can skip rows already done,
  -- and so we can tell "migrated to nothing" from "never migrated".
  add column stacks_migrated_at timestamptz;

-- Stacks are stored by id, so the only shape rule we can enforce in SQL is the
-- count. The ids themselves are validated server-side against the catalog.
-- Note the cap is NOT enforced here as 10: users migrated from legacy data may
-- legitimately hold more until they trim, and we must not truncate their data.
alter table public.profiles
  add constraint profiles_stack_ids_sane
  check (array_length(stack_ids, 1) is null or array_length(stack_ids, 1) <= 50);

-- The primary must be one of the selected stacks (or unset).
alter table public.profiles
  add constraint profiles_primary_stack_in_stacks
  check (primary_stack_id is null or primary_stack_id = any (stack_ids));

-- Free-text role only makes sense alongside the 'other' option.
alter table public.profiles
  add constraint profiles_role_other_requires_other
  check (role_other is null or role_id = 'other');

-- Lets the dashboard find "has stacks" rows cheaply, and supports future
-- "who else studies React" style lookups.
create index profiles_stack_ids_idx on public.profiles using gin (stack_ids);
create index profiles_role_id_idx on public.profiles (role_id);
