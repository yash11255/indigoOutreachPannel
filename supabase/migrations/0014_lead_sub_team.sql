-- Some outreach teams (like BC FutureTech) are themselves an umbrella over
-- several client-account sub-divisions (IBM, Lenovo, Xiaomi MI Shala,
-- Kyndryl, etc.) — a lead's own source sheet records which sub-division it
-- came from. Storing it per-lead (rather than as a team hierarchy) matches
-- the data: the same person can contribute leads under different
-- sub-divisions over time.
alter table leads add column sub_team text;
