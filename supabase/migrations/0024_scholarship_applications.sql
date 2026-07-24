-- Scholarship Portal (ScholarsBox) integration — mirrors the leads table's
-- shape/conventions but for scholarship applications synced from the
-- external API instead of the Excel import. Admin-only: this holds
-- applicant PII (name, email, phone, DOB) that outreach team members/
-- team_admins have no reason to see.

create table scholarship_applications (
  id uuid primary key default gen_random_uuid(),

  -- Identity from the source system.
  source_id text not null unique, -- uniqueId (registered) or applicationId (applied/draft)
  record_type text not null check (record_type in ('registered', 'applied', 'draft')),

  first_name text,
  last_name text,
  email text,
  phone_number text,
  date_of_birth date,
  gender text,
  category text,

  state text,
  district text,
  pincode text,
  address text,

  -- Extracted from additionalRequirements Q&A via case-insensitive
  -- substring match on the question text — see lib/scholarship/map.ts.
  employment_status text,
  education_qualification text,
  dgca_medical_class2 text,
  dgca_computer_number text,

  registration_date date, -- registered records
  applied_date date, -- applied/draft records, derived from trackingStatus

  -- Full flattened Q&A + raw tracking status, kept for anything not broken
  -- out into its own column above.
  answers jsonb not null default '{}'::jsonb,
  tracking_status jsonb not null default '[]'::jsonb,

  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index scholarship_applications_record_type_idx on scholarship_applications (record_type);
create index scholarship_applications_state_idx on scholarship_applications (state);
create index scholarship_applications_applied_date_idx on scholarship_applications (applied_date);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger scholarship_applications_set_updated_at
  before update on scholarship_applications
  for each row execute procedure public.set_updated_at();

alter table scholarship_applications enable row level security;

create policy "admins only read scholarship applications"
  on scholarship_applications for select to authenticated
  using (public.is_admin());

create policy "admins only write scholarship applications"
  on scholarship_applications for insert to authenticated
  with check (public.is_admin());

create policy "admins only update scholarship applications"
  on scholarship_applications for update to authenticated
  using (public.is_admin());

create policy "admins only delete scholarship applications"
  on scholarship_applications for delete to authenticated
  using (public.is_admin());

-- Tracks each sync run for the "Sync Now" button's result summary and a
-- "last synced" timestamp, without needing a separate always-running process
-- to report status.
create table scholarship_sync_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  registered_count int,
  applied_count int,
  draft_count int,
  error_message text
);

alter table scholarship_sync_runs enable row level security;

create policy "admins only read scholarship sync runs"
  on scholarship_sync_runs for select to authenticated
  using (public.is_admin());

create policy "admins only write scholarship sync runs"
  on scholarship_sync_runs for insert to authenticated
  with check (public.is_admin());

create policy "admins only update scholarship sync runs"
  on scholarship_sync_runs for update to authenticated
  using (public.is_admin());
