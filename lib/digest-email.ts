/**
 * Builds the Monday digest HTML (Resend) from pre-filtered deadline rows.
 * Renders two banded views — first without payroll, then all reminders including
 * payroll — then a single Action Required block (flags in the next 7 days).
 */
import { addDays, differenceInMonths, format, startOfDay } from "date-fns";
import { enGB } from "date-fns/locale";

import { OBLIGATION_TYPES } from "@/lib/constants";
import type { GeneratedDeadline } from "@/lib/deadlines";

function fmt(d: Date): string {
  return format(d, "dd MMM yyyy", { locale: enGB });
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function urgentSection(d: GeneratedDeadline): boolean {
  return d.daysUntilDeadline < 0 || d.daysUntilDeadline <= 30;
}

function dueThisMonthSection(d: GeneratedDeadline, today: Date): boolean {
  if (urgentSection(d)) {
    return false;
  }
  return (
    d.deadlineDate.getMonth() === today.getMonth() &&
    d.deadlineDate.getFullYear() === today.getFullYear()
  );
}

/** Plain-English line for the "Action Required" block (flag inside 7 days). */
export function actionNoteForDeadline(
  d: GeneratedDeadline,
  today: Date
): string {
  const daysToDeadline = d.daysUntilDeadline;
  const months = Math.max(0, differenceInMonths(d.deadlineDate, today));

  if (d.type === OBLIGATION_TYPES.ACCOUNTS_FILING) {
    return `Chase statutory accounts for ${d.clientName} — filing deadline (month-end) approaching.`;
  }
  if (d.type === OBLIGATION_TYPES.CORP_TAX_FILING) {
    return `Request year end records from ${d.clientName} — CT600 filing due in ${months > 0 ? `${months} months` : `${Math.max(0, daysToDeadline)} days`}.`;
  }
  if (d.type === OBLIGATION_TYPES.CORP_TAX_PAYMENT) {
    return `Plan corporation tax cash flow for ${d.clientName} — CT payment due in ${months > 0 ? `${months} months` : `${Math.max(0, daysToDeadline)} days`}.`;
  }
  if (d.type === OBLIGATION_TYPES.VAT) {
    return `Chase VAT records from ${d.clientName} — VAT quarter ended this week.`;
  }
  if (d.type === OBLIGATION_TYPES.PAYROLL) {
    return `Run PAYE / payroll for ${d.clientName} — month-end filing rhythm.`;
  }
  if (d.type === OBLIGATION_TYPES.SELF_ASSESSMENT) {
    return `Chase Self Assessment information from ${d.clientName} — filing deadline approaching.`;
  }
  if (d.type === OBLIGATION_TYPES.CONFIRMATION) {
    return `Prepare confirmation statement for ${d.clientName} — statutory deadline approaching.`;
  }
  return `Follow up with ${d.clientName} regarding ${d.type}.`;
}

function tableSection(title: string, color: string, rows: GeneratedDeadline[]): string {
  if (rows.length === 0) {
    return "";
  }
  const body = rows
    .map(
      (r) => `<tr>
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(r.clientName)}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;">${escapeHtml(r.type)}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;">${fmt(r.deadlineDate)}</td>
  <td style="padding:8px;border:1px solid #e2e8f0;">${r.daysUntilDeadline}</td>
</tr>`
    )
    .join("\n");
  return `<h3 style="color:${color};margin-top:24px;">${escapeHtml(title)}</h3>
<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">
<thead><tr style="background:#f8fafc;">
  <th align="left" style="padding:8px;border:1px solid #e2e8f0;">Client</th>
  <th align="left" style="padding:8px;border:1px solid #e2e8f0;">Obligation</th>
  <th align="left" style="padding:8px;border:1px solid #e2e8f0;">Deadline</th>
  <th align="left" style="padding:8px;border:1px solid #e2e8f0;">Days remaining</th>
</tr></thead>
<tbody>${body}</tbody>
</table>`;
}

/** Urgent / this month / upcoming tables for one deadline slice. */
function digestBandTables(deadlines: GeneratedDeadline[], today: Date): string {
  const urgent = deadlines
    .filter((d) => urgentSection(d))
    .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline);
  const month = deadlines.filter((d) => dueThisMonthSection(d, today));
  const upcoming = deadlines.filter(
    (d) => !urgentSection(d) && !dueThisMonthSection(d, today)
  );
  const a = tableSection("Urgent (due within 30 days)", "#dc2626", urgent);
  const b = tableSection("Due this month", "#d97706", month);
  const c = tableSection("Upcoming", "#0d9488", upcoming);
  if (!a && !b && !c) {
    return `<p style="margin:0;color:#64748b;font-size:14px;">No deadlines in this list.</p>`;
  }
  return a + b + c;
}

function actionLinesForDeadlines(
  deadlines: GeneratedDeadline[],
  today: Date
): string[] {
  const windowEnd = addDays(today, 7);
  return deadlines
    .filter((d) => {
      const f = startOfDay(d.flagDate);
      return f >= today && f <= windowEnd;
    })
    .map((d) => actionNoteForDeadline(d, today));
}

export function buildDigestHtml(params: {
  deadlinesWithPayroll: GeneratedDeadline[];
  deadlinesWithoutPayroll: GeneratedDeadline[];
  weekOfMonday: Date;
}): { html: string; actionLines: string[] } {
  const today = startOfDay(params.weekOfMonday);
  const actionLines = [
    ...new Set(actionLinesForDeadlines(params.deadlinesWithPayroll, today)),
  ];

  const html = `<div style="font-family:Inter,system-ui,sans-serif;color:#0f172a;line-height:1.5;">
<p style="margin:0 0 16px;">Good morning — here is your deadline digest for the week starting <strong>${fmt(today)}</strong>.</p>
<h2 style="font-size:17px;font-weight:600;margin:20px 0 8px;color:#0f172a;">Reminders apart from payroll:</h2>
${digestBandTables(params.deadlinesWithoutPayroll, today)}
<h2 style="font-size:17px;font-weight:600;margin:28px 0 8px;color:#0f172a;">All reminders:</h2>
${digestBandTables(params.deadlinesWithPayroll, today)}
<h3 style="margin-top:28px;color:#0f172a;">Action Required</h3>
${
  actionLines.length
    ? `<ul style="padding-left:18px;">${actionLines.map((l) => `<li style="margin-bottom:6px;">${escapeHtml(l)}</li>`).join("")}</ul>`
    : `<p style="margin:0;">No flags falling in the next 7 days.</p>`
}
<p style="margin-top:24px;font-size:12px;color:#64748b;">Figures Reminders — internal deadline manager.</p>
</div>`;

  return { html, actionLines };
}

export function mondayOfWeekContaining(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 Sun - 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  return addDays(d, -diff);
}
