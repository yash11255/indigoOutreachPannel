-- The source form has two genuinely distinct questions that were initially
-- conflated into one column: "What is your education status?" (Completed /
-- Pursuing) vs. "What is your highest qualification?" (Undergraduate /
-- Postgraduate / etc.) — confirmed as separate against live API data.
alter table scholarship_applications add column education_status text;
