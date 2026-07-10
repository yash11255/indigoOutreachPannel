-- Reverts the "team-wide access to imported leads" behavior from migration
-- 0015. Confirmed explicitly: a regular member should see only leads they
-- personally created, plus their direct reports' if they manage anyone —
-- nothing else on their team, imported or not. This removes can_access_lead's
-- "same team + imported" clause entirely, leaving just is_admin() / own lead
-- / manager-of-creator.
--
-- Consequence worth knowing: leads with created_by = null (an imported row
-- where no matching person was found) are now invisible to every regular
-- member — only a full Admin can see and act on them going forward (a
-- team_admin can still see them read-only via can_view_lead's own separate
-- clause, unaffected by this change, but can't act on them either).
--
-- Signature is unchanged (3 args), so `create or replace` is enough — same
-- pattern as migration 0018, no policies need dropping or recreating.

create or replace function public.can_access_lead(lead_created_by uuid, lead_team_id uuid, lead_imported boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or lead_created_by = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = lead_created_by and p.manager_id = auth.uid()
    );
$$;
