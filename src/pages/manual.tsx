import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Play } from "lucide-react";
import { api, type ManualInvoice, type ManualLine, type ManualTaxLine, type OrderRow, type VendorRow } from "@/lib/api";
import { money, toNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorNote } from "@/components/error-note";
import { blank, errorText, Field, FormFooter, Picker, today } from "@/components/form";
import { LineEditor, newLine, withDefaultTax, type LineDraft } from "@/components/line-editor";

const SUPPLIER_FIELDS = ["name", "tax_id", "account", "bank_code", "bank"] as const;
type SupplierField = (typeof SUPPLIER_FIELDS)[number];
type Supplier = Record<SupplierField, string>;

const SUPPLIER_LABELS: Record<SupplierField, string> = {
  name: "Supplier name",
  tax_id: "Tax ID",
  account: "Bank account number",
  bank_code: "Bank code",
  bank: "Bank name",
};

const EMPTY_SUPPLIER: Supplier = { name: "", tax_id: "", account: "", bank_code: "", bank: "" };

interface InvoiceHead {
  number: string;
  date: string;
  currency: string;
  po: string;
}

const ORDER_STATUS_TEXT: Record<string, string> = {
  open: "open",
  partially_invoiced: "partly invoiced",
  fully_invoiced: "fully invoiced",
  cancelled: "cancelled",
};

const cents = (value: number) => Math.round(value * 100) / 100;

function priced(line: LineDraft): { qty: number; price: number } | null {
  const qty = toNumber(line.qty);
  const price = toNumber(line.price);
  return qty === null || price === null ? null : { qty, price };
}

function processable(line: LineDraft): boolean {
  return !blank(line.text) && priced(line) !== null;
}

function touched(line: LineDraft): boolean {
  return !blank(line.text) || !blank(line.qty) || !blank(line.price);
}

interface Totals {
  subtotal: number;
  tax: number;
  taxLines: ManualTaxLine[];
}

function computeTotals(lines: LineDraft[]): Totals {
  const byRate = new Map<number, number>();
  let subtotal = 0;
  for (const line of lines) {
    const amounts = priced(line);
    if (!amounts) continue;
    const net = cents(amounts.qty * amounts.price);
    subtotal += net;
    const rate = toNumber(line.tax);
    if (rate !== null) byRate.set(rate, (byRate.get(rate) ?? 0) + (net * rate) / 100);
  }
  const taxLines = [...byRate.entries()].map(([rate, amount]) => ({ label: "Tax", rate_pct: String(rate), amount: cents(amount).toFixed(2) }));
  const tax = taxLines.reduce((sum, row) => sum + Number(row.amount), 0);
  return { subtotal: cents(subtotal), tax: cents(tax), taxLines };
}

function plainNumber(value: string): string {
  const parsed = toNumber(value);
  return parsed === null ? value.trim() : String(parsed);
}

function buildInvoice(supplier: Supplier, head: InvoiceHead, lines: LineDraft[], totals: Totals): ManualInvoice {
  const rows: ManualLine[] = lines.filter(touched).map((line) => {
    const amounts = priced(line);
    return {
      description: line.text.trim(),
      quantity: plainNumber(line.qty),
      unit: line.unit.trim(),
      unit_price: plainNumber(line.price),
      line_amount: amounts ? cents(amounts.qty * amounts.price).toFixed(2) : "",
      tax_rate_pct: plainNumber(line.tax),
    };
  });
  return {
    supplier_name: supplier.name.trim(),
    supplier_tax_id: supplier.tax_id.trim(),
    supplier_address: "",
    supplier_email: "",
    bank_account_name: "",
    bank_account_number: supplier.account.trim(),
    bank_code: supplier.bank_code.trim(),
    bank_name: supplier.bank.trim(),
    buyer_name: "",
    buyer_tax_id: "",
    invoice_number: head.number.trim(),
    invoice_date: head.date,
    due_date: "",
    currency: head.currency.trim(),
    po_reference_text: head.po.trim(),
    prices_include_tax: false,
    lines: rows,
    subtotal: totals.subtotal.toFixed(2),
    tax_lines: totals.taxLines,
    total: cents(totals.subtotal + totals.tax).toFixed(2),
  };
}

function supplierOf(vendor: VendorRow): Supplier {
  return { name: vendor.name, tax_id: vendor.tax_id, account: vendor.account, bank_code: vendor.bank_code, bank: vendor.bank };
}

function remainingLines(order: OrderRow): LineDraft[] {
  const lines = order.lines.map((line) => {
    const left = Math.max(0, (toNumber(line.qty) ?? 0) - (toNumber(line.used) ?? 0));
    const price = toNumber(line.price);
    const tax = toNumber(line.tax);
    return newLine({ text: line.text, qty: String(left), price: price === null ? "" : String(price), tax: tax === null ? "" : String(tax) });
  });
  return lines.length > 0 ? lines : [newLine()];
}

export function ManualPage() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<Supplier>(EMPTY_SUPPLIER);
  const [head, setHead] = useState<InvoiceHead>(() => ({ number: "", date: today(), currency: "INR", po: "" }));
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [linesError, setLinesError] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([api.vendors(), api.orders()])
      .then(([nextVendors, nextOrders]) => {
        if (!active) return;
        setVendors(nextVendors);
        setOrders(nextOrders);
      })
      .catch((failure: unknown) => {
        if (active) setLoadError(`${errorText(failure, "Could not load vendors and purchase orders.")} You can still type every field.`);
      });
    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => computeTotals(lines), [lines]);
  const currency = blank(head.currency) ? null : head.currency.trim().toUpperCase();

  const fillFromVendor = (id: string) => {
    const vendor = vendors.find((item) => item.id === id);
    if (!vendor) return;
    setSupplier(supplierOf(vendor));
    setHead((current) => ({ ...current, currency: vendor.currency }));
    setLines((current) => withDefaultTax(current, vendor.country));
  };

  const fillFromOrder = (po: string) => {
    const order = orders.find((item) => item.po === po);
    if (!order) return;
    setHead((current) => ({ ...current, po: order.po, currency: order.currency }));
    setLines(remainingLines(order));
    setLinesError(undefined);
    const vendor = vendors.find((item) => item.name === order.vendor);
    if (vendor && SUPPLIER_FIELDS.every((field) => blank(supplier[field]))) setSupplier(supplierOf(vendor));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setServerError(null);
    if (!lines.some(processable)) {
      setLinesError("Nothing to process yet: add at least one line with a description, a quantity and a unit price.");
      document.getElementById(`manual-line-${lines[0]?.key ?? 0}-text`)?.focus();
      return;
    }
    setLinesError(undefined);
    setBusy(true);
    try {
      const { id } = await api.manualRun(buildInvoice(supplier, head, lines, totals));
      navigate(`/runs/${id}`);
    } catch (failure) {
      setServerError(errorText(failure, "Could not start the run."));
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        Process
      </Link>

      <div>
        <h1 className="text-lg font-semibold">Enter an invoice</h1>
        <p className="text-sm text-slate-600">
          Type the invoice fields by hand and run the same checks, without the model reading a file. Only one thing is required: at least one line with a
          description, quantity and unit price. A wrong bank account, an unknown PO or too many units are not stopped here, so you can see how the
          process handles them.
        </p>
      </div>

      <ErrorNote message={loadError} />

      <form noValidate aria-label="Enter an invoice" aria-describedby={serverError ? "manual-form-server-error" : undefined} onSubmit={(event) => void submit(event)} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Picker
              id="manual-fill-vendor"
              label="Fill from vendor"
              placeholder="Copy a vendor from the master…"
              className="sm:max-w-md"
              options={vendors.map((vendor) => ({
                value: vendor.id,
                label: `${vendor.id} · ${vendor.name}${vendor.status === "suspended" ? " (suspended)" : ""}`,
              }))}
              onPick={fillFromVendor}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {SUPPLIER_FIELDS.map((field) => (
                <Field
                  key={field}
                  id={`manual-supplier-${field}`}
                  label={SUPPLIER_LABELS[field]}
                  value={supplier[field]}
                  onChange={(event) => setSupplier((current) => ({ ...current, [field]: event.target.value }))}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
            <span className="text-xs text-slate-500">Prices before tax</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <Picker
              id="manual-fill-order"
              label="Fill from PO"
              placeholder="Copy a purchase order and what is left on it…"
              className="sm:max-w-md"
              options={orders.map((order) => ({
                value: order.po,
                label: `${order.po} · ${order.vendor} (${ORDER_STATUS_TEXT[order.status] ?? order.status})`,
              }))}
              onPick={fillFromOrder}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                id="manual-number"
                label="Invoice number"
                value={head.number}
                hint="May be left blank to test: the process will hold the invoice."
                onChange={(event) => setHead((current) => ({ ...current, number: event.target.value }))}
              />
              <Field
                id="manual-date"
                label="Invoice date"
                type="date"
                value={head.date}
                onChange={(event) => setHead((current) => ({ ...current, date: event.target.value }))}
              />
              <Field
                id="manual-currency"
                label="Currency"
                value={head.currency}
                maxLength={3}
                onChange={(event) => setHead((current) => ({ ...current, currency: event.target.value }))}
              />
              <Field
                id="manual-po"
                label="PO reference"
                value={head.po}
                hint="Free text, as printed on the invoice."
                onChange={(event) => setHead((current) => ({ ...current, po: event.target.value }))}
              />
            </div>

            <LineEditor
              idPrefix="manual"
              lines={lines}
              error={linesError}
              currency={currency}
              onChange={(next) => {
                setLines(next);
                if (next.some(processable)) setLinesError(undefined);
              }}
            />

            <ManualTotals totals={totals} currency={currency} />
          </CardContent>
        </Card>

        <FormFooter formId="manual-form" busy={busy} label="Process invoice" serverError={serverError} icon={<Play className="h-3.5 w-3.5" />} />
      </form>
    </div>
  );
}

function ManualTotals({ totals, currency }: { totals: Totals; currency: string | null }) {
  const format = (value: number) => money(value, currency);
  return (
    <dl className="ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md bg-slate-50 px-3 py-2 text-sm" aria-live="polite">
      <dt className="text-slate-600">Subtotal</dt>
      <dd className="num text-right">{format(totals.subtotal)}</dd>
      {totals.taxLines.map((row) => (
        <div key={row.rate_pct} className="contents">
          <dt className="text-slate-600">Tax {row.rate_pct}%</dt>
          <dd className="num text-right">{format(Number(row.amount))}</dd>
        </div>
      ))}
      {totals.taxLines.length === 0 && (
        <>
          <dt className="text-slate-600">Tax</dt>
          <dd className="num text-right">{format(0)}</dd>
        </>
      )}
      <dt className="border-t border-slate-200 pt-1 font-medium text-slate-900">Total</dt>
      <dd className="num border-t border-slate-200 pt-1 text-right font-semibold">{format(totals.subtotal + totals.tax)}</dd>
    </dl>
  );
}
