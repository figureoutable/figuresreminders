import DashboardView from "@/components/dashboard-view";
import {
  attachAcknowledgements,
  type AcknowledgementRow,
  type DeadlineViewRow,
} from "@/lib/ack";
import { toDashboardDTO } from "@/lib/dashboard-serialize";
import { generateDeadlines } from "@/lib/deadlines";
import { tryCreateServiceSupabase } from "@/lib/supabase/admin";

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
  const supabase = tryCreateServiceSupabase();
  if (!supabase) {
    return (
      <DashboardView
        initialRows={[]}
        loadError="Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your host’s environment variables (e.g. Vercel → Project → Settings → Environment Variables), then redeploy."
        stats={{ overdue: 0, dueThisMonth: 0, upcoming: 0 }}
      />
    );
  }

  const [{ data: clients, error: clientsError }, { data: acks, error: acksError }] =
    await Promise.all([
      supabase.from("clients").select("*").order("created_at", { ascending: false }),
      supabase.from("deadline_acknowledgements").select("*"),
    ]);

  if (clientsError || acksError) {
    const detail = clientsError?.message ?? acksError?.message ?? "Unknown error";
    return (
      <DashboardView
        initialRows={[]}
        loadError={`Could not load data from Supabase (${detail}). Check that migrations in supabase/migrations have been applied to your project and that the service role key is correct.`}
        stats={{ overdue: 0, dueThisMonth: 0, upcoming: 0 }}
      />
    );
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
