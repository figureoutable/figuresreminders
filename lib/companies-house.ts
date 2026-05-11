/**
 * Companies House Public Data API helpers (server-side only).
 * Auth: HTTP Basic with API key as username and an empty password.
 * @see https://developer.company-information.service.gov.uk/
 */
import { format, lastDayOfMonth, startOfDay } from "date-fns";

import { isIsoDate } from "@/lib/parse-client";

export const CH_API_BASE = "https://api.company-information.service.gov.uk";

/**
 * JSON GET to Companies House (throws on non-2xx with a short message body).
 */
export async function chRequestJson<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${CH_API_BASE}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: companiesHouseAuthHeader(apiKey),
    },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Companies House HTTP ${res.status}: ${text.slice(0, 240)}`
    );
  }
  return JSON.parse(text) as T;
}

/** Minimal company profile JSON we read from GET /company/{number}. */
export interface ChCompanyProfile {
  company_name?: string;
  company_number?: string;
  confirmation_statement?: {
    next_due?: string;
    next_made_up_to?: string;
  };
  accounts?: {
    next_accounts?: {
      due_on?: string;
      period_end_on?: string;
      period_start_on?: string;
    };
    accounting_reference_date?: {
      day?: string;
      month?: string;
    };
  };
}

export interface ChSearchItem {
  company_number: string;
  title: string;
  company_status?: string;
  company_type?: string;
}

/** Builds Basic Authorization header for Companies House REST calls. */
export function companiesHouseAuthHeader(apiKey: string): string {
  const token = Buffer.from(`${apiKey}:`).toString("base64");
  return `Basic ${token}`;
}

/** True when the query looks like a UK company registration number. */
export function looksLikeCompanyNumber(raw: string): boolean {
  const s = raw.trim().replace(/\s+/g, "").toUpperCase();
  return /^(\d{8}|[A-Z]{2}\d{6})$/.test(s);
}

export function normalizeCompanyNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, "").toUpperCase();
}

/**
 * Next calendar occurrence of the accounting reference day/month (fallback when
 * next_accounts.period_end_on is absent).
 */
export function nextAccountingReferenceDate(
  dayStr: string | undefined,
  monthStr: string | undefined,
  from: Date = new Date()
): string | null {
  if (!dayStr || !monthStr) {
    return null;
  }
  const day = Number(dayStr);
  const month = Number(monthStr);
  if (Number.isNaN(day) || Number.isNaN(month) || month < 1 || month > 12) {
    return null;
  }
  const fromDay = startOfDay(from);
  let y = fromDay.getFullYear();
  const cap = lastDayOfMonth(new Date(y, month - 1, 1)).getDate();
  const safeDay = Math.min(day, cap);
  let candidate = new Date(y, month - 1, safeDay);
  if (startOfDay(candidate) < fromDay) {
    y += 1;
    const cap2 = lastDayOfMonth(new Date(y, month - 1, 1)).getDate();
    candidate = new Date(y, month - 1, Math.min(day, cap2));
  }
  return format(startOfDay(candidate), "yyyy-MM-dd");
}

/** Maps a company profile into our client form strings (yyyy-MM-dd). */
export function profileToClientFormFields(profile: ChCompanyProfile): {
  name: string;
  year_end_date: string;
  confirmation_statement_date: string;
  accounts_filing_due_date: string;
  company_number: string;
} {
  const name = profile.company_name?.trim() ?? "";
  const companyNumber = profile.company_number?.trim() ?? "";

  const periodEnd = profile.accounts?.next_accounts?.period_end_on?.trim();
  const ard = profile.accounts?.accounting_reference_date;
  const yearEnd =
    periodEnd && isIsoDate(periodEnd)
      ? periodEnd
      : nextAccountingReferenceDate(ard?.day, ard?.month) ?? "";

  const csDue = profile.confirmation_statement?.next_due?.trim() ?? "";
  const accountsDue = profile.accounts?.next_accounts?.due_on?.trim() ?? "";

  return {
    name,
    company_number: companyNumber,
    year_end_date: yearEnd,
    confirmation_statement_date: csDue,
    accounts_filing_due_date: accountsDue,
  };
}
