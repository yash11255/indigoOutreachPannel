-- Two distinct concepts were getting conflated: which CSR client-account/org
-- team a person belongs to (from the Employee Master Data — IBM, Xiaomi,
-- Finance, HR, etc.) versus which outreach pipeline their leads should be
-- attributed to. `profiles.team_id` / `leads.team_id` is the latter (the
-- "outreach team") and already drives every stat in the app — that's
-- unchanged. This adds a separate, read-only reference field for the former
-- ("home team"), and seeds the actual small set of real outreach teams now
-- that teams/leads have been cleared for a fresh start.

alter table profiles add column home_team text;

insert into teams (name, slug) values
  ('BC IGWF Outreach', 'bc-igwf-outreach'),
  ('RTO Centres New', 'rto-centres-new'),
  ('BC NE Outreach', 'bc-ne-outreach'),
  ('BC FutureTech', 'bc-futuretech'),
  ('Livelihood Team', 'livelihood-team');
