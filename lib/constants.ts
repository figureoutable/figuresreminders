/**
 * Canonical obligation labels used across parsing, the dashboard, Supabase
 * acknowledgements, and the Monday digest. Changing a string here updates
 * the whole app consistently (including acknowledgement matching).
 */
export const OBLIGATION_TYPES = {
  CONFIRMATION: "Confirmation Statement",
  /** Companies House statutory accounts (from `accounts_filing_due_date`) */
  ACCOUNTS_FILING: "Statutory accounts filing",
  /** CT600 filing — 12 months after year end */
  CORP_TAX_FILING: "Corporation Tax (CT600 filing)",
  /** Corporation tax payment — 9 months + 1 day after year end */
  CORP_TAX_PAYMENT: "Corporation Tax (payment)",
  SELF_ASSESSMENT: "Self Assessment",
  PAYROLL: "Payroll",
  VAT: "VAT Return",
} as const;

export type ObligationType =
  (typeof OBLIGATION_TYPES)[keyof typeof OBLIGATION_TYPES];

/** Dashboard / digest filter ids (Corp Tax covers both CT rows). */
export const FILTER_IDS = [
  "all",
  "all_no_payroll",
  "confirmation",
  "statutory_accounts",
  "corp_tax",
  "self_assessment",
  "payroll",
  "vat",
] as const;

export type FilterId = (typeof FILTER_IDS)[number];

/** Human-readable filter labels for toolbar buttons. */
export const FILTER_LABELS: Record<Exclude<FilterId, "all">, string> = {
  all_no_payroll: "All (no payroll)",
  confirmation: "Confirmation Statement",
  statutory_accounts: "Accounts filing",
  corp_tax: "Corp Tax",
  self_assessment: "Self Assessment",
  payroll: "Payroll",
  vat: "VAT",
};

/** Returns true if a generated row matches the selected obligation filter. */
export function deadlineMatchesFilter(
  obligationType: string,
  filter: FilterId
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "all_no_payroll") {
    return obligationType !== OBLIGATION_TYPES.PAYROLL;
  }
  if (filter === "confirmation") {
    return obligationType === OBLIGATION_TYPES.CONFIRMATION;
  }
  if (filter === "statutory_accounts") {
    return obligationType === OBLIGATION_TYPES.ACCOUNTS_FILING;
  }
  if (filter === "corp_tax") {
    return (
      obligationType === OBLIGATION_TYPES.CORP_TAX_FILING ||
      obligationType === OBLIGATION_TYPES.CORP_TAX_PAYMENT
    );
  }
  if (filter === "self_assessment") {
    return obligationType === OBLIGATION_TYPES.SELF_ASSESSMENT;
  }
  if (filter === "payroll") {
    return obligationType === OBLIGATION_TYPES.PAYROLL;
  }
  if (filter === "vat") {
    return obligationType === OBLIGATION_TYPES.VAT;
  }
  return true;
}
