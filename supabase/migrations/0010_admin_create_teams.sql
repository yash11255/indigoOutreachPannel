-- teams had a select policy only — admins couldn't create a team from the
-- app itself, only via a script with the service-role key. Adds the missing
-- insert policy so the new "Create team" form in Admin > Users works.
create policy "admins insert teams" on teams for insert to authenticated
  with check (public.is_admin());
