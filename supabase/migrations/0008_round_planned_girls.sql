-- "Total girls" planning number for a round — mirrors leads.planned_girls_reach,
-- which only existed on the lead/round-1 row before this.
alter table lead_rounds add column planned_girls_reach numeric;
