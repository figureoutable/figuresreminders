"use client";

import { useEffect, useState } from "react";
import { Mail, Trash2 } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DigestRecipient } from "@/lib/digest-recipients";
import { isValidEmail } from "@/lib/digest-recipients";

/** Digest recipient list (backed by `/api/settings` + `app_settings.digest_recipients`). */
export default function SettingsView() {
  const [recipients, setRecipients] = useState<DigestRecipient[]>([]);
  const [draftEmail, setDraftEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [sendingNow, setSendingNow] = useState(false);
  const emailBusy = sendingNow || testing;
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [addHint, setAddHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          settings?: { digest_recipients?: DigestRecipient[] };
        };
        if (!cancelled) {
          if (!res.ok) {
            setFetchError(
              typeof j.error === "string"
                ? j.error
                : "Could not load settings. You can still try adding emails and saving."
            );
            setRecipients([]);
          } else {
            setFetchError(null);
            setRecipients(j.settings?.digest_recipients ?? []);
          }
        }
      } catch {
        if (!cancelled) {
          setFetchError(
            "Network error loading settings. Check your connection; you can still add emails and save."
          );
          setRecipients([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addRecipient() {
    setAddHint(null);
    const email = draftEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      setAddHint(
        "That doesn’t look like a valid email (need something like name@company.com)."
      );
      return;
    }
    if (recipients.some((r) => r.email.toLowerCase() === email)) {
      setAddHint("That address is already on the list.");
      return;
    }
    if (recipients.length >= 30) {
      setAddHint("You can add at most 30 recipients.");
      return;
    }
    setRecipients((prev) => [...prev, { name: "", email }]);
    setDraftEmail("");
  }

  function removeRecipient(index: number) {
    setRecipients((prev) => prev.filter((_, i) => i !== index));
  }

  function recipientsPayload(): DigestRecipient[] {
    return recipients.map((r) => ({ name: "", email: r.email }));
  }

  async function saveRecipients() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest_recipients: recipientsPayload() }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        settings?: { digest_recipients?: DigestRecipient[] };
      };
      if (!res.ok) {
        alert(j.error ?? "Could not save settings.");
        return;
      }
      if (j.settings?.digest_recipients) {
        setRecipients(j.settings.digest_recipients);
      }
      alert("Saved digest recipients.");
    } finally {
      setSaving(false);
    }
  }

  /** Uses last saved recipient list from the database (same as Monday cron). */
  async function sendDigestNow() {
    setSendingNow(true);
    try {
      const res = await fetch("/api/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? "Could not send digest.");
        return;
      }
      alert("Digest email sent to your saved recipients.");
    } finally {
      setSendingNow(false);
    }
  }

  async function sendTest() {
    if (recipients.length === 0) {
      alert("Add at least one recipient first.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/send-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test: true,
          digest_recipients: recipientsPayload(),
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(j.error ?? "Test send failed.");
        return;
      }
      alert("Test digest sent to everyone in the list above (unsaved changes included).");
    } finally {
      setTesting(false);
    }
  }

  const canSendTest = recipients.length > 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A]">
      <AppNav />
      <main className="mx-auto max-w-2xl space-y-10 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
          <p className="mt-1 text-slate-600 text-sm">
            Choose who receives the automated Monday 07:00 UTC digest (via Resend).
          </p>
        </div>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-lg">Email settings</h2>

          {fetchError ? (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 text-sm"
              role="status"
            >
              {fetchError}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>People on the digest</Label>
            {loading ? (
              <p className="text-slate-500 text-sm">Loading…</p>
            ) : recipients.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-slate-500 text-sm">
                No recipients yet. Add an email below, then save.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {recipients.map((r, index) => (
                  <li
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                    key={`${r.email}-${index}`}
                  >
                    <p className="min-w-0 truncate font-medium text-sm">{r.email}</p>
                    <Button
                      aria-label={`Remove ${r.email}`}
                      className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={saving}
                      onClick={() => removeRecipient(index)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 font-medium text-slate-700 text-sm">Add email</p>
            <div className="space-y-1.5">
              <Label className="text-xs" htmlFor="draft-email">
                Email address
              </Label>
              <Input
                className="max-w-md bg-white"
                disabled={loading}
                id="draft-email"
                onChange={(e) => {
                  setDraftEmail(e.target.value);
                  setAddHint(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
                placeholder="finance@example.com"
                type="email"
                value={draftEmail}
              />
            </div>
            {addHint ? (
              <p className="mt-2 text-amber-800 text-sm" role="status">
                {addHint}
              </p>
            ) : null}
            <Button
              className="mt-3"
              disabled={loading}
              onClick={addRecipient}
              type="button"
              variant="secondary"
            >
              Add to list
            </Button>
          </div>

          <p className="text-slate-500 text-xs">
            Everyone listed here gets the same digest. Save after changing the list.{" "}
            <strong>Send digest now</strong> emails everyone last saved in the database.{" "}
            <strong>Send test (draft)</strong> uses the list above even if you have not saved yet.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button disabled={saving || loading} onClick={saveRecipients} type="button">
              Save recipients
            </Button>
            <Button
              className="inline-flex items-center bg-[#0D9488] text-white hover:bg-[#0f766e]"
              disabled={loading || emailBusy}
              onClick={() => void sendDigestNow()}
              type="button"
            >
              <Mail aria-hidden className="mr-2 size-4" />
              {sendingNow ? "Sending…" : "Send digest now"}
            </Button>
            <Button
              disabled={loading || emailBusy || !canSendTest}
              onClick={sendTest}
              type="button"
              variant="outline"
            >
              {testing ? "Sending…" : "Send test (draft)"}
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
