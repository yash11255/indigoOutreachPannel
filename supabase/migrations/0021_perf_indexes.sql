-- Performance: two of the most common query/RLS-check patterns had no
-- supporting index. created_by is the single most-hit filter — every
-- regular member's RLS check ultimately reduces to "is this my lead"
-- (can_access_lead's `lead_created_by = auth.uid()` and the manager-of
-- exists-subquery both key off it), and it was previously unindexed.
-- sub_team backs every team_admin sub-division scope check and the
-- sub-team grouping/export work from this session.

create index if not exists leads_created_by_idx on leads (created_by);
create index if not exists leads_sub_team_idx on leads (sub_team);
