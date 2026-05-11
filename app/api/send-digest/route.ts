import { format } from "date-fns";
import { enGB } from "date-fns/locale";
import { NextResponse } from "next/server";
import { Resend } from "resend";

import { buildDigestHtml, mondayOfWeekContaining } from "@/lib/digest-email";
import {
  emailsForSend,
  parseDigestRecipients,
  validateRecipientsPayload,
} from "@/lib/digest-recipients";
import { generateDeadlines } from "@/lib/deadlines";
import type { ClientRow } from "@/lib/deadlines";
import { createServiceSupabase } from "@/lib/supabase/admin";

/**
 * Shared digest pipeline used by the Vercel cron (GET) and the Settings
 * "Send test email" button (POST).
 */
async function runDigest(params: {
  mode: "cron" | "test";
  /** When set (e.g. test send from Settings), these addresses are used instead of DB. */
  overrideEmails?: string[] | null;
  request: Request;
}) {
  const cronSecret = process.env.CRON_SECRET;
  if (params.mode === "cron" && cronSecret) {
    const auth = params.request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 }
    );
  }

  const supabase = createServiceSupabase();
  const [{ data: clients, error: cErr }, { data: acks, error: aErr }, settingsRes] =
    await Promise.all([
      supabase.from("clients").select("*"),
      supabase.from("deadline_acknowledgements").select("*"),
      supabase.from("app_settings").select("digest_recipients").eq("id", 1).maybeSingle(),
    ]);

  if (cErr || aErr) {
    return NextResponse.json(
      { error: cErr?.message ?? aErr?.message },
      { status: 500 }
    );
  }

  const fromDb = emailsForSend(
    parseDigestRecipients(
      (settingsRes.data as { digest_recipients?: unknown } | null)
        ?.digest_recipients
    )
  );
  const override = params.overrideEmails?.filter(Boolean) ?? [];
  const recipients = override.length > 0 ? override : fromDb;
  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "Add at least one digest recipient in Settings." },
      { status: 400 }
    );
  }

  const today = new Date();
  const monday = mondayOfWeekContaining(today);
  const generated = generateDeadlines((clients ?? []) as ClientRow[], today);

  const ackSet = new Set(
    (acks ?? []).map(
      (a: { client_id: string; obligation_type: string; deadline_date: string }) =>
        `${a.client_id}|${a.obligation_type}|${a.deadline_date}`
    )
  );

  const filtered = generated
    .filter((d) => {
      const key = `${d.clientId}|${d.type}|${format(d.deadlineDate, "yyyy-MM-dd")}`;
      return !ackSet.has(key);
    })
    .filter((d) => d.daysUntilFlag >= 0)
    .sort((a, b) => a.deadlineDate.getTime() - b.deadlineDate.getTime());

  const subject = `Accounting Deadlines - Week of ${format(monday, "dd MMM yyyy", { locale: enGB })}`;

  let htmlBody: string;
  if (filtered.length === 0) {
    htmlBody = `<div style="font-family:Inter,system-ui,sans-serif;color:#0f172a;">
<p>All current deadlines are up to date. No action required this week.</p>
</div>`;
  } else {
    const { html } = buildDigestHtml({ deadlines: filtered, weekOfMonday: monday });
    htmlBody = html;
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Figures Reminders <onboarding@resend.dev>";

  const { error: sendErr } = await resend.emails.send({
    from,
    to: recipients.length === 1 ? recipients[0]! : recipients,
    subject,
    html: htmlBody,
  });

  if (sendErr) {
    return NextResponse.json({ error: sendErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: filtered.length });
}

/**
 * GET — Vercel Cron hits this route every Monday 07:00 UTC.
 * POST — manual test send (`{ "test": true, "digest_recipients"?: {name,email}[] }`).
 * Uses request body when provided; otherwise saved settings.
 */
export async function GET(request: Request) {
  return runDigest({ mode: "cron", request });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      test?: boolean;
      digest_recipients?: unknown;
    };
    if (!body.test) {
      return NextResponse.json(
        { error: "POST requires `{ \"test\": true }` for manual sends." },
        { status: 400 }
      );
    }
    let overrideEmails: string[] | undefined;
    if (body.digest_recipients !== undefined) {
      const parsed = validateRecipientsPayload(body.digest_recipients);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      overrideEmails = emailsForSend(parsed.recipients);
      if (overrideEmails.length === 0) {
        return NextResponse.json(
          { error: "Add at least one recipient with a valid email." },
          { status: 400 }
        );
      }
    }
    return runDigest({
      mode: "test",
      overrideEmails,
      request,
    });
  } catch {
    return NextResponse.json({ error: "Unable to read JSON body." }, { status: 400 });
  }
}
