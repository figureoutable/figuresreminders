/**
 * Turns cryptic PostgREST messages into actionable text for the internal UI.
 */
export function friendlyClientsTableError(message: string): string {
  if (
    /owner/i.test(message) &&
    (/schema cache/i.test(message) || /column/i.test(message))
  ) {
    return [
      'The Supabase database does not have an "owner" column on clients yet.',
      "Fix: Supabase dashboard → SQL Editor → run:",
      "",
      "  ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS owner TEXT;",
      "",
      "Then save the client again (schema cache usually updates within a few seconds).",
      `(Technical detail: ${message})`,
    ].join("\n");
  }
  return message;
}
