import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy } from "lucide-react";
import { api, type NewOrderLine, type NewVendor, type OrderRow, type VendorRow } from "@/lib/api";
import { money, percent, toNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorNote } from "@/components/error-note";
import { blank, errorText, Field, focusFirstInvalid, FormFooter, INPUT_CLASS, today } from "@/components/form";
import { LineEditor, newLine, sumLines, TotalsBar, withDefaultTax, type LineDraft, type LineErrors } from "@/components/line-editor";
import { OrderStatusBadge } from "@/components/order-status";
import { cn } from "@/lib/utils";

export function MasterPage() {
  const [vendors, setVendors] = useState<VendorRow[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([api.vendors(), api.orders()])
      .then(([nextVendors, nextOrders]) => {
        if (!active) return;
        setVendors(nextVendors);
        setOrders(nextOrders);
      })
      .catch((failure: unknown) => {
        if (active) setLoadError(errorText(failure, "Could not load the master data."));
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Master data</h1>
        <p className="text-sm text-slate-600">
          The vendors and purchase orders that invoices are checked against. Anything added here lasts until “Reset demo data” is pressed on the
          Process page.
        </p>
      </div>

      <ErrorNote message={loadError} />

      <VendorsCard vendors={vendors} loading={vendors === null && !loadError} onCreated={(vendor) => setVendors((rows) => [...(rows ?? []), vendor])} />

      <OrdersCard
        orders={orders}
        vendors={vendors ?? []}
        loading={orders === null && !loadError}
        onCreated={(order) => setOrders((rows) => [...(rows ?? []).filter((row) => row.po !== order.po), order])}
      />
    </div>
  );
}

const VENDOR_FIELDS = ["name", "country", "tax_id", "account", "bank_code", "bank", "currency", "tolerance"] as const;
type VendorField = (typeof VENDOR_FIELDS)[number];
type VendorDraft = Record<VendorField, string>;
type VendorErrors = Partial<Record<VendorField, string>>;

const EMPTY_VENDOR: VendorDraft = { name: "", country: "IN", tax_id: "", account: "", bank_code: "", bank: "", currency: "INR", tolerance: "" };

const VENDOR_LABELS: Record<VendorField, string> = {
  name: "Legal name",
  country: "Country",
  tax_id: "Tax ID",
  account: "Account number",
  bank_code: "Bank code",
  bank: "Bank name",
  currency: "Currency",
  tolerance: "Tolerance % (optional)",
};

function checkVendor(draft: VendorDraft): { errors: VendorErrors; payload: NewVendor | null } {
  const errors: VendorErrors = {};
  for (const field of VENDOR_FIELDS) {
    if (field !== "tolerance" && blank(draft[field])) errors[field] = "Required.";
  }
  const tolerance = toNumber(draft.tolerance);
  if (!blank(draft.tolerance) && (tolerance === null || tolerance < 0 || tolerance > 100)) errors.tolerance = "Enter a percentage from 0 to 100.";
  if (Object.keys(errors).length > 0) return { errors, payload: null };

  const payload: NewVendor = {
    name: draft.name.trim(),
    country: draft.country.trim().toUpperCase(),
    tax_id: draft.tax_id.trim().toUpperCase(),
    account: draft.account.replace(/\s+/g, ""),
    bank_code: draft.bank_code.trim().toUpperCase(),
    bank: draft.bank.trim(),
    currency: draft.currency.trim().toUpperCase(),
  };
  if (tolerance !== null) payload.tolerance = tolerance;
  return { errors, payload };
}

function maskAccount(account: string) {
  return (
    <span className="num relative whitespace-nowrap font-mono text-[12px]">
      <span aria-hidden="true" className="text-slate-400">
        ••••{" "}
      </span>
      <span className="sr-only">ending </span>
      {account.slice(-4)}
    </span>
  );
}

interface VendorsCardProps {
  vendors: VendorRow[] | null;
  loading: boolean;
  onCreated: (vendor: VendorRow) => void;
}

function VendorsCard({ vendors, loading, onCreated }: VendorsCardProps) {
  const [draft, setDraft] = useState<VendorDraft>(EMPTY_VENDOR);
  const [errors, setErrors] = useState<VendorErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<VendorRow | null>(null);
  const [busy, setBusy] = useState(false);

  const edit = (field: VendorField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const { errors: found, payload } = checkVendor(draft);
    setErrors(found);
    setServerError(null);
    setCreated(null);
    if (!payload) {
      focusFirstInvalid(form);
      return;
    }
    setBusy(true);
    try {
      const vendor = await api.createVendor(payload);
      onCreated(vendor);
      setCreated(vendor);
      setDraft(EMPTY_VENDOR);
    } catch (failure) {
      setServerError(errorText(failure, "Could not add the vendor."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vendors</CardTitle>
        {vendors && <span className="text-xs text-slate-500">{vendors.length} on file</span>}
      </CardHeader>

      <CardContent className="space-y-3 border-b border-slate-200">
        <h3 id="vendor-form-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add vendor
        </h3>
        <form
          noValidate
          aria-labelledby="vendor-form-title"
          aria-describedby={serverError ? "vendor-form-server-error" : undefined}
          onSubmit={(event) => void submit(event)}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {VENDOR_FIELDS.map((field) => (
              <Field
                key={field}
                id={`vendor-${field}`}
                label={VENDOR_LABELS[field]}
                value={draft[field]}
                error={errors[field]}
                required={field !== "tolerance"}
                inputMode={field === "tolerance" ? "decimal" : undefined}
                maxLength={field === "country" ? 2 : field === "currency" ? 3 : undefined}
                onChange={(event) => edit(field, event.target.value)}
              />
            ))}
          </div>
          <FormFooter formId="vendor-form" busy={busy} label="Add vendor" serverError={serverError} />
        </form>
        <p role="status" className="text-sm text-emerald-800 empty:hidden">
          {created && (
            <>
              <Check className="mr-1 inline h-4 w-4 align-[-3px]" aria-hidden="true" />
              Vendor <span className="font-mono font-semibold">{created.id}</span> ({created.name}) added.
            </>
          )}
        </p>
      </CardContent>

      {loading && <CardContent className="text-sm text-slate-500">Loading vendors…</CardContent>}
      {vendors && (
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Tax ID</TableHead>
              <TableHead>Bank account</TableHead>
              <TableHead>Bank code</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Tolerance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((vendor) => (
              <TableRow key={vendor.id} className={cn(created?.id === vendor.id && "bg-emerald-50/60")}>
                <TableCell className="whitespace-nowrap font-mono text-[12px]">{vendor.id}</TableCell>
                <TableCell className="max-w-56 truncate font-medium" title={vendor.name}>
                  {vendor.name}
                </TableCell>
                <TableCell>{vendor.country}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-[12px]">{vendor.tax_id}</TableCell>
                <TableCell>{maskAccount(vendor.account)}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-[12px]" title={vendor.bank}>
                  {vendor.bank_code}
                </TableCell>
                <TableCell>{vendor.currency}</TableCell>
                <TableCell>
                  <Badge tone={vendor.status === "approved" ? "green" : "red"}>{vendor.status === "approved" ? "Approved" : "Suspended"}</Badge>
                </TableCell>
                <TableCell className="num whitespace-nowrap text-right">
                  {vendor.tolerance === null ? <span className="text-slate-400">Default</span> : percent(vendor.tolerance)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

interface OrderCheck {
  vendorError?: string;
  dateError?: string;
  lineErrors: Record<number, LineErrors>;
  lines: NewOrderLine[] | null;
}

function checkOrder(vendorId: string, date: string, lines: LineDraft[]): OrderCheck {
  const lineErrors: Record<number, LineErrors> = {};
  const payload: NewOrderLine[] = [];
  for (const line of lines) {
    const problems: LineErrors = {};
    const qty = toNumber(line.qty);
    const price = toNumber(line.price);
    const tax = toNumber(line.tax);
    if (blank(line.text)) problems.text = "Required.";
    if (qty === null || qty <= 0) problems.qty = blank(line.qty) ? "Required." : "Must be above 0.";
    if (price === null || price <= 0) problems.price = blank(line.price) ? "Required." : "Must be above 0.";
    if (!blank(line.tax) && (tax === null || tax < 0 || tax > 100)) problems.tax = "0 to 100.";
    if (Object.keys(problems).length > 0 || qty === null || price === null) {
      lineErrors[line.key] = problems;
      continue;
    }
    const row: NewOrderLine = { text: line.text.trim(), qty, price };
    if (!blank(line.unit)) row.unit = line.unit.trim();
    if (tax !== null) row.tax = tax;
    payload.push(row);
  }
  const vendorError = vendorId ? undefined : "Choose a vendor.";
  const dateError = date ? undefined : "Required.";
  const valid = !vendorError && !dateError && Object.keys(lineErrors).length === 0;
  return { vendorError, dateError, lineErrors, lines: valid ? payload : null };
}

interface OrdersCardProps {
  orders: OrderRow[] | null;
  vendors: VendorRow[];
  loading: boolean;
  onCreated: (order: OrderRow) => void;
}

function OrdersCard({ orders, vendors, loading, onCreated }: OrdersCardProps) {
  const [vendorId, setVendorId] = useState("");
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [check, setCheck] = useState<OrderCheck>({ lineErrors: {}, lines: null });
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<OrderRow | null>(null);
  const [busy, setBusy] = useState(false);

  const approved = useMemo(() => vendors.filter((vendor) => vendor.status === "approved"), [vendors]);
  const currency = approved.find((vendor) => vendor.id === vendorId)?.currency ?? null;
  const totals = useMemo(() => sumLines(lines), [lines]);

  const clearLineError = (key: number, field: keyof LineErrors) => {
    setCheck((current) => ({ ...current, lineErrors: { ...current.lineErrors, [key]: { ...current.lineErrors[key], [field]: undefined } } }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const result = checkOrder(vendorId, date, lines);
    setCheck(result);
    setServerError(null);
    setCreated(null);
    if (!result.lines) {
      focusFirstInvalid(form);
      return;
    }
    setBusy(true);
    try {
      const order = await api.createOrder({ vendor_id: vendorId, date, lines: result.lines });
      onCreated(order);
      setCreated(order);
      setVendorId("");
      setDate(today());
      setLines([newLine()]);
    } catch (failure) {
      setServerError(errorText(failure, "Could not add the purchase order."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase orders</CardTitle>
        <span className="text-xs text-slate-500">Amounts before tax</span>
      </CardHeader>

      <CardContent className="space-y-3 border-b border-slate-200">
        <h3 id="order-form-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Add purchase order
        </h3>
        <form
          noValidate
          aria-labelledby="order-form-title"
          aria-describedby={serverError ? "order-form-server-error" : undefined}
          onSubmit={(event) => void submit(event)}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] lg:grid-cols-[minmax(0,28rem)_11rem]">
            <div className="min-w-0 space-y-1">
              <label htmlFor="order-vendor" className="block text-xs font-medium text-slate-700">
                Vendor
              </label>
              <select
                id="order-vendor"
                required
                value={vendorId}
                aria-invalid={check.vendorError ? true : undefined}
                aria-describedby="order-vendor-note"
                onChange={(event) => {
                  const picked = approved.find((vendor) => vendor.id === event.target.value);
                  setVendorId(event.target.value);
                  setLines((current) => withDefaultTax(current, picked?.country));
                  setCheck((current) => ({ ...current, vendorError: undefined }));
                }}
                className={INPUT_CLASS}
              >
                <option value="">Choose a vendor</option>
                {approved.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.id} · {vendor.name} ({vendor.currency})
                  </option>
                ))}
              </select>
              <p id="order-vendor-note" className={cn("text-xs", check.vendorError ? "text-red-700" : "text-slate-500")}>
                {check.vendorError ?? "Approved vendors only."}
              </p>
            </div>
            <Field
              id="order-date"
              label="Date"
              type="date"
              required
              value={date}
              error={check.dateError}
              onChange={(event) => {
                setDate(event.target.value);
                setCheck((current) => ({ ...current, dateError: undefined }));
              }}
            />
          </div>

          <LineEditor idPrefix="order" lines={lines} errors={check.lineErrors} currency={currency} required onChange={setLines} onEdit={clearLineError} />

          <TotalsBar
            currency={currency}
            items={[
              { label: "PO total before tax", value: totals.net, strong: true },
              { label: "Tax", value: totals.tax },
              { label: "With tax", value: totals.net + totals.tax },
            ]}
          />

          <FormFooter formId="order-form" busy={busy} label="Add purchase order" serverError={serverError} />
        </form>
        <div role="status" className="empty:hidden">
          {created && <CreatedOrder key={created.po} order={created} />}
        </div>
      </CardContent>

      {loading && <CardContent className="text-sm text-slate-500">Loading purchase orders…</CardContent>}
      {orders && (
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead>PO number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Used</TableHead>
              <TableHead className="text-right">Left</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.po} className={cn(created?.po === order.po && "bg-emerald-50/60")}>
                <TableCell className="whitespace-nowrap font-mono text-[12px]">{order.po}</TableCell>
                <TableCell className="max-w-56 truncate" title={order.vendor}>
                  {order.vendor}
                </TableCell>
                <TableCell>{order.currency}</TableCell>
                <TableCell className="num whitespace-nowrap text-right">{money(order.total, order.currency)}</TableCell>
                <TableCell className="num whitespace-nowrap text-right">{money(order.used, order.currency)}</TableCell>
                <TableCell className={cn("num whitespace-nowrap text-right font-medium", (toNumber(order.left) ?? 0) < 0 && "text-red-700")}>
                  {money(order.left, order.currency)}
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

function CreatedOrder({ order }: { order: OrderRow }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(order.po);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-900">
      <p className="text-xs">Purchase order created. Write this PO number on the invoice:</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="font-mono text-lg font-semibold tracking-wide">{order.po}</span>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-emerald-800">
        {order.vendor} · {money(order.total, order.currency)} before tax · {order.lines.length} {order.lines.length === 1 ? "line" : "lines"}
      </p>
    </div>
  );
}
