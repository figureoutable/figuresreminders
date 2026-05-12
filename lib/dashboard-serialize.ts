/**
 * Serialises deadline view-models for React Server → Client props (Dates → ISO).
 */
import { format } from "date-fns";

import type { DeadlineViewRow } from "@/lib/ack";

export interface DashboardRowDTO {
  key: string;
  clientId: string;
  clientName: string;
  type: string;
  deadlineDate: string;
  flagDate: string;
  daysUntilDeadline: number;
  daysUntilFlag: number;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  /** Accounting year end (ISO); set for corporation tax rows for status rules. */
  yearEndDate: string | null;
}

export function toDashboardDTO(rows: DeadlineViewRow[]): DashboardRowDTO[] {
  return rows.map((r) => ({
    key: `${r.clientId}|${r.type}|${format(r.deadlineDate, "yyyy-MM-dd")}`,
    clientId: r.clientId,
    clientName: r.clientName,
    type: r.type,
    deadlineDate: r.deadlineDate.toISOString(),
    flagDate: r.flagDate.toISOString(),
    daysUntilDeadline: r.daysUntilDeadline,
    daysUntilFlag: r.daysUntilFlag,
    acknowledged: r.acknowledged,
    acknowledgedBy: r.acknowledgedBy,
    yearEndDate: r.yearEndDate?.toISOString() ?? null,
  }));
}
