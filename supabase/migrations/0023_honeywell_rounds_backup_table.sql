-- Companion to leads_honeywell_backup: deleting a lead cascades to its
-- lead_rounds rows, so those need backing up too before the Honeywell
-- leads are removed.
create table if not exists lead_rounds_honeywell_backup (like lead_rounds including all);
