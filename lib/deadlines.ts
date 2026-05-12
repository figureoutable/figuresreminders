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
  /** Optional; display / CRM — not used when generating deadlines. */
  owner?: string | null;
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
  /** Month-end accounting year end; set for corporation tax rows (status rules). */
  yearEndDate?: Date | null;
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
 * Next occurrence of the **last calendar day** of `monthIndex` (0–11) on or after `from`.
 * Used for confirmation statement and statutory accounts (month-anchored annual cycles).
 */
function nextAnnualLastDayOfCalendarMonth(monthIndex: number, from: Date): Date {
  const fromDay = startOfDay(from);
  let y = fromDay.getFullYear();
  let cand = startOfDay(lastDayOfMonth(new Date(y, monthIndex, 1)));
  if (cand < fromDay) {
    cand = startOfDay(lastDayOfMonth(new Date(y + 1, monthIndex, 1)));
  }
  return cand;
}

/** Flag on the last day of the calendar month **before** the deadline’s month. */
function flagLastDayOfMonthBeforeDeadline(deadline: Date): Date {
  return startOfDay(lastDayOfMonth(addMonths(deadline, -1)));
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
  const horizonEnd = startOfDay(addDays(fromDay, 365));
  const lookback = startOfDay(addMonths(fromDay, -6));
  let iter = new Date(lookback.getFullYear(), lookback.getMonth(), 1);
  const endGuard = addMonths(horizonEnd, 2);
  for (let i = 0; i < 54 && out.length < maxCount; i++) {
    if (iter > endGuard) {
      break;
    }
    const month1 = iter.getMonth() + 1;
    if (ends.has(month1)) {
      const last = startOfDay(lastDayOfMonth(iter));
      if (last >= lookback && last <= horizonEnd) {
        out.push(last);
      }
    }
    iter = addMonths(iter, 1);
  }
  return out;
}

/**
 * Builds payroll / PAYE-style rows: **last day of each month** for the next 12 months.
 */
function collectPayrollDeadlines(from: Date): Date[] {
  const out: Date[] = [];
  const fromDay = startOfDay(from);
  let iter = new Date(fromDay.getFullYear(), fromDay.getMonth(), 1);
  let last = startOfDay(lastDayOfMonth(iter));
  if (last < fromDay) {
    iter = addMonths(iter, 1);
    last = startOfDay(lastDayOfMonth(iter));
  }
  for (let i = 0; i < 12; i++) {
    out.push(last);
    iter = addMonths(iter, 1);
    last = startOfDay(lastDayOfMonth(iter));
  }
  return out;
}

/**
 * Main generator: maps stored client fields → concrete deadlines + flags.
 *
 * Flag rules: confirmation & statutory accounts use month-end deadlines and prior
 * month-end flags; CT uses five-month lead flags; SA four months; payroll month-end;
 * VAT quarter month-ends with prior month-end flags.
 *
 * Only deadlines **on or before** `referenceDate + 365 days` are returned so
 * dashboard / digest lists stay within roughly one year.
 */
export function generateDeadlines(
  clients: ClientRow[],
  referenceDate: Date = new Date()
): GeneratedDeadline[] {
  const today = startOfDay(referenceDate);
  const horizonEnd = startOfDay(addDays(today, 365));
  const rows: GeneratedDeadline[] = [];

  for (const c of clients) {
    // --- Confirmation Statement (annual last day of anchor month) ---
    if (c.confirmation_statement_date) {
      const anchor = startOfDay(parseISO(c.confirmation_statement_date));
      const deadline = nextAnnualLastDayOfCalendarMonth(anchor.getMonth(), today);
      const flag = flagLastDayOfMonthBeforeDeadline(deadline);
      rows.push({
        clientId: c.id,
        clientName: c.name,
        type: OBLIGATION_TYPES.CONFIRMATION,
        deadlineDate: deadline,
        flagDate: flag,
        daysUntilDeadline: daysBetween(today, deadline),
        daysUntilFlag: daysBetween(today, flag),
      });
    }

    // --- Statutory accounts filing (Companies House `accounts_filing_due_date`) ---
    if (c.accounts_filing_due_date) {
      const anchor = startOfDay(parseISO(c.accounts_filing_due_date));
      const deadline = nextAnnualLastDayOfCalendarMonth(anchor.getMonth(), today);
      const flag = flagLastDayOfMonthBeforeDeadline(deadline);
      rows.push({
        clientId: c.id,
        clientName: c.name,
        type: OBLIGATION_TYPES.ACCOUNTS_FILING,
        deadlineDate: deadline,
        flagDate: flag,
        daysUntilDeadline: daysBetween(today, deadline),
        daysUntilFlag: daysBetween(today, flag),
      });
    }

    // --- Corporation tax (requires year end, normalised to month-end) ---
    if (c.year_end_date) {
      const ye = startOfDay(lastDayOfMonth(parseISO(c.year_end_date)));
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
        yearEndDate: ye,
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
        yearEndDate: ye,
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

    // --- Payroll (12 × last day of month — PAYE-style) ---
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

    // --- VAT quarter ends (deadline = last day of quarter month; flag = prior month-end) ---
    if (c.vat_quarter_end_month != null) {
      for (const d of collectVatDeadlines(c.vat_quarter_end_month, today, 16)) {
        const flag = flagLastDayOfMonthBeforeDeadline(d);
        rows.push({
          clientId: c.id,
          clientName: c.name,
          type: OBLIGATION_TYPES.VAT,
          deadlineDate: d,
          flagDate: flag,
          daysUntilDeadline: daysBetween(today, d),
          daysUntilFlag: daysBetween(today, flag),
        });
      }
    }
  }

  const vatLookback = startOfDay(addMonths(today, -6));
  return rows.filter((r) => {
    const d = startOfDay(r.deadlineDate);
    if (d > horizonEnd) {
      return false;
    }
    if (r.type === OBLIGATION_TYPES.VAT) {
      return d >= vatLookback;
    }
    return d >= today;
  });
}

/** Dashboard status column: red only for the three product rules; otherwise green. */
export type DashboardStatusBadge = "red" | "green";

export function dashboardStatusBadge(
  row: Pick<GeneratedDeadline, "type" | "daysUntilDeadline"> & {
    yearEndDate?: Date | null;
  },
  referenceDate: Date = new Date()
): DashboardStatusBadge {
  const t = startOfDay(referenceDate);

  if (row.type === OBLIGATION_TYPES.PAYROLL && row.daysUntilDeadline < 7) {
    return "red";
  }
  if (row.type === OBLIGATION_TYPES.VAT && row.daysUntilDeadline < 0) {
    return "red";
  }
  if (
    row.type === OBLIGATION_TYPES.CORP_TAX_PAYMENT &&
    row.yearEndDate != null
  ) {
    const ye = startOfDay(lastDayOfMonth(row.yearEndDate));
    const threeMonthsAfterYe = startOfDay(addMonths(ye, 3));
    if (t >= threeMonthsAfterYe) {
      return "red";
    }
  }
  return "green";
}
