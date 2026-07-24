-- One-off archive table for the Honeywell sub-team leads being removed from
-- the live pipeline. Mirrors the leads table exactly (same columns/types),
-- but is not wired into RLS/app code — it's a backup only, populated and
-- read via the service-role key directly.
create table if not exists leads_honeywell_backup (like leads including all);
