-- Narrows lead visibility from "anyone on my team" to "leads I created,
-- plus (if I'm someone's manager) leads my direct reports created". Admins
-- are unaffected — they still see everything.

alter table profiles add column manager_id uuid references profiles (id) on delete set null;
create index profiles_manager_id_idx on profiles (manager_id);

-- True for admins, for a lead's own creator, and for that creator's manager.
create or replace function public.can_access_lead(lead_created_by uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.is_admin()
    or lead_created_by = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = lead_created_by and p.manager_id = auth.uid()
    );
$$;

-- ── leads: replace team-wide read/update with own-or-reports ────────────
drop policy "read team leads" on leads;
drop policy "update team leads" on leads;

create policy "read own or reports leads" on leads for select to authenticated
  using (public.can_access_lead(created_by));

create policy "update own or reports leads" on leads for update to authenticated
  using (public.can_access_lead(created_by));

-- insert stays team-scoped: you can only create leads for your own team,
-- and you (the creator) automatically get visibility via the policy above.

-- ── lead_rounds: match the same ownership rule via the parent lead ──────
drop policy "read rounds of visible leads" on lead_rounds;
drop policy "insert rounds of visible leads" on lead_rounds;
drop policy "update rounds of visible leads" on lead_rounds;

create policy "read rounds of visible leads" on lead_rounds for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by)
    )
  );

create policy "insert rounds of visible leads" on lead_rounds for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by)
    )
  );

create policy "update rounds of visible leads" on lead_rounds for update to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_rounds.lead_id and public.can_access_lead(l.created_by)
    )
  );

-- ── lead_updates: same ────────────────────────────────────────────────
drop policy "read updates of visible leads" on lead_updates;
drop policy "insert updates of visible leads" on lead_updates;

create policy "read updates of visible leads" on lead_updates for select to authenticated
  using (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_access_lead(l.created_by)
    )
  );

create policy "insert updates of visible leads" on lead_updates for insert to authenticated
  with check (
    exists (
      select 1 from leads l
      where l.id = lead_updates.lead_id and public.can_access_lead(l.created_by)
    )
  );
