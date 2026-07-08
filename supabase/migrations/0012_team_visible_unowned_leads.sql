-- Leads bulk-imported before per-user attribution existed (created_by is
-- null — currently 110 of them, the BC_IGWF_Outreach.xlsx baseline) were
-- only visible/editable by admins under the own-or-reports rule from
-- migration 0009, since null created_by can't match auth.uid() or anyone's
-- manager_id. That locked regular team members out of their own team's
-- historical leads entirely. Fix: a lead with no recorded creator falls back
-- to team-wide visibility (the pre-0009 behaviour); leads with a real
-- creator keep the stricter own-or-manager rule.

drop policy "read own or reports leads" on leads;
drop policy "update own or reports leads" on leads;
drop policy "read rounds of visible leads" on lead_rounds;
drop policy "insert rounds of visible leads" on lead_rounds;
drop policy "update rounds of visible leads" on lead_rounds;
drop policy "read updates of visible leads" on lead_updates;
drop policy "insert updates of visible leads" on lead_updates;

drop function public.can_access_lead(uuid);

create function public.can_access_lead(lead_created_by uuid, lead_team_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or lead_created_by = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = lead_created_by and p.manager_id = auth.uid()
    )
    or (
      lead_created_by is null
      and exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.team_id = lead_team_id
      )
    );
$$;

create policy "read own or reports leads" on leads for select to authenticated
  using (public.can_access_lead(created_by, team_id));

create policy "update own or reports leads" on leads for update to authenticated
  using (public.can_access_lead(created_by, team_id));

create policy "read rounds of visible leads" on lead_rounds for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by, l.team_id)
    )
  );

create policy "insert rounds of visible leads" on lead_rounds for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by, l.team_id)
    )
  );

create policy "update rounds of visible leads" on lead_rounds for update to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by, l.team_id)
    )
  );

create policy "read updates of visible leads" on lead_updates for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_access_lead(l.created_by, l.team_id)
    )
  );

create policy "insert updates of visible leads" on lead_updates for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_access_lead(l.created_by, l.team_id)
    )
  );
