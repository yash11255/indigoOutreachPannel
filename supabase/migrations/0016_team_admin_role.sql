-- Adds a team-scoped, view-only role: "team_admin". This is for someone the
-- org wants to give full visibility into one outreach team's whole pipeline
-- (every lead on that team, not just their own or their reports') without
-- giving them the ability to create/edit/execute anything, and without
-- giving them visibility into any other team — unlike a full 'admin', who
-- can both see and edit everything across every team.
--
-- Deliberately doesn't touch the profiles read policy: the team dashboard
-- this role lands on (admin/segment, scoped to their own team) reads member
-- names off leads.responsible_member directly, not by joining profiles, so
-- no extra profile-visibility grant is needed for it to work.

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'member', 'team_admin'));

create function public.is_team_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'team_admin'
  );
$$;

-- Read-only superset of can_access_lead: everything that function already
-- grants, plus a team_admin looking at a lead on their own team. Only wired
-- into SELECT policies below -- insert/update/delete keep using
-- can_access_lead directly, so a team_admin never gets write access.
create function public.can_view_lead(lead_created_by uuid, lead_team_id uuid, lead_imported boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.can_access_lead(lead_created_by, lead_team_id, lead_imported)
    or (public.is_team_admin() and lead_team_id = public.my_team_id());
$$;

drop policy "read own or reports leads" on leads;
create policy "read own or reports leads" on leads for select to authenticated
  using (public.can_view_lead(created_by, team_id, imported));

drop policy "read rounds of visible leads" on lead_rounds;
create policy "read rounds of visible leads" on lead_rounds for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_view_lead(l.created_by, l.team_id, l.imported)
    )
  );

drop policy "read updates of visible leads" on lead_updates;
create policy "read updates of visible leads" on lead_updates for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_view_lead(l.created_by, l.team_id, l.imported)
    )
  );
