import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Check, ExternalLink, Minus, X } from "lucide-react";
import type { FindingRow, Outcome, StepName } from "@/lib/api";
import { bytes, humanise, money, percent, quantity, toNumber } from "@/lib/format";
import { Badge, type Tone } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FindingList } from "@/components/findings";
import { OutcomeBadge } from "@/components/outcome";
import { cn } from "@/lib/utils";

type Data = Record<string, unknown>;

function asData(value: unknown): Data | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Data) : null;
}

function asList(value: unknown): Data[] {
  return Array.isArray(value) ? value.map((item) => asData(item) ?? { value: item }) : [];
}

function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-1.5", className)}>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      {children}
    </section>
  );
}

type Field = [label: string, value: ReactNode];

function Fields({ items, columns = 2 }: { items: Field[]; columns?: 1 | 2 | 3 | 4 }) {
  const grid = { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-1.5", grid)}>
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[11px] text-slate-500">{label}</dt>
          <dd className="num break-words text-[13px] text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function YesNo({ value, yes = "Yes", no = "No" }: { value: unknown; yes?: string; no?: string }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  return value ? (
    <span className="inline-flex items-center gap-1 text-emerald-700">
      <Check className="h-3.5 w-3.5" />
      {yes}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-red-700">
      <X className="h-3.5 w-3.5" />
      {no}
    </span>
  );
}

function Score({ value }: { value: unknown }) {
  const score = toNumber(value);
  if (score === null) return <span>—</span>;
  const width = Math.max(0, Math.min(100, score));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
        <span
          className={cn("block h-full rounded-full", width >= 90 ? "bg-emerald-500" : width >= 70 ? "bg-amber-500" : "bg-slate-400")}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className="num">{score.toFixed(score % 1 === 0 ? 0 : 1)}</span>
    </span>
  );
}

const SIGNAL_LABEL: Record<string, string> = {
  amount: "Amount fits balance",
  lines: "Lines match PO",
  sole_open_po: "Only open PO",
  reference: "PO number printed",
};

function Signals({ value }: { value: unknown }) {
  const signals = Array.isArray(value) ? value.map(String) : [];
  if (signals.length === 0) return <span className="text-slate-400">none</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {signals.map((signal) => (
        <Badge key={signal} tone="blue" title={signal}>
          {SIGNAL_LABEL[signal] ?? humanise(signal)}
        </Badge>
      ))}
    </span>
  );
}

function GenericValue({ value }: { value: unknown }): ReactNode {
  if (value === null || value === undefined || value === "") return <span className="text-slate-400">—</span>;
  if (typeof value === "boolean") return <YesNo value={value} />;
  if (typeof value !== "object") return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">none</span>;
    if (value.every((item) => item === null || typeof item !== "object")) return <span>{value.map(String).join(", ")}</span>;
    return <GenericTable rows={asList(value)} />;
  }
  return <GenericFields data={value as Data} />;
}

function GenericFields({ data, skip = [] }: { data: Data; skip?: readonly string[] }) {
  const entries = Object.entries(data).filter(([key]) => !skip.includes(key) && key !== "findings");
  if (entries.length === 0) return null;
  return <Fields items={entries.map(([key, value]): Field => [humanise(key), <GenericValue value={value} />])} />;
}

function GenericTable({ rows }: { rows: Data[] }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return (
    <div className="rounded-md border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>{humanise(column)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {columns.map((column) => (
                <TableCell key={column}>
                  <GenericValue value={row[column]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Remaining({ data, handled }: { data: Data; handled: readonly string[] }) {
  const rest = Object.keys(data).filter((key) => !handled.includes(key) && key !== "findings");
  if (rest.length === 0) return null;
  return (
    <Section title="Other fields">
      <GenericFields data={data} skip={handled} />
    </Section>
  );
}

export interface RunFacts {
  outcome: Outcome | null;
  summary: string | null;
  reasons: FindingRow[];
}

interface RendererProps {
  data: Data;
  currency: string | null;
  run: RunFacts;
}

function IntakeEvidence({ data }: RendererProps) {
  const textLayer = data.text_layer;
  return (
    <>
      <Fields
        columns={4}
        items={[
          ["File", text(data.filename)],
          ["Type", text(data.media_type)],
          ["Size", bytes(data.size_bytes)],
          ["Pages", text(data.page_count)],
          [
            "Text layer",
            textLayer === false ? (
              <Badge tone="amber">Scanned, no text layer</Badge>
            ) : textLayer === true ? (
              "Present"
            ) : (
              <span className="text-slate-400">Not applicable</span>
            ),
          ],
          ["Encrypted", data.encrypted === true ? <Badge tone="red">Encrypted</Badge> : data.encrypted === false ? "No" : "—"],
          ["Accepted", <YesNo value={data.accepted} yes="Accepted" no="Rejected" />],
        ]}
      />
      <Remaining data={data} handled={["filename", "media_type", "size_bytes", "page_count", "text_layer", "encrypted", "accepted"]} />
    </>
  );
}


function partyFields(party: Data | null, bank: Data | null): Field[] {
  const fields: Field[] = [
    ["Name", text(party?.name)],
    ["Tax ID", <span className="font-mono text-[12px]">{text(party?.tax_id)}</span>],
    ["Address", text(party?.address)],
    ["Email", text(party?.email)],
  ];
  if (bank) {
    fields.push(
      ["Bank account", <span className="font-mono text-[12px]">{text(bank.account_number)}</span>],
      ["Account name", text(bank.account_name)],
      ["Bank", text(bank.bank_name)],
      ["Bank code", <span className="font-mono text-[12px]">{text(bank.bank_code)}</span>],
    );
  }
  return fields;
}

const SOURCE_LABEL: Record<string, string> = {
  invoice_number: "Invoice number",
  invoice_date: "Invoice date",
  subtotal: "Subtotal",
  total: "Total",
  po_reference_text: "PO reference",
};

function ExtractionEvidence({ data }: RendererProps) {
  const extraction = asData(data.extraction);
  const usage = asData(data.usage);
  const currency = extraction && typeof extraction.currency === "string" ? extraction.currency : null;
  const lines = asList(extraction?.lines);
  const taxLines = asList(extraction?.tax_lines);
  const sources = asList(extraction?.sources);
  const tokenSum = usage ? ["input", "cache_read", "cache_write", "output"].reduce((sum, key) => sum + (toNumber(usage[key]) ?? 0), 0) : null;

  return (
    <div className="space-y-4">
      {!extraction && <p className="text-sm text-slate-600">No extraction was produced for this document.</p>}
      {extraction && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Supplier">
              <Fields items={partyFields(asData(extraction.supplier), asData(extraction.supplier_bank) ?? {})} />
            </Section>
            <Section title="Buyer">
              <Fields items={partyFields(asData(extraction.buyer), null)} />
            </Section>
          </div>

          <Section title="Invoice">
            <Fields
              columns={4}
              items={[
                ["Invoice number", <span className="font-mono text-[12px]">{text(extraction.invoice_number)}</span>],
                ["Invoice date", text(extraction.invoice_date)],
                ["Due date", text(extraction.due_date)],
                ["Currency", text(extraction.currency)],
                ["PO reference", text(extraction.po_reference_text)],
                ["Prices include tax", <YesNo value={extraction.prices_include_tax} />],
              ]}
            />
          </Section>

          <Section title="Line items">
            {lines.length === 0 ? (
              <p className="text-[13px] text-slate-500">No line items were read.</p>
            ) : (
              <div className="rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell>{text(line.description)}</TableCell>
                        <TableCell className="num text-right">{quantity(line.quantity)}</TableCell>
                        <TableCell>{text(line.unit)}</TableCell>
                        <TableCell className="num text-right">{money(line.unit_price, currency)}</TableCell>
                        <TableCell className="num text-right">{percent(line.tax_rate_pct)}</TableCell>
                        <TableCell className="num text-right">{money(line.line_amount, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Totals">
              <div className="rounded-md border border-slate-200">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-slate-600">Subtotal</TableCell>
                      <TableCell className="num text-right">{money(extraction.subtotal, currency)}</TableCell>
                    </TableRow>
                    {taxLines.map((tax, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-slate-600">
                          {text(tax.label)}
                          {tax.rate_pct !== null && tax.rate_pct !== undefined && <span className="text-slate-400"> @ {percent(tax.rate_pct)}</span>}
                        </TableCell>
                        <TableCell className="num text-right">{money(tax.amount, currency)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="num text-right">{money(extraction.total, currency)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Section>

            <Section title="Quoted from the document">
              {sources.length === 0 ? (
                <p className="text-[13px] text-slate-500">No source quotes.</p>
              ) : (
                <ul className="space-y-1">
                  {sources.map((source, index) => (
                    <li key={index} className="flex gap-2 text-[13px]">
                      <span className="w-28 shrink-0 text-slate-500">{SOURCE_LABEL[String(source.field)] ?? humanise(String(source.field ?? ""))}</span>
                      <q className="min-w-0 break-words font-mono text-[12px] text-slate-800 before:text-slate-400 after:text-slate-400">
                        {text(source.text)}
                      </q>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <Remaining
            data={extraction}
            handled={[
              "supplier",
              "supplier_bank",
              "buyer",
              "invoice_number",
              "invoice_date",
              "due_date",
              "currency",
              "po_reference_text",
              "prices_include_tax",
              "lines",
              "subtotal",
              "tax_lines",
              "total",
              "sources",
            ]}
          />
        </>
      )}

      <Section title="Model">
        <Fields
          columns={4}
          items={[
            ["Mode", data.mode === "live" ? "Live model" : data.mode === "recorded" ? "Recorded extraction" : data.mode === "manual" ? "Manual entry" : text(data.mode)],
            ["Model", <span className="font-mono text-[12px]">{text(data.model)}</span>],
            ["Model time", toNumber(data.seconds) === null ? "—" : `${(toNumber(data.seconds) ?? 0).toFixed(2)} s`],
            ...((tokenSum === 0 && data.mode === "recorded") || data.mode === "manual"
              ? [["Tokens", <span className="text-slate-500">No tokens used ({data.mode === "manual" ? "manual entry" : "recorded extraction"})</span>] satisfies Field]
              : ([
                  ["Tokens total", usage ? quantity(tokenSum) : "—"],
                  ["Input", quantity(usage?.input)],
                  ["Cache read", quantity(usage?.cache_read)],
                  ["Cache write", quantity(usage?.cache_write)],
                  ["Output", quantity(usage?.output)],
                ] satisfies Field[])),
          ]}
        />
      </Section>

      <Remaining data={data} handled={["extraction", "usage", "mode", "model", "seconds"]} />
    </div>
  );
}

function ValidationEvidence({ data, currency }: RendererProps) {
  return (
    <>
      <Fields
        columns={4}
        items={[
          ["Taxable value", money(data.taxable_value, currency)],
          ["Tax total", money(data.tax_total, currency)],
          ["Tax rate", percent(data.tax_rate_pct)],
          ["Taxable value derived", <YesNo value={data.derived} yes="Derived from total" no="Read from invoice" />],
        ]}
      />
      <Remaining data={data} handled={["taxable_value", "tax_total", "tax_rate_pct", "derived"]} />
    </>
  );
}

const VENDOR_METHOD: Record<string, string> = {
  tax_id: "Tax ID match",
  bank_account: "Bank account match",
  name_fuzzy: "Name match only",
  none: "No match",
};

const VENDOR_SIGNAL: Record<string, string> = {
  tax_id: "Tax ID (GSTIN, VAT number)",
  bank_account: "Bank account",
  name: "Legal name",
};

const SIGNAL_STATE: Record<string, { label: string; tone: Tone }> = {
  matched: { label: "Matches the vendor master", tone: "green" },
  mismatched: { label: "Differs from the vendor master", tone: "red" },
  absent: { label: "Not printed", tone: "neutral" },
};

function Needed({ value }: { value: unknown }) {
  const needed = toNumber(value);
  return needed === null ? <span>—</span> : <span>More than {needed}</span>;
}

function VendorEvidence({ data }: RendererProps) {
  const candidates = asList(data.candidates);
  const evidence = asList(data.evidence);
  return (
    <div className="space-y-3">
      <Fields
        columns={4}
        items={[
          ["Vendor", data.legal_name ? text(data.legal_name) : <span className="text-slate-400">Not identified</span>],
          ["Vendor ID", <span className="font-mono text-[12px]">{text(data.vendor_id)}</span>],
          ["Strongest match", VENDOR_METHOD[String(data.method)] ?? text(data.method)],
          ["Score", <Score value={data.score} />],
          ...(data.needed === undefined ? [] : ([["Score needed", <Needed value={data.needed} />]] satisfies Field[])),
        ]}
      />
      {evidence.length > 0 && (
        <Section title="How the score adds up">
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field on the invoice</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead className="text-right">Weight</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evidence.map((signal, index) => {
                  const state = SIGNAL_STATE[String(signal.state)];
                  return (
                    <TableRow key={index}>
                      <TableCell>{VENDOR_SIGNAL[String(signal.signal)] ?? text(signal.signal)}</TableCell>
                      <TableCell>
                        <Badge tone={state?.tone ?? "neutral"}>{state?.label ?? text(signal.state)}</Badge>
                      </TableCell>
                      <TableCell className="num text-right">{text(signal.weight)}</TableCell>
                      <TableCell className="num text-right">{text(signal.points)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-[12px] text-slate-500">
            The score is the sum of the points, capped at 100. A tax ID or bank account that differs from the vendor
            master stops approval at any score.
          </p>
        </Section>
      )}
      {candidates.length > 0 && (
        <Section title="Candidates">
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>{candidates.some((candidate) => candidate.basis === "weights") ? "Score" : "Name similarity"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate, index) => (
                  <TableRow key={index}>
                    <TableCell>{text(candidate.legal_name)}</TableCell>
                    <TableCell className="font-mono text-[12px]">{text(candidate.vendor_id)}</TableCell>
                    <TableCell>
                      <Score value={candidate.score} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
      <Remaining data={data} handled={["vendor_id", "legal_name", "method", "score", "needed", "evidence", "candidates"]} />
    </div>
  );
}

const JEV_VERDICT: Record<string, { label: string; tone: Tone }> = {
  selected: { label: "Selected", tone: "green" },
  unsure: { label: "Unsure", tone: "amber" },
  rejected: { label: "Rejected", tone: "outline" },
};

function JevSelection({ data, currency }: { data: Data; currency: string | null }) {
  const candidates = asList(data.candidates);
  const selected = Array.isArray(data.selected) ? data.selected.map(String) : [];
  // Stored findings keep the backend's field names (severity, message); FindingList reads the wire names.
  const codeFindings: FindingRow[] = asList(data.code_findings).map((item) => ({
    code: text(item.code),
    level: item.severity === "block" || item.severity === "warn" ? item.severity : "info",
    text: text(item.message),
    data: {},
  }));
  const answered = data.state === "answered";
  return (
    <div className="space-y-3">
      <Fields
        columns={3}
        items={[
          ["Selected POs", selected.length ? <span className="font-mono text-[12px]">{selected.join(", ")}</span> : <span className="text-slate-400">None</span>],
          ["Selection used", !answered ? `No: ${text(data.reason)}` : data.confident ? "Yes: no PO unsure, at least one selected" : "No: kept for a person"],
          ["Jev answer", data.mode === "live" ? "Live" : "Recorded"],
        ]}
      />
      {candidates.length > 0 && (
        <Section title="Open POs of this vendor, with Jev's probability that the invoice bills each">
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead>PO date</TableHead>
                  <TableHead className="text-right">Remaining balance</TableHead>
                  <TableHead className="text-right">Probability</TableHead>
                  <TableHead>Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate, index) => {
                  const verdict = JEV_VERDICT[String(candidate.verdict)];
                  const probability = toNumber(candidate.probability);
                  return (
                    <TableRow key={index} className={candidate.verdict === "selected" ? "bg-emerald-50/60" : undefined}>
                      <TableCell className="font-mono text-[12px]">{text(candidate.po_number)}</TableCell>
                      <TableCell>{text(candidate.po_date)}</TableCell>
                      <TableCell className="num text-right">{money(candidate.remaining, currency)}</TableCell>
                      <TableCell className="num text-right">{probability === null ? "—" : probability.toFixed(2)}</TableCell>
                      <TableCell>{verdict ? <Badge tone={verdict.tone}>{verdict.label}</Badge> : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">Selected above 0.80, unsure above 0.50 up to 0.80, rejected at 0.50 or below.</p>
        </Section>
      )}
      {codeFindings.length > 0 && (
        <Section title="What the code found before asking Jev">
          <FindingList findings={codeFindings} />
        </Section>
      )}
    </div>
  );
}

const PO_METHOD: Record<string, string> = {
  explicit: "PO number printed on invoice; lines matched to it",
  lines: "Matched by the invoice lines (no PO number printed)",
  jev: "Matched by the invoice lines; Jev settled the lines the code was not sure about",
  inferred: "Inferred from the vendor's open POs",
  none: "No PO matched",
};

const LINE_METHOD: Record<string, { label: string; tone: Tone }> = {
  code: { label: "Code (sure)", tone: "green" },
  jev_kept: { label: "Jev kept the code's line", tone: "blue" },
  jev_changed: { label: "Jev chose another line", tone: "blue" },
  jev_dropped: { label: "Jev: on no PO line", tone: "red" },
  unmatched: { label: "Not matched", tone: "amber" },
};

function chosenProbability(allocation: Data): string {
  const probabilities = asData(allocation.probabilities) ?? {};
  const key = allocation.po_number ? `${String(allocation.po_number)}/${String(allocation.po_line)}` : null;
  const value = key ? toNumber(probabilities[key]) : null;
  return value === null ? "—" : value.toFixed(2);
}

function LineAllocations({ allocations }: { allocations: Data[] }) {
  return (
    <div className="rounded-md border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice line</TableHead>
            <TableHead>PO line</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>How</TableHead>
            <TableHead className="text-right">Text score</TableHead>
            <TableHead className="text-right">Jev</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((allocation, index) => {
            const how = LINE_METHOD[String(allocation.method)];
            const parts = allocations.filter((other) => other.line === allocation.line);
            const part = parts.length > 1 ? ` (part ${parts.indexOf(allocation) + 1} of ${parts.length})` : "";
            const target = allocation.po_number ? `${String(allocation.po_number)} / line ${String(allocation.po_line)}` : null;
            return (
              <TableRow key={index}>
                <TableCell>
                  <span className="num text-slate-400">{text(allocation.line)}.</span> {text(allocation.description)}
                  {part && <span className="text-xs text-slate-400">{part}</span>}
                </TableCell>
                <TableCell className="font-mono text-[12px]">
                  {target ?? <span className="text-slate-400">—</span>}
                  {typeof allocation.suggestion === "string" && allocation.suggestion !== `${String(allocation.po_number)}/${String(allocation.po_line)}` && (
                    <div className="text-[11px] text-slate-400">code suggested {text(allocation.suggestion)}</div>
                  )}
                </TableCell>
                <TableCell className="num text-right">{quantity(allocation.quantity)}</TableCell>
                <TableCell>{how ? <Badge tone={how.tone}>{how.label}</Badge> : text(allocation.method)}</TableCell>
                <TableCell className="num text-right">{toNumber(allocation.score) === null ? "—" : Math.round(toNumber(allocation.score) ?? 0)}</TableCell>
                <TableCell className="num text-right">{chosenProbability(allocation)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="px-3 py-1.5 text-xs text-slate-500">
        The code is sure of a line above 90 when no other PO line looks like the same item; Jev decides the rest (above 0.80 used). Quantity on several PO lines fills the oldest PO first.
      </p>
    </div>
  );
}

function OrderEvidence({ data, currency }: RendererProps) {
  const candidates = asList(data.candidates);
  const allocations = asList(data.allocations);
  const byLines = allocations.length > 0 || Array.isArray(data.pool);
  const others = Array.isArray(data.others) ? data.others.map(String) : [];
  const chosen = new Set(data.po_number ? [String(data.po_number), ...others] : []);
  const assist = asData(data.assist);
  const oldSelection = assist && asList(assist.candidates).length > 0;
  return (
    <div className="space-y-3">
      <Fields
        columns={3}
        items={[
          [
            others.length > 0 ? "Purchase orders (invoice split between them)" : "Purchase order",
            data.po_number ? <span className="font-mono text-[12px]">{[text(data.po_number), ...others].join(", ")}</span> : <span className="text-slate-400">None</span>,
          ],
          ["Method", PO_METHOD[String(data.method)] ?? text(data.method)],
          ...(byLines
            ? ([["POs searched", <span className="font-mono text-[12px]">{asList(data.pool).length ? (data.pool as unknown[]).map(String).join(", ") : "—"}</span>]] satisfies Field[])
            : ([
                ["Signals", <Signals value={data.signals} />],
                ...(data.score === undefined
                  ? []
                  : ([
                      ["Score", <Score value={data.score} />],
                      ["Score needed", <Needed value={data.needed} />],
                    ] satisfies Field[])),
              ] satisfies Field[])),
        ]}
      />
      {allocations.length > 0 && (
        <Section title="Each invoice line and the PO line it bills">
          <LineAllocations allocations={allocations} />
        </Section>
      )}
      {!byLines && candidates.length > 0 && (
        <Section title={data.assist ? "Candidate POs, as the code scored them" : "Candidate POs"}>
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead className="text-right">Remaining balance</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((candidate, index) => (
                  <TableRow key={index} className={chosen.has(String(candidate.po_number)) ? "bg-emerald-50/60" : undefined}>
                    <TableCell className="font-mono text-[12px]">{text(candidate.po_number)}</TableCell>
                    <TableCell className="num text-right">{money(candidate.remaining, currency)}</TableCell>
                    <TableCell>
                      <Signals value={candidate.signals} />
                    </TableCell>
                    <TableCell>
                      <Score value={candidate.score} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
      {assist && oldSelection && (
        <Section title="PO selection by Jev (the code could not choose the PO)">
          <JevSelection data={assist} currency={currency} />
        </Section>
      )}
      {assist && !oldSelection && (
        <Section title="Jev">
          <Fields
            columns={3}
            items={[
              ["Asked about", Array.isArray(assist.asked) && assist.asked.length ? `invoice line ${(assist.asked as unknown[]).map(String).join(", ")}` : "—"],
              ["Answer", assist.state === "answered" ? "Answered" : `Not used: ${text(assist.reason)}`],
              ["Jev answer", assist.mode === "live" ? "Live" : "Recorded"],
            ]}
          />
        </Section>
      )}
      <Remaining data={data} handled={["po_number", "others", "method", "signals", "score", "needed", "candidates", "assist", "pool", "allocations"]} />
    </div>
  );
}

const BANK_STATE: Record<string, { label: string; tone: Tone }> = {
  matched: { label: "Matches the vendor master", tone: "green" },
  mismatched: { label: "Differs from the vendor master", tone: "red" },
  absent: { label: "Not printed: master account used", tone: "neutral" },
};

function BankEvidence({ data }: RendererProps) {
  const state = BANK_STATE[String(data.state)];
  return (
    <div className="space-y-3">
      <Fields
        columns={3}
        items={[
          ["Result", state ? <Badge tone={state.tone}>{state.label}</Badge> : text(data.state)],
          ["Account on the invoice", <span className="font-mono text-[12px]">{text(data.invoice_account)}</span>],
          ["Account in the vendor master", <span className="font-mono text-[12px]">{text(data.master_account)}</span>],
        ]}
      />
      <Remaining data={data} handled={["vendor_id", "state", "invoice_account", "master_account"]} />
    </div>
  );
}

function AmountsEvidence({ data, currency }: RendererProps) {
  const lines = asList(data.lines);
  const parts = asList(data.parts);
  const variance = toNumber(data.variance);
  return (
    <div className="space-y-3">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="rounded-md border border-slate-200">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-slate-600">Invoice amount (taxable value)</TableCell>
                <TableCell className="num text-right">{money(data.invoice_amount, currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-slate-600">{parts.length > 0 ? "Remaining before, all POs" : "PO remaining before"}</TableCell>
                <TableCell className="num text-right">{money(data.remaining_before, currency)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-slate-600">Variance</TableCell>
                <TableCell className={cn("num text-right", variance !== null && variance > 0 && "text-red-700")}>
                  {money(data.variance, currency, { signed: true })}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-slate-600">Tolerance</TableCell>
                <TableCell className="num text-right">{money(data.tolerance, currency)}</TableCell>
              </TableRow>
              <TableRow className="bg-slate-50">
                <TableCell className="font-medium">Within tolerance</TableCell>
                <TableCell className="text-right">
                  <YesNo value={data.within} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <Fields
          columns={1}
          items={[
            ["Checked at", data.level === "line" ? "Line level (quantity and unit price)" : data.level === "header" ? "Header level only" : text(data.level)],
            ["Basis", data.basis === "taxable_value" ? "Taxable value (before tax)" : text(data.basis)],
          ]}
        />
      </div>
      {parts.length > 0 && (
        <Section title="Share of the invoice on each PO">
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO</TableHead>
                  <TableHead className="text-right">Invoice share</TableHead>
                  <TableHead className="text-right">Remaining before</TableHead>
                  <TableHead className="text-right">Remaining after</TableHead>
                  <TableHead className="text-right">Tolerance</TableHead>
                  <TableHead className="text-center">Within balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parts.map((part, index) => {
                  const before = toNumber(part.remaining_before);
                  const share = toNumber(part.invoice_amount);
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-[12px]">{text(part.po_number)}</TableCell>
                      <TableCell className="num text-right">{money(part.invoice_amount, currency)}</TableCell>
                      <TableCell className="num text-right">{money(part.remaining_before, currency)}</TableCell>
                      <TableCell className="num text-right">{before !== null && share !== null ? money(before - share, currency) : "—"}</TableCell>
                      <TableCell className="num text-right">{money(part.tolerance, currency)}</TableCell>
                      <TableCell className="text-center">
                        <YesNo value={part.within} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
      {lines.length > 0 && (
        <Section title="Line checks">
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice line</TableHead>
                  {parts.length > 0 && <TableHead>PO</TableHead>}
                  <TableHead className="text-right">PO line</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">Already invoiced</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">PO price</TableHead>
                  <TableHead className="text-center">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>{text(line.description)}</TableCell>
                    {parts.length > 0 && <TableCell className="font-mono text-[12px]">{text(line.po_number)}</TableCell>}
                    <TableCell className="num text-right">{text(line.po_line)}</TableCell>
                    <TableCell className="num text-right">{quantity(line.quantity)}</TableCell>
                    <TableCell className="num text-right">{quantity(line.ordered)}</TableCell>
                    <TableCell className="num text-right">{quantity(line.consumed_before)}</TableCell>
                    <TableCell className="num text-right">{money(line.unit_price, currency)}</TableCell>
                    <TableCell className="num text-right">{money(line.po_price, currency)}</TableCell>
                    <TableCell className="text-center">
                      <YesNo value={line.ok} yes="OK" no="Fails" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
      <Remaining data={data} handled={["basis", "invoice_amount", "remaining_before", "variance", "tolerance", "within", "level", "lines", "parts"]} />
    </div>
  );
}

const VERDICT: Record<string, { label: string; tone: "green" | "red" | "amber" }> = {
  none: { label: "No duplicate found", tone: "green" },
  exact: { label: "Exact duplicate", tone: "red" },
  suspected: { label: "Suspected duplicate", tone: "amber" },
};

function DuplicateEvidence({ data }: RendererProps) {
  const verdict = VERDICT[String(data.verdict)];
  const prior = typeof data.prior_run === "string" && data.prior_run ? data.prior_run : null;
  return (
    <>
      <Fields
        items={[
          ["Verdict", verdict ? <Badge tone={verdict.tone}>{verdict.label}</Badge> : text(data.verdict)],
          [
            "Earlier run",
            prior ? (
              <Link to={`/runs/${prior}`} className="inline-flex items-center gap-1 font-mono text-[12px] text-sky-700 underline-offset-2 hover:underline">
                {prior}
                <ExternalLink className="h-3 w-3" />
              </Link>
            ) : (
              <span className="text-slate-400">—</span>
            ),
          ],
        ]}
      />
      <Remaining data={data} handled={["verdict", "prior_run"]} />
    </>
  );
}

const GATE_NAME: Record<string, string> = {
  vendor: "1. Vendor identified",
  bank: "2. Payee account verified",
  po: "3. Purchase order matched",
  amount: "4. Amount cleared",
};

function DecisionEvidence({ data, currency, run }: RendererProps) {
  const { outcome, summary, reasons } = run;
  const update = asData(data.update);
  const updates = update ? [update, ...asList(data.others)] : [];
  const gates = asList(data.gates);

  return (
    <div className="space-y-3">
      <Fields items={[["Outcome", <OutcomeBadge outcome={outcome} />], ["Summary", text(summary)]]} />
      {gates.length > 0 && (
        <Section title="The four checks an approval needs">
          <div className="rounded-md border border-slate-200">
            <Table>
              <TableBody>
                {gates.map((gate, index) => (
                  <TableRow key={index}>
                    <TableCell className="w-40 font-medium text-slate-700">{GATE_NAME[String(gate.name)] ?? text(gate.name)}</TableCell>
                    <TableCell className="w-28">
                      <YesNo value={gate.passed} yes="Passed" no="Not passed" />
                    </TableCell>
                    <TableCell className="text-slate-600">{text(gate.detail)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Section>
      )}
      <Section title="Reasons, most serious first">
        {reasons.length === 0 ? <p className="text-[13px] text-slate-500">No findings.</p> : <FindingList findings={reasons} />}
      </Section>
      <Section title="PO update">
        {updates.length > 0 ? (
          <div className="space-y-2">
            {updates.map((each, index) => {
              const quantities = asData(each.quantities);
              return (
                <Fields
                  key={index}
                  columns={4}
                  items={[
                    ["Purchase order", <span className="font-mono text-[12px]">{text(each.po_number)}</span>],
                    ["Amount consumed", money(each.amount, currency)],
                    ["Remaining after", money(each.remaining_after, currency)],
                    [
                      "Quantities by PO line",
                      quantities && Object.keys(quantities).length > 0
                        ? Object.entries(quantities)
                            .map(([line, qty]) => `Line ${line}: ${quantity(qty)}`)
                            .join(", ")
                        : "—",
                    ],
                  ]}
                />
              );
            })}
          </div>
        ) : (
          <p className="text-[13px] text-slate-500">
            <Minus className="mr-1 inline h-3 w-3" />
            The PO balance is not changed unless the invoice is approved against a matched PO.
          </p>
        )}
      </Section>
      <Remaining data={data} handled={["update", "others", "gates"]} />
    </div>
  );
}

function PersistEvidence({ data, currency }: RendererProps) {
  const order = typeof data.po_updated === "string" && data.po_updated ? data.po_updated : null;
  const others = asList(data.others);
  return (
    <>
      <Fields
        columns={3}
        items={[
          ["Invoice register", data.registered === true ? "Recorded" : data.registered === false ? "Not recorded" : "—"],
          ["PO balance", order ? <span>Updated <span className="font-mono text-[12px]">{order}</span></span> : "Unchanged"],
          ["Left on PO after", order ? money(data.remaining_after, currency) : "—"],
          ...others.flatMap(
            (other): Field[] => [
              [`Also updated: ${text(other.po_updated)}`, "PO balance"],
              [`Left on ${text(other.po_updated)} after`, money(other.remaining_after, currency)],
            ],
          ),
        ]}
      />
      <Remaining data={data} handled={["registered", "po_updated", "remaining_after", "others"]} />
    </>
  );
}

function GenericEvidence({ data }: RendererProps) {
  return <GenericFields data={data} />;
}

const RENDERERS: Record<StepName, (props: RendererProps) => ReactNode> = {
  intake: IntakeEvidence,
  extraction: ExtractionEvidence,
  validation: ValidationEvidence,
  vendor: VendorEvidence,
  bank: BankEvidence,
  po: OrderEvidence,
  amounts: AmountsEvidence,
  duplicate: DuplicateEvidence,
  decision: DecisionEvidence,
  persist: PersistEvidence,
};

export function hasEvidence(data: Data): boolean {
  return Object.keys(data).some((key) => key !== "findings");
}

export function Evidence({ name, data, currency, run }: { name: StepName; data: Data; currency: string | null; run: RunFacts }) {
  const [raw, setRaw] = useState(false);
  const Renderer = RENDERERS[name] ?? GenericEvidence;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-3">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setRaw((value) => !value)}
          className="rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-500 ring-1 ring-slate-200 hover:bg-white hover:text-slate-800"
        >
          {raw ? "Formatted" : "Raw JSON"}
        </button>
      </div>
      {raw ? (
        <pre className="max-h-96 overflow-auto rounded bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <Renderer data={data} currency={currency} run={run} />
      )}
    </div>
  );
}
