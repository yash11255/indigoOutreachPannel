"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as topojson from "topojson-client";
import { geoCentroid } from "d3-geo";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from "react-simple-maps";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StageBadge, StatusBadge } from "@/components/stage-badge";
import { normalizeStateName, findMatchingDistrict } from "@/lib/india-geo";
import { stageForStatus, STAGE_LABELS, type Lead, type Team } from "@/lib/types";

type GeoFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
};

const BLUE_SCALE = ["#e0e0e0", "#c9deff", "#8ab6ff", "#4589ff", "#0f62fe", "#002d9c"];

function bucketColor(count: number, max: number): string {
  if (count === 0) return BLUE_SCALE[0];
  if (max <= 0) return BLUE_SCALE[0];
  const ratio = count / max;
  if (ratio > 0.8) return BLUE_SCALE[5];
  if (ratio > 0.6) return BLUE_SCALE[4];
  if (ratio > 0.4) return BLUE_SCALE[3];
  if (ratio > 0.2) return BLUE_SCALE[2];
  return BLUE_SCALE[1];
}

/** Dark backgrounds (higher lead counts) need white label text to stay readable. */
function labelColor(count: number, max: number): string {
  if (max <= 0) return "#161616";
  const ratio = count / max;
  return ratio > 0.6 ? "#ffffff" : "#161616";
}

export function IndiaMap({
  leads,
  teams,
  isAdmin,
}: {
  leads: Lead[];
  teams: Team[];
  isAdmin: boolean;
}) {
  const [statesGeo, setStatesGeo] = useState<GeoFeature[] | null>(null);
  const [districtsGeo, setDistrictsGeo] = useState<GeoFeature[] | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>([82, 22]);
  const [zoom, setZoom] = useState(1);

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? "—";

  useEffect(() => {
    Promise.all([
      fetch("/data/india-states.json").then((r) => r.json()),
      fetch("/data/india-districts.json").then((r) => r.json()),
    ]).then(([statesTopo, districtsTopo]) => {
      const statesFc = topojson.feature(
        statesTopo,
        statesTopo.objects[Object.keys(statesTopo.objects)[0]],
      ) as unknown as { features: GeoFeature[] };
      const districtsFc = topojson.feature(
        districtsTopo,
        districtsTopo.objects[Object.keys(districtsTopo.objects)[0]],
      ) as unknown as { features: GeoFeature[] };
      setStatesGeo(statesFc.features);
      setDistrictsGeo(districtsFc.features);
    });
  }, []);

  const leadsByState = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of leads) {
      const key = normalizeStateName(lead.state);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }
    return map;
  }, [leads]);

  const stateMaxCount = useMemo(
    () => Math.max(1, ...Array.from(leadsByState.values()).map((l) => l.length)),
    [leadsByState],
  );

  const districtsForSelectedState = useMemo(() => {
    if (!selectedState || !districtsGeo) return [];
    const key = normalizeStateName(selectedState);
    return districtsGeo.filter((f) => normalizeStateName(String(f.properties.st_nm)) === key);
  }, [selectedState, districtsGeo]);

  const stateLeads = useMemo(() => {
    if (!selectedState) return [];
    return leadsByState.get(normalizeStateName(selectedState)) ?? [];
  }, [selectedState, leadsByState]);

  const stateLeadsSorted = useMemo(
    () =>
      [...stateLeads].sort((a, b) =>
        (a.district_city ?? "").localeCompare(b.district_city ?? ""),
      ),
    [stateLeads],
  );

  // Each lead is assigned to at most one official district — findMatchingDistrict
  // resolves ambiguity (e.g. "Kanpur" vs. Kanpur Nagar/Dehat) to a single name,
  // so a lead is never double-counted across multiple district polygons.
  const districtNamesForSelectedState = useMemo(
    () => districtsForSelectedState.map((f) => String(f.properties.district)),
    [districtsForSelectedState],
  );

  const leadsByDistrictName = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const lead of stateLeads) {
      const matched = findMatchingDistrict(lead.district_city, districtNamesForSelectedState);
      if (!matched) continue;
      if (!map.has(matched)) map.set(matched, []);
      map.get(matched)!.push(lead);
    }
    return map;
  }, [stateLeads, districtNamesForSelectedState]);

  function districtLeadCount(districtName: string): number {
    return leadsByDistrictName.get(districtName)?.length ?? 0;
  }

  const districtMax = useMemo(
    () => Math.max(1, ...districtsForSelectedState.map((f) => districtLeadCount(String(f.properties.district)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [districtsForSelectedState, leadsByDistrictName],
  );

  // Only label the busiest few districts on the map itself — labeling every
  // district with any activity overlaps badly in states with many small,
  // tightly-packed districts (e.g. Assam). Hover/click/the table below still
  // cover every district regardless.
  const MAX_DISTRICT_LABELS = 6;
  const topDistrictNames = useMemo(() => {
    const withCounts = districtsForSelectedState
      .map((f) => ({ name: String(f.properties.district), count: districtLeadCount(String(f.properties.district)) }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_DISTRICT_LABELS);
    return new Set(withCounts.map((d) => d.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtsForSelectedState, leadsByDistrictName]);

  function handleStateClick(feature: GeoFeature) {
    const name = String(feature.properties.st_nm);
    setSelectedState(name);
    setCenter(geoCentroid(feature as never) as [number, number]);
    setZoom(4);
  }

  function reset() {
    setSelectedState(null);
    setSelectedDistrict(null);
    setCenter([82, 22]);
    setZoom(1);
  }

  const selectedDistrictLeads = selectedDistrict
    ? (leadsByDistrictName.get(selectedDistrict) ?? [])
    : [];

  if (!statesGeo || !districtsGeo) {
    return <p className="py-10 text-center text-sm text-neutral-500">Loading map…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">
          {hovered ? (
            <span className="font-medium">{hovered}</span>
          ) : selectedState ? (
            <>
              <span className="font-semibold">State: {selectedState}</span> — {stateLeads.length}{" "}
              lead{stateLeads.length === 1 ? "" : "s"}
            </>
          ) : (
            <>Click a state to zoom in and see its districts.</>
          )}
        </div>
        {selectedState && (
          <Button variant="outline" size="sm" onClick={reset}>
            Back to India
          </Button>
        )}
      </div>

      <div className="relative border border-[#d0d0d0] bg-white">
        <div className="absolute top-2 right-2 z-10 flex flex-col">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Zoom in"
            className="rounded-none border-b-0"
            onClick={() => setZoom((z) => Math.min(8, z + 1))}
          >
            +
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Zoom out"
            className="rounded-none"
            onClick={() => setZoom((z) => Math.max(1, z - 1))}
          >
            −
          </Button>
        </div>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: [82, 22], scale: 1000 }}
          width={800}
          height={700}
          style={{ width: "100%", height: "auto" }}
        >
          <ZoomableGroup center={center} zoom={zoom} minZoom={1} maxZoom={8}>
            {!selectedState && (
              <Geographies geography={{ type: "FeatureCollection", features: statesGeo }}>
                {({ geographies }: { geographies: GeoFeature[] }) =>
                  geographies.map((geo) => {
                    const name = String(geo.properties.st_nm);
                    const count = leadsByState.get(normalizeStateName(name))?.length ?? 0;
                    return (
                      <Geography
                        key={name}
                        geography={geo}
                        onClick={() => handleStateClick(geo)}
                        onMouseEnter={() => setHovered(`State: ${name} — ${count} lead${count === 1 ? "" : "s"}`)}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          default: {
                            fill: bucketColor(count, stateMaxCount),
                            stroke: "#8d8d8d",
                            strokeWidth: 0.5,
                            outline: "none",
                            cursor: "pointer",
                          },
                          hover: {
                            fill: "#0f62fe",
                            stroke: "#161616",
                            strokeWidth: 0.75,
                            outline: "none",
                            cursor: "pointer",
                          },
                          pressed: { fill: "#002d9c", outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            )}

            {!selectedState &&
              statesGeo
                .filter((geo) => (leadsByState.get(normalizeStateName(String(geo.properties.st_nm)))?.length ?? 0) > 0)
                .map((geo) => {
                  const name = String(geo.properties.st_nm);
                  const count = leadsByState.get(normalizeStateName(name))?.length ?? 0;
                  return (
                    <Marker key={name} coordinates={geoCentroid(geo as never) as [number, number]}>
                      <text
                        textAnchor="middle"
                        style={{
                          fontSize: 7,
                          fontWeight: 600,
                          fill: labelColor(count, stateMaxCount),
                          pointerEvents: "none",
                        }}
                      >
                        {name}
                      </text>
                      <text
                        textAnchor="middle"
                        y={8}
                        style={{
                          fontSize: 6,
                          fill: labelColor(count, stateMaxCount),
                          pointerEvents: "none",
                        }}
                      >
                        {count}
                      </text>
                    </Marker>
                  );
                })}

            {selectedState && (
              <Geographies
                geography={{ type: "FeatureCollection", features: districtsForSelectedState }}
              >
                {({ geographies }: { geographies: GeoFeature[] }) =>
                  geographies.map((geo, i) => {
                    const districtName = String(geo.properties.district);
                    const count = districtLeadCount(districtName);
                    return (
                      <Geography
                        key={`${districtName}-${i}`}
                        geography={geo}
                        onClick={() => setSelectedDistrict(districtName)}
                        onMouseEnter={() =>
                          setHovered(`District: ${districtName} — ${count} lead${count === 1 ? "" : "s"}`)
                        }
                        onMouseLeave={() => setHovered(null)}
                        style={{
                          default: {
                            fill: bucketColor(count, districtMax),
                            stroke: "#8d8d8d",
                            strokeWidth: 0.4,
                            outline: "none",
                            cursor: count > 0 ? "pointer" : "default",
                          },
                          hover: {
                            fill: "#0f62fe",
                            stroke: "#161616",
                            strokeWidth: 0.6,
                            outline: "none",
                            cursor: "pointer",
                          },
                          pressed: { fill: "#002d9c", outline: "none" },
                        }}
                      />
                    );
                  })
                }
              </Geographies>
            )}

            {selectedState &&
              districtsForSelectedState
                .filter((geo) => topDistrictNames.has(String(geo.properties.district)))
                .map((geo, i) => {
                  const districtName = String(geo.properties.district);
                  const count = districtLeadCount(districtName);
                  return (
                    <Marker
                      key={`${districtName}-${i}`}
                      coordinates={geoCentroid(geo as never) as [number, number]}
                    >
                      <text
                        textAnchor="middle"
                        style={{
                          fontSize: 6,
                          fontWeight: 600,
                          fill: labelColor(count, districtMax),
                          pointerEvents: "none",
                        }}
                      >
                        {districtName} ({count})
                      </text>
                    </Marker>
                  );
                })}
          </ZoomableGroup>
        </ComposableMap>
      </div>

      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span>Fewer leads</span>
        {BLUE_SCALE.map((c) => (
          <span key={c} className="h-3 w-6" style={{ backgroundColor: c }} />
        ))}
        <span>More leads</span>
      </div>

      {selectedState && districtsForSelectedState.length === 0 && (
        <p className="text-sm text-neutral-500">
          No district boundaries found for {selectedState} in the map data — showing state total
          only.
        </p>
      )}

      {selectedState && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-neutral-700">
            All leads in {selectedState} ({stateLeadsSorted.length})
          </h2>
          {stateLeadsSorted.length === 0 ? (
            <p className="text-sm text-neutral-500">No leads in this state yet.</p>
          ) : (
            <div className="overflow-x-auto border border-[#d0d0d0]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institution</TableHead>
                    {isAdmin && <TableHead>Team</TableHead>}
                    <TableHead>State</TableHead>
                    <TableHead>District</TableHead>
                    <TableHead>Responsible member</TableHead>
                    <TableHead>Planned date</TableHead>
                    <TableHead>Executed date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stateLeadsSorted.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        <Link href={`/leads/${lead.id}`} className="hover:underline">
                          {lead.institution_name}
                        </Link>
                      </TableCell>
                      {isAdmin && <TableCell>{teamName(lead.team_id)}</TableCell>}
                      <TableCell>{lead.state ?? "—"}</TableCell>
                      <TableCell>{lead.district_city ?? "—"}</TableCell>
                      <TableCell>{lead.responsible_member ?? "Unassigned"}</TableCell>
                      <TableCell>{lead.planned_date ?? "—"}</TableCell>
                      <TableCell>{lead.executed_date ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={lead.status} />
                      </TableCell>
                      <TableCell>
                        <StageBadge status={lead.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={selectedDistrict !== null}
        onOpenChange={(open) => !open && setSelectedDistrict(null)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              District: {selectedDistrict} ({selectedState})
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {selectedDistrictLeads.length === 0 && (
              <p className="text-sm text-neutral-500">No leads matched to this district.</p>
            )}
            {selectedDistrictLeads.map((lead) => {
              const stage = stageForStatus(lead.status);
              return (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex flex-col gap-1 border border-[#d0d0d0] p-2 text-sm hover:bg-[#f4f4f4]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{lead.institution_name}</span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {STAGE_LABELS[stage]}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {isAdmin ? `${teamName(lead.team_id)} · ` : ""}
                    {lead.responsible_member ?? "Unassigned"}
                  </div>
                  <div className="flex gap-4 text-xs text-neutral-500">
                    <span>Planned: {lead.planned_date ?? "—"}</span>
                    <span>Executed: {lead.executed_date ?? "—"}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
