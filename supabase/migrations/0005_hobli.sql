-- Adds the Hobli/Taluk sub-district field from the standardized Tracker.xlsx
-- field list. Free-text and optional: the Geography Master's own notes say
-- this level of data isn't reliably available to pre-populate, so it's
-- filled in by the field team directly when known, not looked up.
alter table leads add column hobli text;
