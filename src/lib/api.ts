export type Outcome = "approved" | "needs_attention" | "rejected";
export type RunStatus = "running" | "completed" | "error";
export type StepName =
  | "intake"
  | "extraction"
  | "validation"
  | "vendor"
  | "bank"
  | "duplicate"
  | "po"
  | "amounts"
  | "decision"
  | "persist";
export type StepState = "running" | "done" | "skipped" | "failed";
export type Level = "info" | "warn" | "block";
export type LlmMode = "live" | "recorded";
export type RunMode = LlmMode | "manual";
export type Amount = string | number | null;

export const STEP_ORDER: readonly StepName[] = [
  "intake",
  "extraction",
  "validation",
  "vendor",
  "bank",
  "duplicate",
  "po",
  "amounts",
  "decision",
  "persist",
];

export interface Tokens {
  in: number;
  read: number;
  write: number;
  out: number;
}

export interface FindingRow {
  code: string;
  level: Level;
  text: string;
  data: Record<string, string>;
}

export interface RunRow {
  id: string;
  file: string | null;
  sample: string | null;
  status: RunStatus;
  outcome: Outcome | null;
  vendor_id?: string | null;
  vendor: string | null;
  po: string | null;
  invoice_id?: number | null;
  number: string | null;
  amount: Amount;
  currency: string | null;
  summary: string | null;
  tokens: Tokens | null;
  mode: RunMode;
  at: string;
  ms: number | null;
}

export interface StepRow {
  name: StepName;
  state: StepState;
  ms: number | null;
  data: Record<string, unknown>;
  findings: FindingRow[];
}

export interface RunDetail extends RunRow {
  reasons: FindingRow[];
  steps: StepRow[];
}

export interface OrderLine {
  no: number;
  text: string;
  qty: Amount;
  used: Amount;
  price: Amount;
  tax: Amount;
}

export interface OrderRow {
  po: string;
  vendor: string;
  currency: string;
  status: string;
  total: Amount;
  used: Amount;
  left: Amount;
  lines: OrderLine[];
}

export type VendorStatus = "approved" | "suspended";

export interface VendorRow {
  id: string;
  name: string;
  country: string;
  tax_id: string;
  account: string;
  bank_code: string;
  bank: string;
  currency: string;
  status: VendorStatus;
  tolerance: string | null;
}

export interface NewVendor {
  name: string;
  country: string;
  tax_id: string;
  account: string;
  bank_code: string;
  bank: string;
  currency: string;
  tolerance?: number;
}

export interface NewOrderLine {
  text: string;
  qty: number;
  unit?: string;
  price: number;
  tax?: number;
}

export interface NewOrder {
  vendor_id: string;
  date?: string;
  lines: NewOrderLine[];
}

export interface ManualLine {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  line_amount: string;
  tax_rate_pct: string;
}

export interface ManualTaxLine {
  label: string;
  rate_pct: string;
  amount: string;
}

export interface ManualInvoice {
  supplier_name: string;
  supplier_tax_id: string;
  supplier_address: string;
  supplier_email: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_code: string;
  bank_name: string;
  buyer_name: string;
  buyer_tax_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  currency: string;
  po_reference_text: string;
  prices_include_tax: boolean;
  lines: ManualLine[];
  subtotal: string;
  tax_lines: ManualTaxLine[];
  total: string;
}

export interface SampleRow {
  step: number;
  id: string;
  title: string;
  expect: string;
  outcome: Outcome;
  ran: boolean;
  result: Outcome | null;
}

export interface Meta {
  mode: LlmMode;
  model: string;
}

export interface DoneEvent {
  status: RunStatus;
  outcome: Outcome | null;
  summary: string | null;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function issueText(item: unknown): string {
  if (!item || typeof item !== "object" || !("msg" in item)) return String(item);
  const message = String((item as { msg: unknown }).msg);
  const loc = "loc" in item && Array.isArray((item as { loc: unknown }).loc) ? (item as { loc: unknown[] }).loc : [];
  const place = loc
    .filter((part) => part !== "body")
    .map((part) => (typeof part === "number" ? `row ${part + 1}` : String(part).replace(/_/g, " ")))
    .join(" › ");
  return place ? `${place}: ${message}` : message;
}

function detailMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map(issueText).join("; ");
  }
  return `Request failed with status ${status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, "The API is not reachable. Is the backend running?");
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) throw new ApiError(response.status, detailMessage(body, response.status));
  return body as T;
}

function postJson<T>(path: string, payload: unknown): Promise<T> {
  return request<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

function normaliseFinding(raw: unknown): FindingRow {
  const item = (raw ?? {}) as Record<string, unknown>;
  const level = (item.level ?? "info") as Level;
  const text = String(item.text ?? "");
  const data = (item.data && typeof item.data === "object" ? item.data : {}) as Record<string, string>;
  return { code: String(item.code ?? ""), level, text, data };
}

function normaliseStep(raw: StepRow & { millis?: number | null }): StepRow {
  return {
    name: raw.name,
    state: raw.state,
    ms: raw.ms ?? raw.millis ?? null,
    data: raw.data && typeof raw.data === "object" ? raw.data : {},
    findings: (raw.findings ?? []).map(normaliseFinding),
  };
}

function normaliseDetail(raw: RunDetail): RunDetail {
  return {
    ...raw,
    reasons: (raw.reasons ?? []).map(normaliseFinding),
    steps: (raw.steps ?? []).map(normaliseStep),
  };
}

export const api = {
  meta: () => request<Meta>("/v1/admin/meta"),
  samples: () => request<{ data: SampleRow[] }>("/v1/admin/samples").then((body) => body.data),
  reset: () => request<{ ok: boolean }>("/v1/admin/reset", { method: "POST" }),
  runs: (outcome?: Outcome) =>
    request<{ data: RunRow[] }>(outcome ? `/v1/runs?outcome=${outcome}` : "/v1/runs").then((body) => body.data),
  run: (id: string) => request<RunDetail>(`/v1/runs/${encodeURIComponent(id)}`).then(normaliseDetail),
  orders: () => request<{ data: OrderRow[] }>("/v1/orders").then((body) => body.data),
  vendors: () => request<{ data: VendorRow[] }>("/v1/vendors").then((body) => body.data),
  createVendor: (vendor: NewVendor) => postJson<VendorRow>("/v1/vendors", vendor),
  createOrder: (order: NewOrder) => postJson<OrderRow>("/v1/orders", order),
  runSample: (sample: string) =>
    request<{ id: string }>(`/v1/runs/samples/${encodeURIComponent(sample)}`, { method: "POST" }),
  manualRun: (invoice: ManualInvoice) => postJson<{ id: string }>("/v1/runs/manual", invoice),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ id: string }>("/v1/runs", { method: "POST", body: form });
  },
};

export interface RunStreamHandlers {
  onStep: (step: StepRow) => void;
  onDone: (done: DoneEvent) => void;
  onError: () => void;
}

export function subscribeRun(id: string, handlers: RunStreamHandlers): () => void {
  const source = new EventSource(`/v1/runs/${encodeURIComponent(id)}/events`);
  let finished = false;

  const finish = () => {
    finished = true;
    source.close();
  };

  source.addEventListener("step", (event) => {
    try {
      handlers.onStep(normaliseStep(JSON.parse((event as MessageEvent<string>).data) as StepRow));
    } catch {
      return;
    }
  });

  source.addEventListener("done", (event) => {
    let done: DoneEvent = { status: "completed", outcome: null, summary: null };
    try {
      done = JSON.parse((event as MessageEvent<string>).data) as DoneEvent;
    } catch {
      done = { status: "completed", outcome: null, summary: null };
    }
    finish();
    handlers.onDone(done);
  });

  source.onerror = () => {
    if (finished) return;
    finish();
    handlers.onError();
  };

  return finish;
}
