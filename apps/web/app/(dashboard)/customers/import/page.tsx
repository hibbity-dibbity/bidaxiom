"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import {
  CUSTOMER_IMPORT_FIELDS,
  suggestCustomerMapping,
  buildCustomerRows,
  type CustomerImportMapping,
  type CustomerImportFieldKey,
  type ImportRowResult,
} from "@construction/shared";
import { readSpreadsheet, MAX_IMPORT_ROWS, type ParsedSheet } from "@/lib/customer-import-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { Loader2, Upload, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Step = "file" | "map" | "preview" | "done";
const CHUNK = 400;

const STATUS_LABEL: Record<ImportRowResult["status"], string> = { ready: "Ready", warning: "Fixed up", duplicate: "Duplicate", error: "Can't import" };
const STATUS_VARIANT: Record<ImportRowResult["status"], "default" | "secondary" | "destructive" | "outline"> = {
  ready: "secondary",
  warning: "outline",
  duplicate: "outline",
  error: "destructive",
};

export default function ImportCustomersPage() {
  const utils = trpc.useUtils();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState<ParsedSheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<CustomerImportMapping>({});
  const [useCompanyAsContact, setUseCompanyAsContact] = useState(true);
  const [importDuplicates, setImportDuplicates] = useState(false);
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ imported: number; skippedDuplicates: number; skippedErrors: number; batchId: string } | null>(null);

  const existing = trpc.customer.importIndex.useQuery(undefined, { retry: false });
  const batches = trpc.customer.importBatches.useQuery(undefined, { retry: false });
  const commit = trpc.customer.importCommit.useMutation();
  const undo = trpc.customer.importUndo.useMutation();

  const sheet = sheets[sheetIdx];
  const headers = useMemo(() => {
    if (!sheet) return [] as string[];
    const width = Math.max(...sheet.rows.map((r) => r.length));
    if (hasHeader) return Array.from({ length: width }, (_, i) => sheet.rows[0][i]?.trim() || `Column ${i + 1}`);
    return Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
  }, [sheet, hasHeader]);
  const dataRows = useMemo(() => (sheet ? (hasHeader ? sheet.rows.slice(1) : sheet.rows) : []), [sheet, hasHeader]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setReading(true);
    try {
      const parsed = await readSpreadsheet(file);
      const first = parsed[0];
      if (first.rows.length - 1 > MAX_IMPORT_ROWS) throw new Error(`That sheet has more than ${MAX_IMPORT_ROWS} rows. Split it into smaller files.`);
      setFileName(file.name);
      setSheets(parsed);
      pickSheet(0, parsed, true);
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file");
    } finally {
      setReading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function pickSheet(i: number, all = sheets, header = hasHeader) {
    setSheetIdx(i);
    const rows = all[i].rows;
    const names = header ? rows[0] : [];
    setMapping(header ? suggestCustomerMapping(names) : {});
  }

  function setField(key: CustomerImportFieldKey, value: string) {
    setMapping((m) => {
      const next = { ...m };
      if (value === "") delete next[key];
      else next[key] = Number(value);
      return next;
    });
  }

  const results = useMemo(
    () => (step === "preview" || step === "done" ? buildCustomerRows(dataRows, mapping, { useCompanyAsContact }, existing.data ?? []) : []),
    [step, dataRows, mapping, useCompanyAsContact, existing.data]
  );
  const counts = useMemo(() => {
    const c = { ready: 0, warning: 0, duplicate: 0, error: 0 };
    for (const r of results) c[r.status]++;
    return c;
  }, [results]);
  const willImport = counts.ready + counts.warning + (importDuplicates ? counts.duplicate : 0);

  const mappedAny = mapping.contactName !== undefined || mapping.companyName !== undefined || mapping.firstName !== undefined || mapping.lastName !== undefined;

  async function runImport() {
    const batchId = crypto.randomUUID();
    const rows = results
      .filter((r) => r.customer && (r.status === "ready" || r.status === "warning" || (importDuplicates && r.status === "duplicate")))
      .map((r) => {
        const c = r.customer!;
        return [c.companyName ?? "", c.contactName, c.email ?? "", c.phone ?? "", c.street1 ?? "", c.street2 ?? "", c.city ?? "", c.state ?? "", c.zip ?? "", c.paymentTerms ?? ""];
      });
    setProgress(0);
    let imported = 0;
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const r = await commit.mutateAsync({ batchId, fileName, importDuplicates, rows: rows.slice(i, i + CHUNK) });
        imported += r.imported;
        setProgress(Math.min(100, Math.round(((i + CHUNK) / rows.length) * 100)));
      }
      setResult({ imported, skippedDuplicates: importDuplicates ? 0 : counts.duplicate, skippedErrors: counts.error, batchId });
      utils.customer.list.invalidate();
      batches.refetch();
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
      if (imported > 0) toast.message(`${imported} customers were added before the problem. You can undo this import below.`);
      batches.refetch();
    } finally {
      setProgress(null);
    }
  }

  async function undoBatch(batchId: string) {
    try {
      const r = await undo.mutateAsync({ batchId });
      toast.success(`Removed ${r.removed} imported customers${r.kept ? `; kept ${r.kept} that already have projects` : ""}.`);
      utils.customer.list.invalidate();
      batches.refetch();
      if (result?.batchId === batchId) setResult(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not undo");
    }
  }

  function reset() {
    setStep("file");
    setSheets([]);
    setMapping({});
    setResult(null);
    setError("");
    setFilter("all");
  }

  const samples = (idx: number | undefined) => (idx === undefined ? [] : dataRows.map((r) => r[idx]?.trim()).filter(Boolean).slice(0, 3));
  const select = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import customers"
        description="Upload a spreadsheet, match its columns to BidAxiom's fields, review, then import."
        actions={
          <Button variant="outline" asChild>
            <Link href="/customers"><ArrowLeft className="mr-2 h-4 w-4" />Customers</Link>
          </Button>
        }
      />

      {existing.error && (
        <Alert variant="destructive">
          <AlertDescription>{existing.error.message}</AlertDescription>
        </Alert>
      )}

      {step === "file" && (
        <Card>
          <CardHeader>
            <CardTitle>1. Choose your file</CardTitle>
            <CardDescription>A .csv or .xlsx export from any system. The first row should hold column names. Nothing is saved until you review it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <input ref={fileInput} type="file" accept=".csv,.xlsx,.xlsm,.txt" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button onClick={() => fileInput.current?.click()} disabled={reading}>
              {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {reading ? "Reading…" : "Choose file"}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "map" && sheet && (
        <Card>
          <CardHeader>
            <CardTitle>2. Match your columns</CardTitle>
            <CardDescription>
              {fileName}: {dataRows.length} rows. For each BidAxiom field, pick the column in your file that holds it, or leave it unmatched. We guessed from the column names; correct anything that's off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {sheets.length > 1 && (
                <label className="flex items-center gap-2">
                  Sheet
                  <select className="h-9 rounded-md border border-input bg-background px-2" value={sheetIdx} onChange={(e) => pickSheet(Number(e.target.value))}>
                    {sheets.map((s, i) => <option key={s.name} value={i}>{s.name} ({s.rows.length} rows)</option>)}
                  </select>
                </label>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={hasHeader}
                  onChange={(e) => {
                    setHasHeader(e.target.checked);
                    setMapping(e.target.checked ? suggestCustomerMapping(sheet.rows[0]) : {});
                  }}
                />
                First row contains column names
              </label>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56">BidAxiom field</TableHead>
                    <TableHead className="w-72">Column in your file</TableHead>
                    <TableHead>Examples from your data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CUSTOMER_IMPORT_FIELDS.map((f) => (
                    <TableRow key={f.key}>
                      <TableCell>
                        <div className="font-medium">{f.label}</div>
                        {f.hint && <div className="text-xs text-muted-foreground">{f.hint}</div>}
                      </TableCell>
                      <TableCell>
                        <select className={select} value={mapping[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)}>
                          <option value="">Don&apos;t import</option>
                          {headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                        </select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{samples(mapping[f.key]).join("  ·  ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={useCompanyAsContact} onChange={(e) => setUseCompanyAsContact(e.target.checked)} />
              <span>When a row has a company but no person, use the company name as the contact name. BidAxiom needs a contact name on every customer.</span>
            </label>

            {!mappedAny && (
              <Alert>
                <AlertDescription>Match at least a Company name or a Contact name to continue.</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>Choose a different file</Button>
              <Button disabled={!mappedAny || existing.isLoading} onClick={() => setStep("preview")}>
                {existing.isLoading ? "Loading…" : "Review"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>3. Review before importing</CardTitle>
            <CardDescription>This is exactly what would be added. Go back to change the matching if something looks wrong.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{counts.ready} ready</Badge>
              <Badge variant="outline">{counts.warning} fixed up</Badge>
              <Badge variant="outline">{counts.duplicate} duplicates</Badge>
              <Badge variant="destructive">{counts.error} can&apos;t import</Badge>
            </div>
            {counts.duplicate > 0 && (
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={importDuplicates} onChange={(e) => setImportDuplicates(e.target.checked)} />
                <span>Import duplicates too. Off by default: rows that match an existing customer (same email, or same company and contact) are skipped.</span>
              </label>
            )}
            <div className="flex gap-2 text-sm">
              <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All rows</Button>
              <Button size="sm" variant={filter === "attention" ? "default" : "outline"} onClick={() => setFilter("attention")}>Needs attention</Button>
            </div>
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Email / phone</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results
                    .filter((r) => filter === "all" || r.status !== "ready")
                    .slice(0, 300)
                    .map((r) => {
                      const c = r.customer;
                      return (
                        <TableRow key={r.rowNumber}>
                          <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{c?.companyName || c?.contactName || "—"}</div>
                            {c?.companyName && c.contactName !== c.companyName && <div className="text-xs text-muted-foreground">{c.contactName}</div>}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div>{c?.email ?? ""}</div>
                            <div className="text-muted-foreground">{c?.phone ?? ""}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {c ? [c.street1, c.street2, [c.city, c.state].filter(Boolean).join(", "), c.zip].filter(Boolean).join(" · ") : ""}
                            {c?.paymentTerms && <div className="text-xs text-muted-foreground">{c.paymentTerms}</div>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                            {r.messages.map((m, i) => <div key={i} className="mt-1 text-xs text-muted-foreground">{m}</div>)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            {results.length > 300 && <p className="text-xs text-muted-foreground">Showing the first 300 rows of {results.length}. All rows are imported according to their result.</p>}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setStep("map")} disabled={progress !== null}>Back</Button>
              <Button disabled={willImport === 0 || progress !== null} onClick={runImport}>
                {progress !== null && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {progress !== null ? `Importing… ${progress}%` : `Import ${willImport} customers`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "done" && result && (
        <Card>
          <CardHeader>
            <CardTitle>Import finished</CardTitle>
            <CardDescription>
              {result.imported} customers added. {counts.duplicate && !importDuplicates ? `${counts.duplicate} duplicates skipped. ` : ""}
              {counts.error ? `${counts.error} rows couldn't be imported (no name). ` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild><Link href="/customers">View customers</Link></Button>
            <Button variant="outline" onClick={reset}>Import another file</Button>
            <Button variant="outline" disabled={undo.isPending} onClick={() => undoBatch(result.batchId)}>Undo this import</Button>
          </CardContent>
        </Card>
      )}

      {batches.data && batches.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Earlier imports</CardTitle>
            <CardDescription>Undo removes the customers an import added, except any that already have projects.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {batches.data.map((b) => (
              <div key={b.batchId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium">{b.source}</span>
                  <span className="ml-2 text-muted-foreground">{new Date(b.at).toLocaleString()} · {b.count} customers</span>
                </div>
                <Button size="sm" variant="outline" disabled={undo.isPending} onClick={() => undoBatch(b.batchId)}>Undo</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
