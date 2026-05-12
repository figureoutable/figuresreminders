/**
 * Derives a flat list of upcoming obligation deadlines from raw `clients` rows.
 * Lead times (`flagDate`) drive digest "Action Required" and alerting logic.
 */
import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  lastDayOfMonth,
  parseISO,
  startOfDay,
  format,
} from "date-fns";

import { OBLIGATION_TYPES } from "@/lib/constants";

/** Shape returned by Supabase for `clients` rows used by deadline generation. */
export interface ClientRow {
  id: string;
  name: string;
  year_end_date: string | null;
  confirmation_statement_date: string | null;
  /** Optional; not used by obligation generator (reference / Companies House). */
  accounts_filing_due_date?: string | null;
  self_assessment_date: string | null;
  vat_quarter_end_month: number | null;
  payroll_active: boolean;
}

/** One concrete obligation instance shown on the dashboard / digest. */
export interface GeneratedDeadline {
  clientId: string;
  clientName: string;
  type: string;
  deadlineDate: Date;
  flagDate: Date;
  daysUntilDeadline: number;
  daysUntilFlag: number;
}

/** Stable key matching `deadline_acknowledgements` uniqueness. */
export function deadlineAckKey(
  clientId: string,
  obligationType: string,
  deadlineDate: Date
): string {
  return `${clientId}|${obligationType}|${format(deadlineDate, "yyyy-MM-dd")}`;
}

function daysBetween(from: Date, to: Date): number {
  return differenceInCalendarDays(startOfDay(to), startOfDay(from));
}

/**
 * Next calendar occurrence of the month/day taken from `anchor` that is on
 * or after `from` (Confirmation Statement annual cycle).
 */
function nextAnnualOccurrence(anchor: Date, from: Date): Date {
  const fromDay = startOfDay(from);
  const month = anchor.getMonth();
  const date = anchor.getDate();
  let candidate = new Date(fromDay.getFullYear(), month, date);
  if (startOfDay(candidate) < fromDay) {
    candidate = new Date(fromDay.getFullYear() + 1, month, date);
  }
  return startOfDay(candidate);
}

/** UK Self Assessment online filing — next 31 January, unless a stored date is future. */
function nextSelfAssessmentDeadline(
  stored: string | null,
  from: Date
): Date {
  const fromDay = startOfDay(from);
  if (stored) {
    let d = startOfDay(parseISO(stored));
    while (d < fromDay) {
      d = addYears(d, 1);
    }
    return d;
  }
  const y = fromDay.getFullYear();
  let jan = new Date(y, 0, 31);
  if (startOfDay(jan) < fromDay) {
    jan = new Date(y + 1, 0, 31);
  }
  return startOfDay(jan);
}

/** Four calendar months that contain quarter-end dates for a chosen anchor month (1–12). */
export function vatQuarterEndMonths(anchor1to12: number): number[] {
  const zeroBased = ((anchor1to12 - 1) % 12) + 12;
  const a = zeroBased % 12;
  return [0, 1, 2, 3].map((k) => ((a + k * 3) % 12) + 1);
}

function collectVatDeadlines(
  anchorMonth: number,
  from: Date,
  maxCount: number
): Date[] {
  const ends = new Set(vatQuarterEndMonths(anchorMonth));
  const out: Date[] = [];
  const fromDay = startOfDay(from);
  let iter = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < 36 && out.length < maxCount; i++) {
    const month1 = iter.getMonth() + 1;
    if (ends.has(month1)) {
      const last = startOfDay(lastDayOfMonth(iter));
      if (last >= fromDay) {
        out.push(last);
      }
    }
    iter = addMonths(iter, 1);
  }
  return out;
}

/**
 * Builds payroll rows (26th of month) for the next 12 upcoming months.
 */
function collectPayrollDeadlines(from: Date): Date[] {
  const out: Date[] = [];
  const fromDay = startOfDay(from);
  let y = fromDay.getFullYear();
  let mo = fromDay.getMonth();
  let candidate = new Date(y, mo, 26);
  if (startOfDay(candidate) < fromDay) {
    mo += 1;
    if (mo > 11) {
      mo = 0;
      y += 1;
    }
    candidate = new Date(y, mo, 26);
  }
  for (let i = 0; i < 12; i++) {
    const yy = candidate.getFullYear();
    const mm = candidate.getMonth();
    out.push(startOfDay(new Date(yy, mm, 26)));
    const nm = mm + 1;
    candidate =
      nm > 11 ? new Date(yy + 1, 0, 26) : new Date(yy, nm, 26);
  }
  return out;
}

/**
 * Main generator: maps stored client fields → concrete deadlines + flags.
 *
 * Flag rules (per product spec):
 * - Confirmation Statement: 30 days before deadline
 * - CT filing / payment: 5 months before each respective deadline
 * - Self Assessment: 4 months before deadline (Sept 30 when deadline is 31 Jan)
 * - Payroll: flag equals deadline (monthly rhythm)
 * - VAT: flag equals quarter-end date (action when quarter closes)
 */
export function generateDeadlines(
  clients: ClientRow[],
  referenceDate: Date = new Date()
): GeneratedDeadline[] {
  const today = startOfDay(referenceDate);
  const rows: GeneratedDeadline[] = [];

  for (const c of clients) {
    // --- Confirmation Statement (annual from stored anchor date) ---
    if (c.confirmation_statement_date) {
      const anchor = startOfDay(parseISO(c.confirmation_statement_date));
      const deadline = nextAnnualOccurrence(anchor, today);
      const flag = addDays(deadline, -30);
      rows.push({
        clientId: c.id,
        clientName: c.name,
        type: OBLIGATION_TYPES.CONFIRMATION,
        deadlineDate: deadline,
        flagDate: startOfDay(flag),
        daysUntilDeadline: daysBetween(today, deadline),
        daysUntilFlag: daysBetween(today, startOfDay(flag)),
      });
    }

    // --- Corporation tax (requires year end) ---
    if (c.year_end_date) {
      const ye = startOfDay(parseISO(c.year_end_date));
      const filing = startOfDay(addYears(ye, 12));
      const payment = startOfDay(addDays(addMonths(ye, 9), 1));

      const filingFlag = addMonths(filing, -5);
      rows.push({
        clientId: c.id,
        clientName: c.name,
        type: OBLIGATION_TYPES.CORP_TAX_FILING,
        deadlineDate: filing,
        flagDate: startOfDay(filingFlag),
        daysUntilDeadline: daysBetween(today, filing),
        daysUntilFlag: daysBetween(today, startOfDay(filingFlag)),
      });

      const paymentFlag = addMonths(payment, -5);
      rows.push({
        clientId: c.id,
        clientName: c.name,
        type: OBLIGATION_TYPES.CORP_TAX_PAYMENT,
        deadlineDate: payment,
        flagDate: startOfDay(paymentFlag),
        daysUntilDeadline: daysBetween(today, payment),
        daysUntilFlag: daysBetween(today, startOfDay(paymentFlag)),
      });
    }

    // --- Self Assessment (only when a return date exists on the client) ---
    if (c.self_assessment_date) {
      const deadline = nextSelfAssessmentDeadline(
        c.self_assessment_date,
        today
      );
      const flag = addMonths(deadline, -4);
      rows.push({
        clientId: c.id,
        clientName: c.name,
        type: OBLIGATION_TYPES.SELF_ASSESSMENT,
        deadlineDate: deadline,
        flagDate: startOfDay(flag),
        daysUntilDeadline: daysBetween(today, deadline),
        daysUntilFlag: daysBetween(today, startOfDay(flag)),
      });
    }

    // --- Payroll (12 monthly 26th dates) ---
    if (c.payroll_active) {
      for (const d of collectPayrollDeadlines(today)) {
        rows.push({
          clientId: c.id,
          clientName: c.name,
          type: OBLIGATION_TYPES.PAYROLL,
          deadlineDate: d,
          flagDate: d,
          daysUntilDeadline: daysBetween(today, d),
          daysUntilFlag: daysBetween(today, d),
        });
      }
    }

    // --- VAT quarter ends ---
    if (c.vat_quarter_end_month != null) {
      for (const d of collectVatDeadlines(c.vat_quarter_end_month, today, 12)) {
        rows.push({
          clientId: c.id,
          clientName: c.name,
          type: OBLIGATION_TYPES.VAT,
          deadlineDate: d,
          flagDate: d,
          daysUntilDeadline: daysBetween(today, d),
          daysUntilFlag: daysBetween(today, d),
        });
      }
    }
  }

  return rows;
}

/** Status badge bucket for dashboard styling. */
export type UrgencyBadge = "red" | "amber" | "green";

export function urgencyFromDays(days: number): UrgencyBadge {
  if (days <= 14) {
    return "red";
  }
  if (days <= 30) {
    return "amber";
  }
  return "green";
}
