"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import type { ActivityLog, ActivityPlaybook } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  digital: "Digital Outreach",
  press: "Press",
  rto: "RTO Centers",
  outreach_updates: "Outreach Updates",
};

function LogTable({ rows: allRows }: { rows: ActivityLog[] }) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [r.channel, r.mode, r.activity, r.region, r.state, r.district]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [allRows, query]);

  if (allRows.length === 0)
    return <p className="py-6 text-sm text-neutral-500">No records.</p>;

  return (
    <div className="flex flex-col gap-3">
      {allRows.length > 10 && (
        <Input
          placeholder="Search by channel, activity, region, state, district…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {query && (
        <p className="text-xs text-neutral-400">
          {rows.length} of {allRows.length} records
        </p>
      )}
      {rows.length === 0 ? (
        <p className="py-6 text-sm text-neutral-500">
          No records match &quot;{query}&quot;.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Region / State / District</TableHead>
                <TableHead className="text-right">Reach</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.date ?? "—"}</TableCell>
                  <TableCell>{r.channel ?? "—"}</TableCell>
                  <TableCell>{r.mode ?? "—"}</TableCell>
                  <TableCell>{r.activity ?? "—"}</TableCell>
                  <TableCell>
                    {[r.region, r.state, r.district]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="text-right">{r.reach ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function PlaybookList({ items: allItems }: { items: ActivityPlaybook[] }) {
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((p) =>
      [
        p.institution_category,
        p.activity,
        p.description,
        p.channel_type,
        p.materials_needed,
        p.tips,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [allItems, query]);

  return (
    <div className="flex flex-col gap-3">
      {allItems.length > 10 && (
        <Input
          placeholder="Search the playbook…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {query && (
        <p className="text-xs text-neutral-400">
          {items.length} of {allItems.length} entries
        </p>
      )}
      {items.length === 0 ? (
        <p className="py-6 text-sm text-neutral-500">
          No entries match &quot;{query}&quot;.
        </p>
      ) : (
        items.map((p) => (
          <div key={p.id} className="rounded-md border p-3">
            <div className="text-xs font-medium text-neutral-400">
              {p.institution_category}
            </div>
            <div className="font-medium">{p.activity}</div>
            {p.description && (
              <p className="mt-1 text-sm text-neutral-600">{p.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-500">
              {p.channel_type && <span>Channel: {p.channel_type}</span>}
              {p.materials_needed && (
                <span>Materials: {p.materials_needed}</span>
              )}
            </div>
            {p.tips && (
              <p className="mt-2 text-xs text-neutral-500">Tips: {p.tips}</p>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export function LogsView({
  logsBySource,
  playbook,
}: {
  logsBySource: Record<string, ActivityLog[]>;
  playbook: ActivityPlaybook[];
}) {
  const [tab, setTab] = useState("digital");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <div className="overflow-x-auto">
        <TabsList className="w-max">
          {Object.keys(SOURCE_LABELS).map((s) => (
            <TabsTrigger key={s} value={s} className="whitespace-nowrap">
              {SOURCE_LABELS[s]} ({logsBySource[s]?.length ?? 0})
            </TabsTrigger>
          ))}
          <TabsTrigger value="playbook" className="whitespace-nowrap">
            Activity Playbook ({playbook.length})
          </TabsTrigger>
        </TabsList>
      </div>

      {Object.keys(SOURCE_LABELS).map((s) => (
        <TabsContent key={s} value={s}>
          <LogTable rows={logsBySource[s] ?? []} />
        </TabsContent>
      ))}

      <TabsContent value="playbook">
        <PlaybookList items={playbook} />
      </TabsContent>
    </Tabs>
  );
}
