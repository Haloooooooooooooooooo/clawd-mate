-- ClawdMate Supabase schema
-- Date: 2026-04-25

-- Optional extension
create extension if not exists "pgcrypto";

-- profiles (optional user profile table)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_id text,
  title text not null,
  mode text not null check (mode in ('simple', 'structured')),
  status text not null check (status in ('running', 'paused', 'done', 'cancelled')),
  total_duration_seconds integer not null check (total_duration_seconds >= 0),
  remaining_seconds integer not null check (remaining_seconds >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create unique index if not exists idx_tasks_user_sync_id
  on public.tasks(user_id, sync_id)
  where sync_id is not null;

-- subtasks
create table if not exists public.subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null check (status in ('pending', 'done', 'skipped')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subtasks_task_id on public.subtasks(task_id);
create index if not exists idx_subtasks_user_id on public.subtasks(user_id);

-- task_history (immutable-ish snapshots)
create table if not exists public.task_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid,
  title text not null,
  mode text not null check (mode in ('simple', 'structured')),
  status text not null check (status in ('done', 'cancelled')),
  total_duration_seconds integer not null check (total_duration_seconds >= 0),
  actual_duration_seconds integer not null check (actual_duration_seconds >= 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_task_history_user_id on public.task_history(user_id);
create index if not exists idx_task_history_created_at on public.task_history(created_at desc);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_subtasks_updated_at on public.subtasks;
create trigger trg_subtasks_updated_at
before update on public.subtasks
for each row execute function public.set_updated_at();

-- auth helper: distinguish "email not registered" vs "password wrong" on login
create or replace function public.is_email_registered(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  return exists (
    select 1
    from auth.users
    where lower(email) = lower(trim(p_email))
  );
end;
$$;

revoke all on function public.is_email_registered(text) from public;
grant execute on function public.is_email_registered(text) to anon, authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_history enable row level security;

-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- tasks policies
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
on public.tasks for select
using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own"
on public.tasks for insert
with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own"
on public.tasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own"
on public.tasks for delete
using (auth.uid() = user_id);

-- subtasks policies
drop policy if exists "subtasks_select_own" on public.subtasks;
create policy "subtasks_select_own"
on public.subtasks for select
using (auth.uid() = user_id);

drop policy if exists "subtasks_insert_own" on public.subtasks;
create policy "subtasks_insert_own"
on public.subtasks for insert
with check (auth.uid() = user_id);

drop policy if exists "subtasks_update_own" on public.subtasks;
create policy "subtasks_update_own"
on public.subtasks for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "subtasks_delete_own" on public.subtasks;
create policy "subtasks_delete_own"
on public.subtasks for delete
using (auth.uid() = user_id);

-- task_history policies
drop policy if exists "task_history_select_own" on public.task_history;
create policy "task_history_select_own"
on public.task_history for select
using (auth.uid() = user_id);

drop policy if exists "task_history_insert_own" on public.task_history;
create policy "task_history_insert_own"
on public.task_history for insert
with check (auth.uid() = user_id);

drop policy if exists "task_history_update_own" on public.task_history;
create policy "task_history_update_own"
on public.task_history for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "task_history_delete_own" on public.task_history;
create policy "task_history_delete_own"
on public.task_history for delete
using (auth.uid() = user_id);
