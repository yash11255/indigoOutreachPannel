-- Narrows a team_admin's view further, optionally, to one client-account
-- sub-division within their team (e.g. the "IBM lead" under BC FutureTech
-- should see only IBM's leads, not Lenovo's or Honeywell's too). Leaving a
-- team_admin's sub_team null keeps today's behavior: the whole team.
--
-- sub_team lives on leads per-activity (migration 0014), not on a person
-- permanently, so this is just an optional extra filter compared against
-- whatever the lead's own sub_team happens to be.

alter table profiles add column sub_team text;

drop function public.can_view_lead(uuid, uuid, boolean);

create function public.can_view_lead(
  lead_created_by uuid,
  lead_team_id uuid,
  lead_imported boolean,
  lead_sub_team text
)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.can_access_lead(lead_created_by, lead_team_id, lead_imported)
    or (
      public.is_team_admin()
      and lead_team_id = public.my_team_id()
      and (
        (select p.sub_team from profiles p where p.id = auth.uid()) is null
        or (select p.sub_team from profiles p where p.id = auth.uid()) = lead_sub_team
      )
    );
$$;

drop policy "read own or reports leads" on leads;
create policy "read own or reports leads" on leads for select to authenticated
  using (public.can_view_lead(created_by, team_id, imported, sub_team));

drop policy "read rounds of visible leads" on lead_rounds;
create policy "read rounds of visible leads" on lead_rounds for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_view_lead(l.created_by, l.team_id, l.imported, l.sub_team)
    )
  );

drop policy "read updates of visible leads" on lead_updates;
create policy "read updates of visible leads" on lead_updates for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_view_lead(l.created_by, l.team_id, l.imported, l.sub_team)
    )
  );
