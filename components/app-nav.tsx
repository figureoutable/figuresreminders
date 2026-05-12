"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Mail, Settings } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sticky top navigation used across internal pages (Figures Reminders branding).
 */
export function AppNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const [sendingDigest, setSendingDigest] = useState(false);

  async function sendDigestNow() {
    setSendingDigest(true);
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
      setSendingDigest(false);
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-slate-200/80 bg-[#FAFAFA]/90 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link href="/" className="truncate font-semibold text-[#0F172A] text-lg">
            Figures Reminders
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Link
            aria-current={pathname === "/" ? "page" : undefined}
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[#0D9488] text-white hover:bg-[#0f766e]"
            )}
            href="/"
          >
            Home
          </Link>
          <Button
            className="inline-flex items-center bg-[#0D9488] text-white hover:bg-[#0f766e]"
            disabled={sendingDigest}
            onClick={() => void sendDigestNow()}
            size="sm"
            type="button"
          >
            <Mail aria-hidden className="mr-2 size-4" />
            {sendingDigest ? "Sending…" : "Send digest now"}
          </Button>
          <Link
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-[#0D9488] text-white hover:bg-[#0f766e]"
            )}
            href="/clients"
          >
            Add Client
          </Link>
          <Link
            aria-label="Settings"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "text-[#0F172A]"
            )}
            href="/settings"
          >
            <Settings className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
