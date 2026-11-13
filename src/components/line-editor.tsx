import { Plus, Trash2 } from "lucide-react";
import { money, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/form";
import { cn } from "@/lib/utils";

export const LINE_FIELDS = ["text", "qty", "unit", "price", "tax"] as const;
export type LineField = (typeof LINE_FIELDS)[number];
export type LineDraft = Record<LineField, string> & { key: number };
export type LineErrors = Partial<Record<LineField, string>>;

const LINE_LABELS: Record<LineField, string> = { text: "Description", qty: "Quantity", unit: "Unit", price: "Unit price", tax: "Tax %" };
const LINE_GRID = "md:grid-cols-[minmax(0,1fr)_5rem_4.5rem_6.5rem_4.5rem_7rem_2rem]";
const NUMERIC: ReadonlySet<LineField> = new Set(["qty", "price", "tax"]);

let lastKey = 0;

export function newLine(values?: Partial<Record<LineField, string>>): LineDraft {
  lastKey += 1;
  return { key: lastKey, text: "", qty: "", unit: "pcs", price: "", tax: "", ...values };
}

export function defaultTax(country: string | undefined): string {
  return country === "IN" ? "18" : "";
}

export function withDefaultTax(lines: LineDraft[], country: string | undefined): LineDraft[] {
  const tax = defaultTax(country);
  return lines.map((line) => (line.tax.trim() === "" ? { ...line, tax } : line));
}

export function lineAmounts(line: LineDraft): { net: number; tax: number } {
  const net = (toNumber(line.qty) ?? 0) * (toNumber(line.price) ?? 0);
  return { net, tax: (net * (toNumber(line.tax) ?? 0)) / 100 };
}

export function sumLines(lines: LineDraft[]): { net: number; tax: number } {
  return lines.map(lineAmounts).reduce((sum, amount) => ({ net: sum.net + amount.net, tax: sum.tax + amount.tax }), { net: 0, tax: 0 });
}

interface LineEditorProps {
  idPrefix: string;
  lines: LineDraft[];
  errors?: Record<number, LineErrors>;
  error?: string;
  currency: string | null;
  required?: boolean;
  onChange: (lines: LineDraft[]) => void;
  onEdit?: (key: number, field: LineField) => void;
}

export function LineEditor({ idPrefix, lines, errors = {}, error, currency, required = false, onChange, onEdit }: LineEditorProps) {
  const errorId = `${idPrefix}-lines-error`;

  const edit = (key: number, field: LineField, value: string) => {
    onChange(lines.map((line) => (line.key === key ? { ...line, [field]: value } : line)));
    onEdit?.(key, field);
  };

  return (
    <fieldset className="space-y-2" aria-describedby={error ? errorId : undefined}>
      <legend className="mb-1 text-xs font-medium text-slate-700">Lines</legend>
      <div aria-hidden="true" className={cn("hidden gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid", LINE_GRID)}>
        {LINE_FIELDS.map((field) => (
          <span key={field} className={cn(NUMERIC.has(field) && "text-right")}>
            {LINE_LABELS[field]}
          </span>
        ))}
        <span className="text-right">Amount</span>
        <span />
      </div>
      <ol className="space-y-2">
        {lines.map((line, index) => {
          const position = index + 1;
          const problems = errors[line.key] ?? {};
          return (
            <li key={line.key} className={cn("grid grid-cols-2 items-start gap-2 rounded-md border border-slate-200 p-2 md:border-0 md:p-0", LINE_GRID)}>
              {LINE_FIELDS.map((field) => (
                <Field
                  key={field}
                  id={`${idPrefix}-line-${line.key}-${field}`}
                  label={`${LINE_LABELS[field]}, line ${position}`}
                  labelClassName="md:sr-only"
                  className={cn(field === "text" && "col-span-2 md:col-span-1", "md:space-y-0.5", NUMERIC.has(field) && "[&_input]:text-right")}
                  value={line[field]}
                  error={problems[field]}
                  required={required && (field === "text" || field === "qty" || field === "price")}
                  inputMode={NUMERIC.has(field) ? "decimal" : undefined}
                  onChange={(event) => edit(line.key, field, event.target.value)}
                />
              ))}
              <div className="num flex h-8 items-center justify-start text-sm text-slate-700 md:justify-end">
                <span className="mr-1 text-xs text-slate-500 md:sr-only">Amount</span>
                {money(lineAmounts(line).net, currency)}
              </div>
              <div className="flex h-8 items-center justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(lines.filter((item) => item.key !== line.key))}
                  disabled={lines.length <= 1}
                  aria-label={`Remove line ${position}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {error && (
        <p id={errorId} className="text-xs text-red-700">
          {error}
        </p>
      )}
      <Button variant="outline" size="sm" onClick={() => onChange([...lines, newLine()])}>
        <Plus className="h-3.5 w-3.5" />
        Add line
      </Button>
    </fieldset>
  );
}

export function TotalsBar({ items, currency }: { items: { label: string; value: number; strong?: boolean }[]; currency: string | null }) {
  return (
    <dl className="flex flex-wrap justify-end gap-x-6 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
      {items.map((item) => (
        <div key={item.label} className="flex gap-2">
          <dt className="text-slate-600">{item.label}</dt>
          <dd className={cn("num", item.strong && "font-semibold")}>{money(item.value, currency)}</dd>
        </div>
      ))}
    </dl>
  );
}
