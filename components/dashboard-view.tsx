"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { AlertTriangle, CalendarClock, CalendarDays, Pencil, Trash2 } from "lucide-react";

import SpotlightCards, {
  type SpotlightItem,
} from "@/components/kokonutui/spotlight-cards";
import { AppNav } from "@/components/app-nav";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FILTER_IDS,
  FILTER_LABELS,
  type FilterId,
  deadlineMatchesFilter,
} from "@/lib/constants";
import type { DashboardRowDTO } from "@/lib/dashboard-serialize";
import { urgencyFromDays, type UrgencyBadge } from "@/lib/deadlines";
import { cn } from "@/lib/utils";

function badgeVariant(u: UrgencyBadge): string {
  if (u === "red") {
    return "bg-red-100 text-red-800 border-red-200";
  }
  if (u === "amber") {
    return "bg-amber-100 text-amber-900 border-amber-200";
  }
  return "bg-emerald-100 text-emerald-900 border-emerald-200";
}

/**
 * Interactive dashboard: filters, acknowledgements (popover), and row actions.
 */
export default function DashboardView({
  initialRows,
  stats,
  loadError,
}: {
  initialRows: DashboardRowDTO[];
  stats: { overdue: number; dueThisMonth: number; upcoming: number };
  /** When set, dashboard still renders but data failed to load (config / DB). */
  loadError?: string | null;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [initials, setInitials] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const ackPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pendingKey) {
      return;
    }
    const onPointerDown = (e: PointerEvent) => {
      const el = ackPanelRef.current;
      if (el && !el.contains(e.target as Node)) {
        setPendingKey(null);
        setInitials("");
      }
    };
    const id = window.requestAnimationFrame(() => {
      document.addEventListener("pointerdown", onPointerDown);
    });
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [pendingKey]);

  const spotlightItems: SpotlightItem[] = useMemo(
    () => [
      {
        icon: AlertTriangle,
        title: String(stats.overdue),
        description: "Overdue",
        color: "#ef4444",
      },
      {
        icon: CalendarClock,
        title: String(stats.dueThisMonth),
        description: "Due this month",
        color: "#f59e0b",
      },
      {
        icon: CalendarDays,
        title: String(stats.upcoming),
        description: "Upcoming",
        color: "#0d9488",
      },
    ],
    [stats]
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = initialRows.filter((r) => {
      if (!showCompleted && r.acknowledged) {
        return false;
      }
      if (!deadlineMatchesFilter(r.type, filter)) {
        return false;
      }
      if (q && !r.clientName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      if (a.acknowledged !== b.acknowledged) {
        return a.acknowledged ? 1 : -1;
      }
      return a.daysUntilDeadline - b.daysUntilDeadline;
    });
    return rows;
  }, [initialRows, filter, query, showCompleted]);

  async function confirmAck(row: DashboardRowDTO) {
    const by = initials.trim().slice(0, 20);
    if (!by) {
      return;
    }
    const deadlineDate = format(parseISO(row.deadlineDate), "yyyy-MM-dd");
    const res = await fetch("/api/acknowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: row.clientId,
        obligation_type: row.type,
        deadline_date: deadlineDate,
        acknowledged_by: by,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Could not save acknowledgement.");
      return;
    }
    setPendingKey(null);
    setInitials("");
    router.refresh();
  }

  async function deleteClient() {
    if (!deleteTarget) {
      return;
    }
    const res = await fetch(`/api/clients/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Could not delete client.");
      return;
    }
    setDeleteTarget(null);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A]">
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-3 px-4 py-6 sm:px-6">
        {loadError ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm"
            role="alert"
          >
            <p className="font-semibold">Could not load dashboard data</p>
            <p className="mt-1 text-amber-900/90">{loadError}</p>
          </div>
        ) : null}
        <SpotlightCards
          className="bg-[#FAFAFA] px-0 pt-6 pb-2"
          heading="Deadline snapshot (unacknowledged only)"
          items={spotlightItems}
        />

        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTER_IDS.map((id) => (
                <Button
                  key={id}
                  className={
                    filter === id
                      ? "bg-[#0D9488] text-white hover:bg-[#0f766e]"
                      : "bg-slate-100 text-[#0F172A] hover:bg-slate-200"
                  }
                  onClick={() => setFilter(id)}
                  size="sm"
                  type="button"
                  variant={filter === id ? "default" : "secondary"}
                >
                  {id === "all" ? "All" : FILTER_LABELS[id]}
                </Button>
              ))}
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <Input
                aria-label="Search clients"
                className="bg-white sm:w-64"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search client name…"
                value={query}
              />
              <div className="flex items-center gap-2">
                <Switch
                  checked={showCompleted}
                  id="show-completed"
                  onCheckedChange={(v) => setShowCompleted(Boolean(v))}
                />
                <Label className="text-sm" htmlFor="show-completed">
                  Show completed
                </Label>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-10">Done</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-10 text-center text-slate-500" colSpan={7}>
                      No deadlines match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const u = urgencyFromDays(row.daysUntilDeadline);
                    const ack = row.acknowledged;
                    const open = pendingKey === row.key;
                    return (
                      <TableRow
                        className={
                          ack ? "opacity-50 line-through decoration-slate-400" : ""
                        }
                        key={row.key}
                      >
                        <TableCell className="align-top">
                          <div
                            className="relative inline-block"
                            ref={open ? ackPanelRef : undefined}
                          >
                            <Checkbox
                              checked={ack || open}
                              disabled={ack}
                              onCheckedChange={(v) => {
                                if (ack) {
                                  return;
                                }
                                if (v) {
                                  setPendingKey(row.key);
                                  setInitials("");
                                } else {
                                  setPendingKey(null);
                                }
                              }}
                            />
                          {open ? (
                            <div
                              className="absolute left-0 z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                            >
                              <div className="space-y-3">
                                <p className="font-medium text-[#0F172A] text-sm">
                                  Confirm completion
                                </p>
                                <div className="space-y-1.5">
                                  <Label className="text-xs" htmlFor={`who-${row.key}`}>
                                    Your initials or name
                                  </Label>
                                  <Input
                                    id={`who-${row.key}`}
                                    maxLength={20}
                                    onChange={(e) => setInitials(e.target.value)}
                                    value={initials}
                                  />
                                </div>
                                <div className="flex items-center gap-3">
                                  <Button
                                    className="bg-[#0D9488] text-white hover:bg-[#0f766e]"
                                    onClick={() => confirmAck(row)}
                                    size="sm"
                                    type="button"
                                  >
                                    Confirm
                                  </Button>
                                  <button
                                    className="text-slate-600 text-sm underline"
                                    onClick={() => {
                                      setPendingKey(null);
                                      setInitials("");
                                    }}
                                    type="button"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{row.clientName}</TableCell>
                        <TableCell>{row.type}</TableCell>
                        <TableCell>
                          {format(parseISO(row.deadlineDate), "dd MMM yyyy", {
                            locale: enGB,
                          })}
                        </TableCell>
                        <TableCell>{row.daysUntilDeadline}</TableCell>
                        <TableCell>
                          <Badge className={badgeVariant(u)} variant="outline">
                            {u === "red"
                              ? "0–14 days"
                              : u === "amber"
                                ? "15–30 days"
                                : "31+ days"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link
                              className={cn(
                                buttonVariants({ size: "icon-sm", variant: "ghost" }),
                                "inline-flex"
                              )}
                              href={`/clients?edit=${row.clientId}`}
                            >
                              <Pencil className="size-4" />
                            </Link>
                            <Button
                              aria-label={`Delete ${row.clientName}`}
                              onClick={() =>
                                setDeleteTarget({ id: row.clientId, name: row.clientName })
                              }
                              size="icon-sm"
                              variant="ghost"
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </main>

      <Dialog
        onOpenChange={(o) => {
          if (!o) {
            setDeleteTarget(null);
          }
        }}
        open={Boolean(deleteTarget)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete client?</DialogTitle>
            <DialogDescription>
              This removes{" "}
              <span className="font-semibold">{deleteTarget?.name}</span> and all related
              deadlines. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button onClick={() => setDeleteTarget(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={deleteClient}
              type="button"
            >
              Delete client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
