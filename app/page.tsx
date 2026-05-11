import DashboardView from "@/components/dashboard-view";
import {
  attachAcknowledgements,
  type AcknowledgementRow,
  type DeadlineViewRow,
} from "@/lib/ack";
import { toDashboardDTO } from "@/lib/dashboard-serialize";
import { generateDeadlines } from "@/lib/deadlines";
import { createServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Computes summary stat cards from **unacknowledged** deadlines only.
 */
function computeStats(rows: DeadlineViewRow[]) {
  const now = new Date();
  const active = rows.filter((r) => !r.acknowledged);
  let overdue = 0;
  let dueThisMonth = 0;
  let upcoming = 0;
  for (const r of active) {
    if (r.daysUntilDeadline < 0) {
      overdue++;
    } else if (
      r.deadlineDate.getMonth() === now.getMonth() &&
      r.deadlineDate.getFullYear() === now.getFullYear()
    ) {
      dueThisMonth++;
    } else {
      upcoming++;
    }
  }
  return { overdue, dueThisMonth, upcoming };
}

export default async function HomePage() {
  const supabase = createServiceSupabase();
  const [{ data: clients, error: clientsError }, { data: acks, error: acksError }] =
    await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("deadline_acknowledgements").select("*"),
    ]);

  if (clientsError || acksError) {
    throw new Error(clientsError?.message ?? acksError?.message);
  }

  const deadlines = generateDeadlines(clients ?? []);
  const merged = attachAcknowledgements(
    deadlines,
    (acks ?? []) as AcknowledgementRow[]
  );
  const stats = computeStats(merged);
  const initialRows = toDashboardDTO(merged);

  return <DashboardView initialRows={initialRows} stats={stats} />;
}
