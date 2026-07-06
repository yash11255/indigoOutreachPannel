import { requireAdmin } from "@/lib/data/session";
import { getActivityLog, getActivityPlaybook } from "@/lib/data/admin";
import { LogsView } from "./logs-view";

const SOURCES = ["digital", "press", "rto", "outreach_updates"];

export default async function AdminLogsPage() {
  await requireAdmin();

  const [logsPerSource, playbook] = await Promise.all([
    Promise.all(SOURCES.map((s) => getActivityLog(s))),
    getActivityPlaybook(),
  ]);

  const logsBySource = Object.fromEntries(SOURCES.map((s, i) => [s, logsPerSource[i]]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Legacy logs & reference</h1>
        <p className="text-sm text-neutral-500">
          Imported from the original Excel tracker — read-only historical data plus the activity
          playbook used when planning a new lead.
        </p>
      </div>
      <LogsView logsBySource={logsBySource} playbook={playbook} />
    </div>
  );
}
