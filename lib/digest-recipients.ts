/**
 * Normalises and validates digest recipient rows stored in `app_settings.digest_recipients`.
 */

export interface DigestRecipient {
  name: string;
  email: string;
}

const MAX_RECIPIENTS = 30;
const MAX_NAME_LEN = 120;
const MAX_EMAIL_LEN = 254;

const SIMPLE_EMAIL =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(raw: string): boolean {
  const e = trimStr(raw, MAX_EMAIL_LEN).toLowerCase();
  return Boolean(e && SIMPLE_EMAIL.test(e));
}

function trimStr(v: unknown, max: number): string {
  if (typeof v !== "string") {
    return "";
  }
  return v.trim().slice(0, max);
}

/** Parses JSONB / API payload into a clean list (drops invalid / empty emails). */
export function parseDigestRecipients(raw: unknown): DigestRecipient[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: DigestRecipient[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      continue;
    }
    const email = trimStr(
      (row as { email?: unknown }).email,
      MAX_EMAIL_LEN
    ).toLowerCase();
    if (!email || !SIMPLE_EMAIL.test(email)) {
      continue;
    }
    const name = trimStr((row as { name?: unknown }).name, MAX_NAME_LEN);
    out.push({ name, email });
  }
  return dedupeByEmail(out);
}

function dedupeByEmail(list: DigestRecipient[]): DigestRecipient[] {
  const seen = new Set<string>();
  const out: DigestRecipient[] = [];
  for (const r of list) {
    if (seen.has(r.email)) {
      continue;
    }
    seen.add(r.email);
    out.push(r);
  }
  return out;
}

export function emailsForSend(list: DigestRecipient[]): string[] {
  return list.map((r) => r.email);
}

export function validateRecipientsPayload(
  raw: unknown
): { ok: true; recipients: DigestRecipient[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "digest_recipients must be an array." };
  }
  if (raw.length > MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `At most ${MAX_RECIPIENTS} recipients allowed.`,
    };
  }
  const recipients: DigestRecipient[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      return { ok: false, error: "Each recipient must be an object with email (and optional name)." };
    }
    const email = trimStr(
      (row as { email?: unknown }).email,
      MAX_EMAIL_LEN
    ).toLowerCase();
    const name = trimStr((row as { name?: unknown }).name, MAX_NAME_LEN);
    if (!email) {
      return { ok: false, error: "Every recipient needs an email address." };
    }
    if (!SIMPLE_EMAIL.test(email)) {
      return { ok: false, error: `Invalid email: ${email}` };
    }
    recipients.push({ name, email });
  }
  return { ok: true, recipients: dedupeByEmail(recipients) };
}
