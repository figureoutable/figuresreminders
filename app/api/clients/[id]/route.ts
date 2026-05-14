import { NextResponse } from "next/server";

import { friendlyClientsTableError } from "@/lib/supabase-errors";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { clientPayloadFromFields, isIsoDate } from "@/lib/parse-client";
import type { ParsedClientFields } from "@/lib/parse-client";

type Ctx = { params: Promise<{ id: string }> };

/**
 * PUT /api/clients/:id — update an existing client row.
 * DELETE /api/clients/:id — remove a client (cascades acknowledgements).
 */
export async function PUT(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
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
      .update(payload)
      .eq("id", id)
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

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = createServiceSupabase();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
