-- Found while verifying migration 0017 live: an IBM-scoped team_admin could
-- still see (and, it turns out, edit) every lead on their whole team,
-- Lenovo included — the sub_team restriction in can_view_lead only ever
-- ADDS access on top of whatever can_access_lead already grants, and never
-- had a way to take anything away from it.
--
-- The real bug is in can_access_lead itself (migration 0015): its "same
-- team + imported" clause checks the caller's team_id but never their
-- role, so it has been granting team_admins full team-wide access —
-- including UPDATE, via the "update own or reports leads" policy — since
-- 0015 shipped, well before the team_admin role even existed. team_admins
-- were only ever meant to read (via can_view_lead's own, separate,
-- sub_team-aware clause), never to get this grant at all.
--
-- Fix is one line and doesn't touch any policy: can_access_lead's signature
-- is unchanged (can_view_lead already calls it with just 3 args, dropping
-- sub_team), so `create or replace` is enough — no drop/recreate needed
-- for any of the 7 policies that call it directly or via can_view_lead.

create or replace function public.can_access_lead(lead_created_by uuid, lead_team_id uuid, lead_imported boolean)
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
        where p.id = auth.uid() and p.role != 'team_admin' and p.team_id = lead_team_id
      )
    );
$$;
