-- Interns are a separate employment category, not a permission level — they
-- have exactly the same access as a regular "member" (create/edit their own
-- team's leads), so this is a plain label column rather than a new value in
-- the role enum. Keeping it out of the role column avoids touching every
-- RLS policy and permission check that pattern-matches on role.
alter table profiles add column is_intern boolean not null default false;
