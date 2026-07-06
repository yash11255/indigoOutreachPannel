-- Authoritative India district master, compiled from NITI Aayog's Aspirational
-- Districts Programme + current state-wise district records (source:
-- India_Geography_Master.xlsx). Used as the canonical district reference for
-- the map and for flagging CSR-priority (Aspirational District) leads.

create table districts_master (
  id uuid primary key default gen_random_uuid(),
  region text not null,
  state text not null,
  district text not null,
  district_code text,
  division text,
  is_aspirational boolean not null default false,
  aspirational_programme text,
  priority_category text,
  unique (state, district)
);

alter table districts_master enable row level security;

create policy "lookups readable by authenticated" on districts_master
  for select to authenticated using (true);
