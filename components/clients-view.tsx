"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { enGB } from "date-fns/locale";
import { Pencil, Trash2 } from "lucide-react";

import ParticleButton from "@/components/kokonutui/particle-button";
import { AppNav } from "@/components/app-nav";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import type { ParseMeta } from "@/lib/parse-client";
import type { ParsedClientFields } from "@/lib/parse-client";
import {
  clientPayloadFromFields,
  isIsoDate,
  parseVatAnchorMonthFromUserInput,
} from "@/lib/parse-client";
import { vatQuarterEndMonths } from "@/lib/deadlines";

export type ClientEntity = {
  id: string;
  name: string;
  year_end_date: string | null;
  confirmation_statement_date: string | null;
  accounts_filing_due_date: string | null;
  self_assessment_date: string | null;
  vat_quarter_end_month: number | null;
  payroll_active: boolean;
  created_at: string;
};

const MONTH_NAMES = [
  "—",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function labelsForVatAnchor(
  anchor: number | null | undefined
): string | null {
  if (anchor == null || anchor < 1 || anchor > 12) {
    return null;
  }
  const months = [...vatQuarterEndMonths(anchor)].sort((a, b) => a - b);
  return months.map((m) => MONTH_NAMES[m]).join(", ");
}

function emptyFields(): ParsedClientFields {
  return {
    name: "",
    year_end_date: "",
    confirmation_statement_date: "",
    accounts_filing_due_date: "",
    self_assessment_date: "",
    vat_quarter_end_month: "",
    payroll_active: "false",
  };
}

function fieldsFromClient(c: ClientEntity): ParsedClientFields {
  return {
    name: c.name,
    year_end_date: c.year_end_date ?? "",
    confirmation_statement_date: c.confirmation_statement_date ?? "",
    accounts_filing_due_date: c.accounts_filing_due_date ?? "",
    self_assessment_date: c.self_assessment_date ?? "",
    vat_quarter_end_month:
      c.vat_quarter_end_month != null ? String(c.vat_quarter_end_month) : "",
    payroll_active: c.payroll_active ? "true" : "false",
  };
}

function allTrueMeta(): ParseMeta {
  return {
    nameParsed: true,
    yearEndParsed: true,
    confirmationParsed: true,
    accountsFilingParsed: true,
    selfAssessmentParsed: true,
    vatParsed: true,
    payrollParsed: true,
  };
}

/** Shared grid of client fields (used by smart-parse review and manual entry). */
function ClientFieldGrid({
  fields,
  setFields,
  meta,
  idPrefix,
}: {
  fields: ParsedClientFields;
  setFields: Dispatch<SetStateAction<ParsedClientFields>>;
  /** When null, no amber borders (fully manual typing). */
  meta: ParseMeta | null;
  idPrefix: string;
}) {
  const m: ParseMeta = meta ? { ...allTrueMeta(), ...meta } : allTrueMeta();
  const fieldClass = (parsed: boolean) =>
    parsed ? "border-slate-200" : "border-amber-400 ring-1 ring-amber-300";
  const vatAnchor = parseVatAnchorMonthFromUserInput(fields.vat_quarter_end_month);
  const vatQuarterLabelLine = labelsForVatAnchor(vatAnchor);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Client name</Label>
        <Input
          className={fieldClass(m.nameParsed)}
          id={`${idPrefix}-name`}
          onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
          value={fields.name}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-ye`}>Year end</Label>
        <p className="text-slate-500 text-xs">
          Corporation tax deadlines are based on year end, normalised to the{" "}
          <strong>last day of that month</strong> if needed.
        </p>
        <Input
          className={fieldClass(m.yearEndParsed)}
          id={`${idPrefix}-ye`}
          onChange={(e) =>
            setFields((f) => ({ ...f, year_end_date: e.target.value }))
          }
          placeholder="yyyy-MM-dd"
          value={fields.year_end_date}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-cs`}>Confirmation statement date</Label>
        <p className="text-slate-500 text-xs">
          Reminders use the <strong>calendar month</strong> of this date: each year the
          deadline is the <strong>last day of that month</strong>, with the flag on the{" "}
          <strong>last day of the previous month</strong>.
        </p>
        <Input
          className={fieldClass(m.confirmationParsed)}
          id={`${idPrefix}-cs`}
          onChange={(e) =>
            setFields((f) => ({
              ...f,
              confirmation_statement_date: e.target.value,
            }))
          }
          placeholder="yyyy-MM-dd"
          value={fields.confirmation_statement_date}
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={`${idPrefix}-af`}>Accounts filing due</Label>
        <p className="text-slate-500 text-xs">
          Same rhythm as confirmation: each year, <strong>last day of this date’s month</strong>{" "}
          as the deadline; flag on the <strong>last day of the month before</strong>.
        </p>
        <Input
          className={fieldClass(m.accountsFilingParsed)}
          id={`${idPrefix}-af`}
          onChange={(e) =>
            setFields((f) => ({
              ...f,
              accounts_filing_due_date: e.target.value,
            }))
          }
          placeholder="yyyy-MM-dd"
          value={fields.accounts_filing_due_date}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-sa`}>Self assessment date</Label>
        <Input
          className={fieldClass(m.selfAssessmentParsed)}
          id={`${idPrefix}-sa`}
          onChange={(e) =>
            setFields((f) => ({
              ...f,
              self_assessment_date: e.target.value,
            }))
          }
          placeholder="yyyy-MM-dd"
          value={fields.self_assessment_date}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-vat`}>VAT quarter end</Label>
        <p className="text-slate-500 text-xs">
          Pick <strong>one</strong> month when a quarter closes (last calendar day of that
          month). The app schedules the same pattern every three months — you do not enter
          the other quarters separately.
        </p>
        <select
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            fieldClass(m.vatParsed)
          )}
          id={`${idPrefix}-vat`}
          onChange={(e) =>
            setFields((f) => ({
              ...f,
              vat_quarter_end_month: e.target.value,
            }))
          }
          value={fields.vat_quarter_end_month}
        >
          <option value="">No VAT</option>
          {[
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
          ].map((mo) => (
            <option key={mo} value={String(mo)}>
              {MONTH_NAMES[mo]}
            </option>
          ))}
        </select>
        {vatQuarterLabelLine ? (
          <p className="text-slate-600 text-xs">
            Quarter-end months (last day of each): {vatQuarterLabelLine}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-2">
        <div>
          <Label htmlFor={`${idPrefix}-pr`}>Payroll / PAYE active</Label>
          <p className="text-slate-500 text-xs">
            Monthly reminders on the <strong>last day of each month</strong>.
          </p>
        </div>
        <Switch
          checked={fields.payroll_active === "true"}
          id={`${idPrefix}-pr`}
          onCheckedChange={(v) =>
            setFields((f) => ({
              ...f,
              payroll_active: v ? "true" : "false",
            }))
          }
        />
      </div>
    </div>
  );
}

/**
 * Smart input + confirmation card + client directory (Add / Edit Client page).
 */
export default function ClientsView({
  initialClients,
  editingClient,
  loadError,
}: {
  initialClients: ClientEntity[];
  /** When opening `/clients?edit=…`, the server passes the row to hydrate the form. */
  editingClient: ClientEntity | null;
  loadError?: string | null;
}) {
  const router = useRouter();
  const [smartText, setSmartText] = useState("");
  const [fields, setFields] = useState<ParsedClientFields>(() =>
    editingClient ? fieldsFromClient(editingClient) : emptyFields()
  );
  const [meta, setMeta] = useState<ParseMeta | null>(() =>
    editingClient ? allTrueMeta() : null
  );
  const [editingId, setEditingId] = useState<string | null>(
    () => editingClient?.id ?? null
  );
  const [saving, setSaving] = useState(false);
  /** Separate state so manual entry never fights the smart-parse / edit card. */
  const [manualFields, setManualFields] = useState<ParsedClientFields>(emptyFields);
  const [manualSaving, setManualSaving] = useState(false);
  const [chQuery, setChQuery] = useState("");
  const [chBusy, setChBusy] = useState(false);
  const [chErr, setChErr] = useState<string | null>(null);
  const [chHint, setChHint] = useState<string | null>(null);
  const [chMatches, setChMatches] = useState<
    { company_number: string; title: string; company_status?: string }[]
  >([]);

  const showCard = Boolean(meta);

  function applyCompaniesHousePrefill(ch: ParsedClientFields) {
    const merge = (base: ParsedClientFields): ParsedClientFields => ({
      ...base,
      name: ch.name.trim() || base.name,
      year_end_date: ch.year_end_date.trim() || base.year_end_date,
      confirmation_statement_date:
        ch.confirmation_statement_date.trim() ||
        base.confirmation_statement_date,
      accounts_filing_due_date:
        ch.accounts_filing_due_date.trim() || base.accounts_filing_due_date,
    });
    if (showCard) {
      setFields((prev) => merge(prev));
      setMeta((prev) => {
        if (!prev) {
          return null;
        }
        const patch: Partial<ParseMeta> = {};
        if (ch.name.trim()) {
          patch.nameParsed = true;
        }
        if (ch.year_end_date.trim()) {
          patch.yearEndParsed = true;
        }
        if (ch.confirmation_statement_date.trim()) {
          patch.confirmationParsed = true;
        }
        if (ch.accounts_filing_due_date.trim()) {
          patch.accountsFilingParsed = true;
        }
        return { ...prev, ...patch };
      });
    } else {
      setManualFields((prev) => merge(prev));
    }
    setChMatches([]);
    setChHint("Companies House details merged into the form.");
  }

  async function lookupCompaniesHouse() {
    const q = chQuery.trim();
    if (!q) {
      setChErr("Enter a company name or number.");
      return;
    }
    setChErr(null);
    setChHint(null);
    setChMatches([]);
    setChBusy(true);
    try {
      const res = await fetch(
        `/api/companies-house?q=${encodeURIComponent(q)}`
      );
      const raw = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const msg =
          typeof raw.error === "string"
            ? raw.error
            : `Request failed (${res.status}).`;
        setChErr(msg);
        return;
      }
      const data = raw as
        | { status: "prefill"; fields: ParsedClientFields }
        | { status: "matches"; matches: typeof chMatches }
        | { status: "no_results" };
      if ("error" in raw && typeof raw.error === "string") {
        setChErr(raw.error);
        return;
      }
      if (data.status === "no_results") {
        setChErr("No companies matched that search.");
        return;
      }
      if (data.status === "prefill") {
        applyCompaniesHousePrefill(data.fields);
        return;
      }
      if (data.status === "matches") {
        setChMatches(data.matches);
        setChHint("Several matches — pick the correct company.");
        return;
      }
    } finally {
      setChBusy(false);
    }
  }

  async function loadCompaniesHouseByNumber(companyNumber: string) {
    setChErr(null);
    setChHint(null);
    setChBusy(true);
    try {
      const res = await fetch(
        `/api/companies-house?company_number=${encodeURIComponent(companyNumber)}`
      );
      const raw = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const msg =
          typeof raw.error === "string"
            ? raw.error
            : `Request failed (${res.status}).`;
        setChErr(msg);
        return;
      }
      if ("error" in raw && typeof raw.error === "string") {
        setChErr(raw.error);
        return;
      }
      const data = raw as { status: "prefill"; fields: ParsedClientFields };
      if (data.status === "prefill") {
        applyCompaniesHousePrefill(data.fields);
      }
    } finally {
      setChBusy(false);
    }
  }

  async function parseSmart() {
    const res = await fetch("/api/parse-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: smartText }),
    });
    if (!res.ok) {
      alert("Could not parse text.");
      return;
    }
    const data = (await res.json()) as {
      fields: ParsedClientFields;
      meta: ParseMeta;
    };
    setFields(data.fields);
    setMeta(data.meta);
    setEditingId(null);
    setManualFields(emptyFields());
  }

  async function saveClient() {
    const payload = clientPayloadFromFields(fields);
    if (!payload.name.trim()) {
      alert("Client name is required.");
      return;
    }
    for (const key of [
      "year_end_date",
      "confirmation_statement_date",
      "accounts_filing_due_date",
      "self_assessment_date",
    ] as const) {
      const v = payload[key];
      if (v && !isIsoDate(v)) {
        alert(`Please fix invalid date for ${key}.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch(
        editingId ? `/api/clients/${editingId}` : "/api/clients",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields }),
        }
      );
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? "Save failed.");
        return;
      }
      setSmartText("");
      setFields(emptyFields());
      setMeta(null);
      setEditingId(null);
      router.replace("/clients");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  /** Create-only save from the manual form (does not use edit mode). */
  async function saveManualClient() {
    const payload = clientPayloadFromFields(manualFields);
    if (!payload.name.trim()) {
      alert("Client name is required.");
      return;
    }
    for (const key of [
      "year_end_date",
      "confirmation_statement_date",
      "accounts_filing_due_date",
      "self_assessment_date",
    ] as const) {
      const v = payload[key];
      if (v && !isIsoDate(v)) {
        alert(`Please fix invalid date for ${key}.`);
        return;
      }
    }
    setManualSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: manualFields }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        alert(j.error ?? "Save failed.");
        return;
      }
      setManualFields(emptyFields());
      router.refresh();
    } finally {
      setManualSaving(false);
    }
  }

  async function deleteClient(id: string) {
    if (!window.confirm("Delete this client and all deadlines?")) {
      return;
    }
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Delete failed.");
      return;
    }
    if (editingId === id) {
      setEditingId(null);
      setMeta(null);
      setFields(emptyFields());
    }
    router.replace("/clients");
    router.refresh();
  }

  const cardTitle = editingId ? "Edit client" : "Review parsed client";

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0F172A]">
      <AppNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6">
        {loadError ? (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950 text-sm"
            role="alert"
          >
            <p className="font-semibold">Could not load clients from the database</p>
            <p className="mt-1 text-amber-900/90">{loadError}</p>
          </div>
        ) : null}
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">Clients</h1>
          <p className="mt-1 max-w-2xl text-slate-600 text-sm">
            Use smart parsing from a paragraph, or fill the manual form — both save
            to Supabase.
          </p>
        </div>

        <section className="space-y-3">
          <Label className="font-medium text-base" htmlFor="smart">
            Smart input
          </Label>
          <Textarea
            className="min-h-[8rem] resize-y bg-white text-base"
            id="smart"
            onChange={(e) => setSmartText(e.target.value)}
            placeholder='Describe a client in plain English. For example: ABC Limited has a year end of 31 March, confirmation statement due 14 June, self assessment for director due by 31 Jan, VAT quarter ends September, payroll monthly.'
            rows={5}
            value={smartText}
          />
          <ParticleButton
            className="bg-[#0D9488] text-white hover:bg-[#0f766e]"
            onClick={parseSmart}
            type="button"
          >
            Parse and Add Client
          </ParticleButton>
        </section>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Companies House lookup</CardTitle>
            <CardDescription>
              Enter a company name or registration number. Filled fields merge into
              the review card when it is open, otherwise into manual entry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="ch-query">Company name or number</Label>
                <Input
                  className="bg-white"
                  id="ch-query"
                  onChange={(e) => setChQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void lookupCompaniesHouse();
                    }
                  }}
                  placeholder="e.g. FIGURES LTD or 12345678"
                  value={chQuery}
                />
              </div>
              <Button
                className="shrink-0 bg-slate-800 text-white hover:bg-slate-900"
                disabled={chBusy}
                onClick={() => void lookupCompaniesHouse()}
                type="button"
              >
                {chBusy ? "Looking up…" : "Lookup"}
              </Button>
            </div>
            {chErr ? (
              <p className="text-red-600 text-sm" role="alert">
                {chErr}
              </p>
            ) : null}
            {chHint && !chErr ? (
              <p className="text-slate-600 text-sm">{chHint}</p>
            ) : null}
            {chMatches.length > 0 ? (
              <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
                {chMatches.map((m) => (
                  <li className="flex flex-wrap items-center justify-between gap-2 p-2.5" key={m.company_number}>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-sm">{m.title}</p>
                      <p className="text-slate-500 text-xs">
                        {m.company_number}
                        {m.company_status ? ` · ${m.company_status}` : ""}
                      </p>
                    </div>
                    <Button
                      disabled={chBusy}
                      onClick={() => void loadCompaniesHouseByNumber(m.company_number)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Use this
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        {showCard ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>{cardTitle}</CardTitle>
              <CardDescription>
                Confirm each field before saving. Amber highlights were not detected
                automatically.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClientFieldGrid
                fields={fields}
                idPrefix="review"
                meta={meta}
                setFields={setFields}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button
                className="bg-[#0D9488] text-white hover:bg-[#0f766e]"
                disabled={saving}
                onClick={saveClient}
                type="button"
              >
                Save to Database
              </Button>
              <Button
                onClick={() => {
                  setMeta(null);
                  setEditingId(null);
                  setFields(emptyFields());
                  router.replace("/clients");
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        {!showCard ? (
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle>Manual entry</CardTitle>
              <CardDescription>
                Type directly into each field (dates as yyyy-MM-dd). Leave optional
                fields blank if they do not apply.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ClientFieldGrid
                fields={manualFields}
                idPrefix="manual"
                meta={null}
                setFields={setManualFields}
              />
            </CardContent>
            <CardFooter className="flex flex-wrap gap-3">
              <Button
                className="bg-[#0D9488] text-white hover:bg-[#0f766e]"
                disabled={manualSaving}
                onClick={saveManualClient}
                type="button"
              >
                Save to Database
              </Button>
              <Button
                onClick={() => setManualFields(emptyFields())}
                type="button"
                variant="outline"
              >
                Clear form
              </Button>
            </CardFooter>
          </Card>
        ) : null}

        <section className="space-y-3">
          <h2 className="font-semibold text-lg">Client list</h2>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Year end</TableHead>
                  <TableHead>Confirmation</TableHead>
                  <TableHead>Accounts filing</TableHead>
                  <TableHead>Self Assessment</TableHead>
                  <TableHead className="min-w-[12rem]">VAT quarter-end months</TableHead>
                  <TableHead>Payroll</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialClients.length === 0 ? (
                  <TableRow>
                    <TableCell className="py-10 text-center text-slate-500" colSpan={8}>
                      No clients yet — use smart input or manual entry above.
                    </TableCell>
                  </TableRow>
                ) : (
                  initialClients.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {c.year_end_date
                          ? format(parseISO(c.year_end_date), "dd MMM yyyy", {
                              locale: enGB,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {c.confirmation_statement_date
                          ? format(
                              parseISO(c.confirmation_statement_date),
                              "dd MMM yyyy",
                              { locale: enGB }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {c.accounts_filing_due_date
                          ? format(
                              parseISO(c.accounts_filing_due_date),
                              "dd MMM yyyy",
                              { locale: enGB }
                            )
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {c.self_assessment_date
                          ? format(parseISO(c.self_assessment_date), "dd MMM yyyy", {
                              locale: enGB,
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[18rem] align-top text-sm leading-snug">
                        {labelsForVatAnchor(c.vat_quarter_end_month) ?? "—"}
                      </TableCell>
                      <TableCell>{c.payroll_active ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            className={cn(
                              buttonVariants({ size: "icon-sm", variant: "ghost" }),
                              "inline-flex"
                            )}
                            href={`/clients?edit=${c.id}`}
                          >
                            <Pencil className="size-4" />
                          </Link>
                          <Button
                            aria-label={`Delete ${c.name}`}
                            onClick={() => deleteClient(c.id)}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </main>
    </div>
  );
}
