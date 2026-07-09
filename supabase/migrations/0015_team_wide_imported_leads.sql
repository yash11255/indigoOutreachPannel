-- Attributing bulk-imported leads to a real person via email-matching was a
-- good improvement for visibility, but it had a side effect: once a lead's
-- created_by pointed at a specific person, can_access_lead's own-or-manager
-- rule meant only that one person (or their manager) could act on it —
-- teammates could no longer help clear a shared backlog of old, imported
-- leads, even leads on their own team. That's too strict for data nobody on
-- the team personally created through the app; it should stay strict for
-- leads someone actually created themselves going forward.
--
-- Adds an `imported` flag (true for every lead currently in the table, since
-- all of it came from bulk-import scripts this session) and extends
-- can_access_lead to grant team-wide access for imported leads regardless of
-- who they're attributed to. New leads created through the app default to
-- imported = false and keep the strict own-or-manager rule.

alter table leads add column imported boolean not null default false;
update leads set imported = true;

drop policy "read own or reports leads" on leads;
drop policy "update own or reports leads" on leads;
drop policy "read rounds of visible leads" on lead_rounds;
drop policy "insert rounds of visible leads" on lead_rounds;
drop policy "update rounds of visible leads" on lead_rounds;
drop policy "read updates of visible leads" on lead_updates;
drop policy "insert updates of visible leads" on lead_updates;

drop function public.can_access_lead(uuid, uuid);

create function public.can_access_lead(lead_created_by uuid, lead_team_id uuid, lead_imported boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or lead_created_by = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = lead_created_by and p.manager_id = auth.uid()
    )
    or (
      (lead_created_by is null or lead_imported)
      and exists (
        select 1 from profiles p
        where p.id = auth.uid() and p.team_id = lead_team_id
      )
    );
$$;

create policy "read own or reports leads" on leads for select to authenticated
  using (public.can_access_lead(created_by, team_id, imported));

create policy "update own or reports leads" on leads for update to authenticated
  using (public.can_access_lead(created_by, team_id, imported));

create policy "read rounds of visible leads" on lead_rounds for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by, l.team_id, l.imported)
    )
  );

create policy "insert rounds of visible leads" on lead_rounds for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by, l.team_id, l.imported)
    )
  );

create policy "update rounds of visible leads" on lead_rounds for update to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by, l.team_id, l.imported)
    )
  );

create policy "read updates of visible leads" on lead_updates for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_access_lead(l.created_by, l.team_id, l.imported)
    )
  );

create policy "insert updates of visible leads" on lead_updates for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_access_lead(l.created_by, l.team_id, l.imported)
    )
  );
