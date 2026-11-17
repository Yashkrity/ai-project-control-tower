-- AI Project Delivery Control Tower — database schema (DRAFT)
--
-- Status: written to mirror src/lib/types.ts. It has NOT yet been applied to a
-- live Supabase project; it will be verified when the Supabase data source is
-- implemented. Run it in the Supabase SQL editor or via `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 2 and 120),
  client           text not null,
  description      text not null default '',
  project_manager  text not null,
  start_date       date not null,
  target_end_date  date not null,
  budget           numeric(14,2) not null default 0 check (budget >= 0),
  actual_spend     numeric(14,2) not null default 0 check (actual_spend >= 0),
  status           text not null default 'planning'
                   check (status in ('planning','active','on_hold','completed')),
  health           text not null default 'green' check (health in ('green','amber','red')),
  -- Archiving is independent of status so a restore returns the project unchanged.
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint projects_dates_valid check (target_end_date >= start_date)
);

create table if not exists public.milestones (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  name          text not null,
  planned_date  date not null,
  actual_date   date,
  status        text not null default 'not_started'
                check (status in ('not_started','in_progress','completed')),
  created_at    timestamptz not null default now()
);

create table if not exists public.tasks (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  milestone_id    uuid references public.milestones(id) on delete set null,
  title           text not null,
  description     text not null default '',
  owner           text not null,
  priority        text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status          text not null default 'not_started'
                  check (status in ('not_started','in_progress','blocked','on_hold','done')),
  start_date      date not null,
  due_date        date not null,
  -- Actual completion date: required while done, cleared when reopened.
  completed_date  date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tasks_dates_valid check (due_date >= start_date),
  constraint tasks_completion_matches_status check ((status = 'done') = (completed_date is not null))
);

create table if not exists public.task_dependencies (
  task_id             uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id  uuid not null references public.tasks(id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  constraint no_self_dependency check (task_id <> depends_on_task_id)
);
-- Not yet enforced in SQL (the app enforces them in src/lib/tasks/rules.ts):
--   * both tasks belong to the same project
--   * no cycles
--   * a task's milestone belongs to the task's project
-- Add triggers or an RPC that runs those checks in one transaction when the
-- Supabase data source is implemented.

create table if not exists public.raid_items (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  type         text not null check (type in ('risk','assumption','issue','dependency')),
  title        text not null,
  description  text not null default '',
  owner        text not null,
  severity     text not null check (severity in ('low','medium','high')),
  probability  text not null check (probability in ('low','medium','high')),
  impact       text not null check (impact in ('low','medium','high')),
  mitigation   text not null default '',
  status       text not null default 'open' check (status in ('open','monitoring','resolved','closed')),
  target_date  date,
  created_at   timestamptz not null default now()
);

create table if not exists public.project_updates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  author      text not null,
  kind        text not null check (kind in ('status','milestone','risk','decision','general')),
  summary     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists tasks_due_idx on public.tasks(due_date) where status <> 'done';
create index if not exists milestones_project_idx on public.milestones(project_id);
create index if not exists raid_project_idx on public.raid_items(project_id);
create index if not exists updates_project_created_idx on public.project_updates(project_id, created_at desc);

-- Row Level Security: enabled on every table. Initial policy allows any
-- signed-in user full access (single-workspace MVP). Replace with
-- workspace/role-based policies when multi-tenancy is introduced.
do $$
declare t text;
begin
  foreach t in array array['projects','milestones','tasks','task_dependencies','raid_items','project_updates']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on public.%I', t);
    execute format(
      'create policy "authenticated full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
