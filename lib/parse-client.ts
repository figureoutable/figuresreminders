/**
 * Regex / keyword parser for the "Smart Input" box — no external AI.
 * Extracts structured client fields from free-text descriptions.
 */
import { format, parseISO, isValid } from "date-fns";

export interface ParsedClientFields {
  name: string;
  year_end_date: string;
  confirmation_statement_date: string;
  /** Statutory accounts filing due (e.g. Companies House `next_accounts.due_on`). */
  accounts_filing_due_date: string;
  self_assessment_date: string;
  vat_quarter_end_month: string;
  payroll_active: string;
}

/** Which parsed fields were auto-detected vs left blank (amber highlight). */
export interface ParseMeta {
  nameParsed: boolean;
  yearEndParsed: boolean;
  confirmationParsed: boolean;
  accountsFilingParsed: boolean;
  selfAssessmentParsed: boolean;
  vatParsed: boolean;
  payrollParsed: boolean;
}

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Single VAT “anchor” month (1–12) from user input: plain number, month name,
 * or phrases like "31 March" (first month token wins).
 */
export function parseVatAnchorMonthFromUserInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    if (n >= 1 && n <= 12) {
      return n;
    }
    return null;
  }
  const tokens = t
    .toLowerCase()
    .split(/[^a-z]+/i)
    .filter(Boolean);
  for (const tok of tokens) {
    const m = MONTHS[norm(tok)];
    if (m) {
      return m;
    }
  }
  const stripped = norm(t.replace(/^\d+\s+/, "").replace(/\s+\d+$/, ""));
  const m2 = MONTHS[stripped];
  return m2 ?? null;
}

/** Parses "31 March", "31/3", "31-03", "March 31" into yyyy-MM-dd (year inferred). */
function parseFlexibleDate(
  raw: string,
  defaultYear: number
): string | null {
  const t = raw.trim();
  const mdy = t.match(
    /^(\d{1,2})[\s/\-](\d{1,2})(?:[\s/\-](\d{2,4}))?$/i
  );
  if (mdy) {
    const d = Number(mdy[1]);
    const mo = Number(mdy[2]);
    let y = defaultYear;
    if (mdy[3]) {
      y = Number(mdy[3]);
      if (y < 100) {
        y += 2000;
      }
    }
    const dt = new Date(y, mo - 1, d);
    return isValid(dt) ? format(dt, "yyyy-MM-dd") : null;
  }
  const mname = t.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/i
  );
  if (mname) {
    const d = Number(mname[1]);
    const mon = MONTHS[norm(mname[2])];
    if (!mon) {
      return null;
    }
    const y = mname[3] ? Number(mname[3]) : defaultYear;
    const dt = new Date(y, mon - 1, d);
    return isValid(dt) ? format(dt, "yyyy-MM-dd") : null;
  }
  const nameFirst = t.match(
    /^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/i
  );
  if (nameFirst) {
    const mon = MONTHS[norm(nameFirst[1])];
    if (!mon) {
      return null;
    }
    const d = Number(nameFirst[2]);
    const y = nameFirst[3] ? Number(nameFirst[3]) : defaultYear;
    const dt = new Date(y, mon - 1, d);
    return isValid(dt) ? format(dt, "yyyy-MM-dd") : null;
  }
  return null;
}

function inferYear(text: string, fallback: number): number {
  const m = text.match(/\b(20\d{2})\b/);
  if (m) {
    return Number(m[1]);
  }
  return fallback;
}

/**
 * Primary entry: reads natural language and returns editable string fields +
 * metadata about which cells need manual completion.
 */
export function parseClientDescription(input: string): {
  fields: ParsedClientFields;
  meta: ParseMeta;
} {
  const now = new Date();
  const defaultYear = now.getFullYear();
  const text = input.replace(/\s+/g, " ").trim();
  const lower = norm(text);

  let name = "";
  let nameParsed = false;
  const ltd =
    text.match(
      /^(.+?)\s+(?:has|with|—|-|–)\s+/i
    ) ||
    text.match(
      /^(.+?)\s+(?:limited|ltd|plc)\b/i
    ) ||
    text.match(/^(.+?)(?:\s+has\s+)/i);
  if (ltd) {
    name = ltd[1].replace(/\s+$/g, "").trim();
    nameParsed = name.length > 0;
  } else {
    const first = text.split(/[.,]/)[0]?.trim() ?? "";
    if (first && first.length < 80) {
      name = first;
      nameParsed = true;
    }
  }

  let yearEnd = "";
  let yearEndParsed = false;
  const yePatterns = [
    /year\s*end\s*(?:of|is|:)?\s*([\d]{1,2}[\/\-\s][\d]{1,2}(?:[\/\-\s]\d{2,4})?|[\d]{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{4})?)/i,
    /y\/?e\s*([\d]{1,2}[\/\-\s][\d]{1,2}(?:[\/\-\s]\d{2,4})?)/i,
    /accounting\s*year\s*end\s*(?:of|is)?\s*([\d]{1,2}[\s\/\-][a-z]+(?:\s+\d{4})?)/i,
  ];
  for (const re of yePatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const y = parseFlexibleDate(m[1], inferYear(text, defaultYear));
      if (y) {
        yearEnd = y;
        yearEndParsed = true;
        break;
      }
    }
  }

  let confirmation = "";
  let confirmationParsed = false;
  const cs = text.match(
    /confirmation\s+statement(?:\s+due)?\s*([\d]{1,2}[\s\/\-][a-z]+(?:\s+\d{4})?|[\d]{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{4})?)/i
  );
  if (cs?.[1]) {
    const y = parseFlexibleDate(cs[1], inferYear(text, defaultYear));
    if (y) {
      confirmation = y;
      confirmationParsed = true;
    }
  }

  let selfAssessment = "";
  let selfAssessmentParsed = false;
  const sa = text.match(
    /self[-\s]?assessment(?:\s+for\s+director)?(?:\s+due)?(?:\s+by)?\s*([\d]{1,2}[\s\/\-][a-z]+(?:\s+\d{4})?|[\d]{1,2}(?:st|nd|rd|th)?\s+[a-z]+(?:\s+\d{4})?)/i
  );
  if (sa?.[1]) {
    const y = parseFlexibleDate(sa[1], inferYear(text, defaultYear));
    if (y) {
      selfAssessment = y;
      selfAssessmentParsed = true;
    }
  }

  let vatMonth = "";
  let vatParsed = false;
  const vat = text.match(
    /vat(?:\s+returns?)?(?:\s+quarter)?(?:\s+ends?)?\s*(?:in\s*)?([a-z]+)(?:\s+month)?/i
  );
  if (vat?.[1]) {
    const mon = MONTHS[norm(vat[1])];
    if (mon) {
      vatMonth = String(mon);
      vatParsed = true;
    }
  }

  let payroll = "false";
  let payrollParsed = false;
  if (
    /payroll/i.test(text) &&
    /\b(monthly|weekly|active|running|yes)\b/i.test(lower)
  ) {
    payroll = "true";
    payrollParsed = true;
  } else if (/\bpayroll\b/i.test(text) && !/\bno\s+payroll\b/i.test(lower)) {
    payroll = "true";
    payrollParsed = true;
  }

  return {
    fields: {
      name: name,
      year_end_date: yearEnd,
      confirmation_statement_date: confirmation,
      accounts_filing_due_date: "",
      self_assessment_date: selfAssessment,
      vat_quarter_end_month: vatMonth,
      payroll_active: payroll,
    },
    meta: {
      nameParsed: nameParsed,
      yearEndParsed: yearEndParsed,
      confirmationParsed: confirmationParsed,
      accountsFilingParsed: false,
      selfAssessmentParsed: selfAssessmentParsed,
      vatParsed: vatParsed,
      payrollParsed: payrollParsed,
    },
  };
}

/** Converts form strings to types suitable for Supabase insert/update. */
export function clientPayloadFromFields(fields: ParsedClientFields): {
  name: string;
  year_end_date: string | null;
  confirmation_statement_date: string | null;
  accounts_filing_due_date: string | null;
  self_assessment_date: string | null;
  vat_quarter_end_month: number | null;
  payroll_active: boolean;
} {
  const vatMonth = parseVatAnchorMonthFromUserInput(fields.vat_quarter_end_month);
  return {
    name: fields.name.trim(),
    year_end_date: fields.year_end_date.trim() || null,
    confirmation_statement_date:
      fields.confirmation_statement_date.trim() || null,
    accounts_filing_due_date:
      fields.accounts_filing_due_date.trim() || null,
    self_assessment_date: fields.self_assessment_date.trim() || null,
    vat_quarter_end_month: vatMonth,
    payroll_active: fields.payroll_active === "true",
  };
}

/** Validates ISO date strings before persistence. */
export function isIsoDate(s: string | null | undefined): boolean {
  if (!s) {
    return false;
  }
  return isValid(parseISO(s));
}
