"use client";

import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Catches unexpected errors in the App Router tree so the user sees a recovery path
 * instead of a blank generic failure screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFAFA] px-4 text-center text-[#0F172A]">
      <div className="max-w-md space-y-2">
        <h1 className="font-semibold text-xl">Something went wrong</h1>
        <p className="text-slate-600 text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => reset()} type="button">
          Try again
        </Button>
        <Link
          className={cn(buttonVariants({ variant: "outline" }))}
          href="/"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
