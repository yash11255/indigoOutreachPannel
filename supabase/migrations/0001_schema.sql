-- Indigo GWF Outreach Dashboard — core schema
-- Run this once against a fresh Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists "pgcrypto";

-- ── Teams ────────────────────────────────────────────────────────────────
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- ── Profiles (1:1 with auth.users) ──────────────────────────────────────
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  team_id uuid references teams (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
-- team_id/role default to member/null and must be assigned by an admin afterwards.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Lookup tables (seeded from Data Validation Sheet) ───────────────────
create table regions_states (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  state text not null,
  unique (region, state)
);

create table statuses (
  code text primary key,
  meaning text not null,
  sort_order int not null
);

create table institution_types (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  type text not null,
  unique (category, type)
);

-- ── Leads (the core planned → execution pipeline) ───────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete restrict,
  created_by uuid references profiles (id) on delete set null,

  region text,
  state text,
  district_city text,

  institution_type text,
  institution_channel text,
  institution_name text not null,

  outreach_mode text,
  contact_person text,
  designation text,
  mobile_no text,
  email_id text,

  no_of_institutions numeric,
  planned_girls_reach numeric,
  girls_reached numeric,

  planned_activity text,
  planned_date date,

  status text not null default 'Planned' references statuses (code),

  executed_date date,
  activity_undertaken text,
  quick_interest_form_submitted numeric,

  responsible_member text,
  remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_team_id_idx on leads (team_id);
create index leads_status_idx on leads (status);
create index leads_planned_date_idx on leads (planned_date);
create index leads_executed_date_idx on leads (executed_date);

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger leads_set_updated_at
  before update on leads
  for each row execute procedure public.set_updated_at();

-- ── Read-only imported logs (non-pipeline sheets) ───────────────────────
create table activity_log (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('digital', 'press', 'rto', 'outreach_updates')),
  date date,
  pillar text,
  channel text,
  mode text,
  activity text,
  region text,
  state text,
  district text,
  reach numeric,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_log_source_idx on activity_log (source);
create index activity_log_date_idx on activity_log (date);

-- ── Activity playbook (reference guide shown when creating a lead) ──────
create table activity_playbook (
  id uuid primary key default gen_random_uuid(),
  institution_category text not null,
  activity text not null,
  description text,
  channel_type text,
  materials_needed text,
  tips text
);

-- ── Row Level Security ───────────────────────────────────────────────────
alter table teams enable row level security;
alter table profiles enable row level security;
alter table regions_states enable row level security;
alter table statuses enable row level security;
alter table institution_types enable row level security;
alter table leads enable row level security;
alter table activity_log enable row level security;
alter table activity_playbook enable row level security;

-- helper: is the current user an admin?
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- helper: current user's team id
create function public.my_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from profiles where id = auth.uid();
$$;

-- lookups: any authenticated user can read
create policy "lookups readable by authenticated" on teams for select to authenticated using (true);
create policy "lookups readable by authenticated" on regions_states for select to authenticated using (true);
create policy "lookups readable by authenticated" on statuses for select to authenticated using (true);
create policy "lookups readable by authenticated" on institution_types for select to authenticated using (true);
create policy "lookups readable by authenticated" on activity_log for select to authenticated using (true);
create policy "lookups readable by authenticated" on activity_playbook for select to authenticated using (true);

-- profiles: users read their own row; admins read/update all
create policy "read own profile" on profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on profiles for update to authenticated using (id = auth.uid() or public.is_admin());
create policy "admins insert profiles" on profiles for insert to authenticated with check (public.is_admin());

-- leads: members scoped to their team, admins see/manage everything
create policy "read team leads" on leads for select to authenticated
  using (public.is_admin() or team_id = public.my_team_id());

create policy "insert team leads" on leads for insert to authenticated
  with check (public.is_admin() or team_id = public.my_team_id());

create policy "update team leads" on leads for update to authenticated
  using (public.is_admin() or team_id = public.my_team_id());

create policy "delete team leads (admin only)" on leads for delete to authenticated
  using (public.is_admin());

-- activity_log / activity_playbook: read-only imported data, admin-only writes
-- (used by scripts/migrate-excel.ts, which authenticates as an admin)
create policy "admins write activity_log" on activity_log for insert to authenticated
  with check (public.is_admin());

create policy "admins write activity_playbook" on activity_playbook for insert to authenticated
  with check (public.is_admin());
