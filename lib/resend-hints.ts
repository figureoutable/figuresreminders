const DOMAIN_VERIFY_URL = "https://resend.com/domains";

/** Appended when Resend rejects non-owner recipients (sandbox / unverified domain). */
export function resendSandboxHint(): string {
  return [
    "To email people other than your Resend account address:",
    `1) Verify tryfigures.com in Resend → ${DOMAIN_VERIFY_URL}`,
    "2) In Vercel → Project → Environment Variables, set RESEND_FROM_EMAIL to something like:",
    '   Figures Reminders <digest@tryfigures.com>',
    "3) Redeploy, then Send again.",
  ].join("\n");
}

export function looksLikeResendSandboxRecipientError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("only send testing") ||
    m.includes("verify a domain") ||
    m.includes("resend.com/domains")
  );
}
