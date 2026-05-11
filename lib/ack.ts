/**
 * Helpers for joining generated deadlines with `deadline_acknowledgements` rows.
 */
import { format } from "date-fns";

import type { GeneratedDeadline } from "@/lib/deadlines";

export interface AcknowledgementRow {
  client_id: string;
  obligation_type: string;
  deadline_date: string;
  acknowledged_by: string | null;
}

/** View-model row used by the dashboard table (includes strike-through state). */
export interface DeadlineViewRow extends GeneratedDeadline {
  acknowledged: boolean;
  acknowledgedBy: string | null;
}

export function attachAcknowledgements(
  deadlines: GeneratedDeadline[],
  acks: AcknowledgementRow[]
): DeadlineViewRow[] {
  const map = new Map<string, string | null>();
  for (const a of acks) {
    const k = `${a.client_id}|${a.obligation_type}|${a.deadline_date}`;
    map.set(k, a.acknowledged_by);
  }
  return deadlines.map((d) => {
    const key = `${d.clientId}|${d.type}|${format(d.deadlineDate, "yyyy-MM-dd")}`;
    const by = map.get(key);
    return {
      ...d,
      acknowledged: map.has(key),
      acknowledgedBy: by ?? null,
    };
  });
}
