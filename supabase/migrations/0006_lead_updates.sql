-- Interim "outreach update" notes logged against a lead (or a specific
-- round) while it's still in progress — i.e. before an executed_date is
-- set. Once a round/lead is marked executed, its in-progress phase ends and
-- no further updates are logged against it (enforced in the server action,
-- not here, so history stays readable either way).

create table lead_updates (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  -- null = round 1 (the lead row itself); otherwise the round this update belongs to.
  round_id uuid references lead_rounds (id) on delete cascade,
  note text not null,

  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index lead_updates_lead_id_idx on lead_updates (lead_id);

alter table lead_updates enable row level security;

create policy "read updates of visible leads" on lead_updates for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id
        and (public.is_admin() or l.team_id = public.my_team_id())
    )
  );

create policy "insert updates of visible leads" on lead_updates for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id
        and (public.is_admin() or l.team_id = public.my_team_id())
    )
  );

create policy "delete updates (admin only)" on lead_updates for delete to authenticated
  using (public.is_admin());
