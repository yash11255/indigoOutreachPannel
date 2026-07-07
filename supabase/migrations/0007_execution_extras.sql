-- Fields collected around execution time:
--   - drive_link: link to the Google Drive folder/file with session photos
--     or other evidence, settable on both the lead (round 1) and any round.
--   - lead_rounds.no_of_institutions: "Total students" wasn't previously
--     capturable per-round (only on the lead/round-1 row) — add it here so
--     every round can carry its own count, same as round 1 already does.

alter table leads add column drive_link text;
alter table lead_rounds add column no_of_institutions numeric;
alter table lead_rounds add column drive_link text;
