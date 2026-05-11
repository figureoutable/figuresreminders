import { NextResponse } from "next/server";

import {
  parseDigestRecipients,
  validateRecipientsPayload,
} from "@/lib/digest-recipients";
import { createServiceSupabase } from "@/lib/supabase/admin";

/**
 * GET /api/settings — read singleton row (digest recipient list).
 * PUT /api/settings — upsert `app_settings` id = 1 with `digest_recipients` JSON array.
 */
export async function GET() {
  const supabase = createServiceSupabase();
  const { data, error } = await supabase
    .from("app_settings")
    .select("id, digest_recipients, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const row = data ?? { id: 1, digest_recipients: [] };
  const digest_recipients = parseDigestRecipients(
    (row as { digest_recipients?: unknown }).digest_recipients
  );
  return NextResponse.json({
    settings: { ...row, digest_recipients },
  });
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { digest_recipients?: unknown };
    const parsed = validateRecipientsPayload(body.digest_recipients ?? []);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const supabase = createServiceSupabase();
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(
        {
          id: 1,
          digest_recipients: parsed.recipients,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      )
      .select("id, digest_recipients, updated_at")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const digest_recipients = parseDigestRecipients(
      (data as { digest_recipients?: unknown }).digest_recipients
    );
    return NextResponse.json({ settings: { ...data, digest_recipients } });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
}
