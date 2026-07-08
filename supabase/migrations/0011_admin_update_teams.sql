-- teams had select (everyone) and insert (admins, migration 0010) policies but
-- no update policy — admins couldn't rename a team from the app. Adds the
-- missing update policy so the "rename team" control in Admin > Users works.
create policy "admins update teams" on teams for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
