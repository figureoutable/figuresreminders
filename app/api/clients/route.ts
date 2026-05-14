import { NextResponse } from "next/server";

import { friendlyClientsTableError } from "@/lib/supabase-errors";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { clientPayloadFromFields, isIsoDate } from "@/lib/parse-client";
import type { ParsedClientFields } from "@/lib/parse-client";

/**
 * GET /api/clients — list all clients (internal tool; no auth layer).
 * POST /api/clients — create a client from validated form fields.
 */
export async function GET() {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json(
      { error: friendlyClientsTableError(error.message) },
      { status: 500 }
    );
  }
  return NextResponse.json({ clients: data });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { fields?: ParsedClientFields };
    const fields = body.fields;
    if (!fields?.name?.trim()) {
      return NextResponse.json(
        { error: "Client name is required." },
        { status: 400 }
      );
    }
    const payload = clientPayloadFromFields(fields);
    for (const key of [
      "year_end_date",
      "confirmation_statement_date",
      "accounts_filing_due_date",
      "self_assessment_date",
    ] as const) {
      const v = payload[key];
      if (v && !isIsoDate(v)) {
        return NextResponse.json(
          { error: `Invalid date for ${key}.` },
          { status: 400 }
        );
      }
    }
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("clients")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json(
        { error: friendlyClientsTableError(error.message) },
        { status: 500 }
      );
    }
    return NextResponse.json({ client: data });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}
