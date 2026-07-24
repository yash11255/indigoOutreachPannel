"use client";

import { useEffect, useMemo, useState } from "react";
import * as topojson from "topojson-client";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { normalizeStateName } from "@/lib/india-geo";
import type { CategoryBreakdownRow } from "@/lib/data/scholarship";

type GeoFeature = {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: unknown;
};

const BLUE_SCALE = ["#e0e0e0", "#c9deff", "#8ab6ff", "#4589ff", "#0f62fe", "#002d9c"];

function bucketColor(count: number, max: number): string {
  if (count === 0 || max <= 0) return BLUE_SCALE[0];
  const ratio = count / max;
  if (ratio > 0.8) return BLUE_SCALE[5];
  if (ratio > 0.6) return BLUE_SCALE[4];
  if (ratio > 0.4) return BLUE_SCALE[3];
  if (ratio > 0.2) return BLUE_SCALE[2];
  return BLUE_SCALE[1];
}

/**
 * A read-only choropleth of applications by state — deliberately a separate,
 * simpler component from components/india-map.tsx (which is tightly coupled
 * to the Lead/Team types and outreach-specific drill-down UI) rather than
 * trying to generalize that shipped, working component and risk regressing
 * the existing outreach Map page.
 */
export function ScholarshipIndiaMap({ rows }: { rows: CategoryBreakdownRow[] }) {
  const [statesGeo, setStatesGeo] = useState<GeoFeature[] | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/india-states.json")
      .then((r) => r.json())
      .then((statesTopo) => {
        const fc = topojson.feature(
          statesTopo,
          statesTopo.objects[Object.keys(statesTopo.objects)[0]],
        ) as unknown as { features: GeoFeature[] };
        setStatesGeo(fc.features);
      });
  }, []);

  const totalsByState = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = normalizeStateName(row.category);
      if (!key) continue;
      map.set(key, (map.get(key) ?? 0) + row.total);
    }
    return map;
  }, [rows]);

  const max = Math.max(1, ...Array.from(totalsByState.values()));

  if (!statesGeo) {
    return <p className="text-sm text-neutral-500">Loading map…</p>;
  }

  return (
    <div className="relative">
      <ComposableMap projection="geoMercator" projectionConfig={{ center: [82, 22], scale: 1000 }}>
        <ZoomableGroup center={[82, 22]} zoom={1}>
          <Geographies geography={{ type: "FeatureCollection", features: statesGeo }}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const stateName = String(geo.properties.st_nm ?? "");
                const key = normalizeStateName(stateName);
                const count = totalsByState.get(key) ?? 0;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHovered(`${stateName}: ${count.toLocaleString("en-IN")}`)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      default: {
                        fill: bucketColor(count, max),
                        stroke: "#ffffff",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: "#0f62fe",
                        stroke: "#ffffff",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      pressed: { outline: "none" },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      {hovered && (
        <div className="pointer-events-none absolute top-2 left-2 rounded-md border bg-white px-2 py-1 text-xs shadow-sm">
          {hovered}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
        <span>Fewer</span>
        {BLUE_SCALE.map((c) => (
          <span key={c} className="size-3 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
