-- Adds a second, view-only manager per person. Unlike manager_id (which
-- grants full view+edit access via can_access_lead, used directly by the
-- write policies too), secondary_manager_id is only wired into
-- can_view_lead — so a secondary manager sees their assigned member's leads
-- exactly like a primary manager does, but can't edit or delete them. This
-- mirrors the existing team_admin precedent: extra visibility added in
-- can_view_lead only, never in can_access_lead, so it can never leak into
-- write access.
--
-- Signature of can_view_lead is unchanged (still 4 args), so `create or
-- replace` is enough here — same pattern as migrations 0018/0019, no
-- policies need dropping or recreating.

alter table profiles add column secondary_manager_id uuid references profiles(id);

create or replace function public.can_view_lead(
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
    )
    or exists (
      select 1 from profiles p
      where p.id = lead_created_by and p.secondary_manager_id = auth.uid()
    );
$$;
