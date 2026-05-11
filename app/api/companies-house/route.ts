import { NextResponse } from "next/server";

import type { ParsedClientFields } from "@/lib/parse-client";
import {
  chRequestJson,
  looksLikeCompanyNumber,
  normalizeCompanyNumber,
  profileToClientFormFields,
  type ChCompanyProfile,
  type ChSearchItem,
} from "@/lib/companies-house";

export const dynamic = "force-dynamic";

interface ChSearchResponse {
  items?: ChSearchItem[];
  total_count?: number;
}

/** Merges Companies House profile fields into the same shape as the client form. */
function toParsedFields(
  p: ReturnType<typeof profileToClientFormFields>
): ParsedClientFields {
  return {
    name: p.name,
    year_end_date: p.year_end_date,
    confirmation_statement_date: p.confirmation_statement_date,
    accounts_filing_due_date: p.accounts_filing_due_date,
    self_assessment_date: "",
    vat_quarter_end_month: "",
    payroll_active: "false",
  };
}

/**
 * GET /api/companies-house?q=...  — search by name, or load profile when q is a company number.
 * GET /api/companies-house?company_number=OC123456 — load profile for that number.
 *
 * Returns JSON:
 * - `{ status: "prefill", fields, company_number }` when a unique profile is resolved.
 * - `{ status: "matches", matches: [...] }` when several name hits (pick one in the UI).
 * - `{ status: "no_results" }` when search is empty.
 */
export async function GET(req: Request) {
  const key = process.env.COMPANIES_HOUSE_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      {
        error:
          "COMPANIES_HOUSE_API_KEY is not set. Add it to .env.local (Companies House developer key).",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const explicit = searchParams.get("company_number")?.trim();
  const qRaw = searchParams.get("q")?.trim() ?? "";

  const numberTarget =
    explicit && explicit.length > 0
      ? normalizeCompanyNumber(explicit)
      : qRaw && looksLikeCompanyNumber(qRaw)
        ? normalizeCompanyNumber(qRaw)
        : null;

  try {
    if (numberTarget) {
      const profile = await chRequestJson<ChCompanyProfile>(
        `/company/${encodeURIComponent(numberTarget)}`,
        key
      );
      const raw = profileToClientFormFields(profile);
      return NextResponse.json({
        status: "prefill",
        fields: toParsedFields(raw),
        company_number: raw.company_number,
      });
    }

    if (!qRaw) {
      return NextResponse.json(
        { error: "Provide q (name or number) or company_number." },
        { status: 400 }
      );
    }

    const search = await chRequestJson<ChSearchResponse>(
      `/search/companies?q=${encodeURIComponent(qRaw)}&items_per_page=12`,
      key
    );
    const items = search.items ?? [];
    if (items.length === 0) {
      return NextResponse.json({ status: "no_results" });
    }
    if (items.length === 1) {
      const only = items[0]!;
      const profile = await chRequestJson<ChCompanyProfile>(
        `/company/${encodeURIComponent(only.company_number)}`,
        key
      );
      const raw = profileToClientFormFields(profile);
      return NextResponse.json({
        status: "prefill",
        fields: toParsedFields(raw),
        company_number: raw.company_number,
      });
    }

    return NextResponse.json({
      status: "matches",
      matches: items.map((i) => ({
        company_number: i.company_number,
        title: i.title,
        company_status: i.company_status,
        company_type: i.company_type,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Companies House request failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
