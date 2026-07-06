-- Supports leads with multiple outreach rounds/touchpoints over time (e.g.
-- intro session, follow-up, final signup drive), each with its own
-- planned/executed date. The `leads` row itself is always round 1 (its own
-- planned_date/executed_date/status/activity_undertaken/girls_reached
-- columns are unchanged); this table holds round 2 onward.

create table lead_rounds (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  sequence_no int not null,
  title text,

  planned_date date,
  executed_date date,
  status text not null default 'Planned' references statuses (code),
  activity_undertaken text,
  girls_reached numeric,
  remarks text,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (lead_id, sequence_no)
);

create index lead_rounds_lead_id_idx on lead_rounds (lead_id);

create trigger lead_rounds_set_updated_at
  before update on lead_rounds
  for each row execute procedure public.set_updated_at();

alter table lead_rounds enable row level security;

-- Same team-scoping as leads: a round is visible/editable by whoever can
-- see its parent lead (their own team, or any admin).
create policy "read rounds of visible leads" on lead_rounds for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id
        and (public.is_admin() or l.team_id = public.my_team_id())
    )
  );

create policy "insert rounds of visible leads" on lead_rounds for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id
        and (public.is_admin() or l.team_id = public.my_team_id())
    )
  );

create policy "update rounds of visible leads" on lead_rounds for update to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id
        and (public.is_admin() or l.team_id = public.my_team_id())
    )
  );

create policy "delete rounds (admin only)" on lead_rounds for delete to authenticated
  using (public.is_admin());
