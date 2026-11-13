import http from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_PORT ?? 8100);
const STEP_DELAY = Number(process.env.MOCK_DELAY ?? 450);
const BUYER = { name: "Meridian Retail Pvt Ltd", tax_id: "29AAGCM4567H1Z9", address: "Bengaluru", email: null };

const SEED_VENDORS = {
  V001: { name: "Acme Supplies Pvt Ltd", country: "IN", tax_id: "29AACCA1234F1Z5", account: "50200012345678", ifsc: "HDFC0001234", bank: "HDFC Bank", currency: "INR", status: "approved", tolerance: null },
  V002: { name: "Zenith Traders LLP", country: "IN", tax_id: "27AAEFZ5678K1Z3", account: "918020045678901", ifsc: "UTIB0000456", bank: "Axis Bank", currency: "INR", status: "approved", tolerance: null },
  V003: { name: "Nova Components Pvt Ltd", country: "IN", tax_id: "33AAECN4321P1Z8", account: "60234567890", ifsc: "SBIN0004321", bank: "State Bank of India", currency: "INR", status: "approved", tolerance: null },
  V004: { name: "Orion Logistics Pvt Ltd", country: "IN", tax_id: "07AABCO8765L1Z2", account: "4012345678", ifsc: "ICIC0000789", bank: "ICICI Bank", currency: "INR", status: "approved", tolerance: null },
  V005: { name: "Pixel Print Studio", country: "IN", tax_id: "29AAJCP2468M1Z4", account: "11223344556", ifsc: "KKBK0000811", bank: "Kotak Mahindra Bank", currency: "INR", status: "approved", tolerance: null },
  V006: { name: "Nova Component Systems Pvt Ltd", country: "IN", tax_id: "33AAHCN9753Q1Z4", account: "30011223344", ifsc: "PUNB0097500", bank: "Punjab National Bank", currency: "INR", status: "suspended", tolerance: null },
  V007: { name: "Global Parts Inc", country: "US", tax_id: "84-1234567", account: "000123456789", ifsc: "CHASUS33", bank: "JPMorgan Chase", currency: "USD", status: "approved", tolerance: null },
};

const SEED_ORDERS = [
  ["PO-2024-0142", "V001", "INR", "Laptop stand (adjustable aluminium)", 50, 1200, 0, false],
  ["PO-2024-0143", "V002", "INR", "Ergonomic office chair", 20, 8500, 0, false],
  ["PO-2024-0144", "V003", "INR", "USB-C docking connector module", 300, 150, 0, false],
  ["PO-2024-0145", "V004", "INR", "Freight - Bengaluru to Mumbai (October)", 1, 80000, 0, false],
  ["PO-2024-0146", "V004", "INR", "Freight - Bengaluru to Delhi (October)", 1, 82000, 0, false],
  ["PO-2024-0147", "V005", "INR", "Product brochure (A4 colour)", 5000, 5, 0, false],
  ["PO-2024-0149", "V005", "INR", "Business cards (box of 100)", 2000, 2.5, 0, true],
  ["PO-2024-0151", "V002", "INR", "Monitor arm (dual, gas spring)", 40, 2450, 0, false],
  ["PO-2024-0152", "V005", "INR", "Printed tote bag (cotton)", 200, 250, 0, false],
  ["PO-2024-0153", "V001", "INR", "Wireless keyboard and mouse combo", 25, 1800, 0, false],
];

const SAMPLES = [
  { step: 1, id: "INV-001", title: "Happy path: clean PDF", expect: "Acme invoices 30 of 50 laptop stands. Approved as a partial delivery; PO-2024-0142 drops from 60,000 to 24,000.", outcome: "approved" },
  { step: 2, id: "INV-002", title: "Happy path: scanned PDF", expect: "A scanned Zenith invoice with no text layer. Read by vision, approved; PO-2024-0143 is fully invoiced.", outcome: "approved" },
  { step: 3, id: "INV-003", title: "Split invoice: final shipment", expect: "Acme invoices the remaining 20 stands. Approved; PO-2024-0142 is fully invoiced.", outcome: "approved" },
  { step: 4, id: "INV-004", title: "Split invoice: over-consumption", expect: "A third Acme invoice on the same PO. Needs attention: nothing is left on the PO and the quantity exceeds the order.", outcome: "needs_attention" },
  { step: 5, id: "INV-005", title: "Missing PO reference: inferred", expect: "Nova prints no PO number. The only open PO matches on amount and lines, so the PO is inferred and the invoice approved.", outcome: "approved" },
  { step: 6, id: "INV-006", title: "Missing PO reference: ambiguous", expect: "Orion prints no PO number and two open POs are equally close. The process refuses to guess: needs attention with both candidates.", outcome: "needs_attention" },
  { step: 7, id: "INV-007", title: "Bank account mismatch", expect: "Everything matches except the bank account, which differs from the vendor master. Needs attention as a fraud signal.", outcome: "needs_attention" },
  { step: 8, id: "INV-008", title: "Duplicate invoice", expect: "Acme re-sends invoice ACM/24-25/0187. Rejected as an exact duplicate of step 1.", outcome: "rejected" },
  { step: 9, id: "INV-009", title: "Amount close but not exact", expect: "Zenith bills 40 monitor arms at 2,475 against a PO price of 2,450: 1,000 over the 98,000 balance, inside the 1,960 tolerance. Approved; PO-2024-0151 is fully invoiced, 1,000 over.", outcome: "approved" },
  { step: 10, id: "INV-010", title: "Tax embedded in prices", expect: "Pixel Print prints GST-inclusive prices and one total of 59,000, with no taxable value or tax rows. The taxable 50,000 is derived from the 18% rate; approved, PO-2024-0152 is fully invoiced.", outcome: "approved" },
  { step: 11, id: "INV-011", title: "Missing invoice number", expect: "An Acme invoice that matches its PO but prints no invoice number. Needs attention: it cannot be approved without one, and PO-2024-0153 keeps its 45,000.", outcome: "needs_attention" },
];

const INVOICES = {
  "INV-001": { vendor: "V001", number: "ACM/24-25/0187", date: "2024-11-04", ref: "PO-2024-0142", qty: 30, price: 1200, split: true },
  "INV-002": { vendor: "V002", number: "ZT-2024-1105", date: "2024-11-05", ref: "PO-2024-0143", qty: 20, price: 8500, split: false, scanned: true },
  "INV-003": { vendor: "V001", number: "ACM/24-25/0203", date: "2024-11-12", ref: "PO-2024-0142", qty: 20, price: 1200, split: true },
  "INV-004": { vendor: "V001", number: "ACM/24-25/0219", date: "2024-11-20", ref: "PO-2024-0142", qty: 10, price: 1200, split: true },
  "INV-005": { vendor: "V003", number: "NC/1124/058", date: "2024-11-07", ref: "", qty: 300, price: 150, split: false, po: "PO-2024-0144" },
  "INV-006": { vendor: "V004", number: "OL-INV-7731", date: "2024-11-09", ref: "", qty: 1, price: 81000, split: false, unit: "lot", text: "Freight charges, October consignment" },
  "INV-007": { vendor: "V005", number: "PP/2024/0456", date: "2024-11-11", ref: "PO-2024-0147", qty: 5000, price: 5, split: true, account: "77700011122" },
  "INV-008": { vendor: "V001", number: "ACM/24-25/0187", date: "2024-11-04", ref: "PO-2024-0142", qty: 30, price: 1200, split: true },
  "INV-009": { vendor: "V002", number: "ZT-2024-1131", date: "2024-11-18", ref: "PO-2024-0151", qty: 40, price: 2475, split: false },
  "INV-010": { vendor: "V005", number: "PP/2024/0489", date: "2024-11-19", ref: "PO-2024-0152", qty: 200, price: 250, split: true, inclusive: true },
  "INV-011": { vendor: "V001", number: "", date: "2024-11-21", ref: "PO-2024-0153", qty: 25, price: 1800, split: true },
};

let VENDORS;
let orders;
let runs;
let register;
let invoiceCount;
let lastReset = 0;
const listeners = new Map();

function reset() {
  VENDORS = structuredClone(SEED_VENDORS);
  orders = new Map(
    SEED_ORDERS.map(([po, vendor, currency, text, qty, price, used, cancelled]) => [
      po,
      { po, vendor, currency, text, qty, price, usedQty: used, usedAmount: 0, cancelled },
    ]),
  );
  runs = new Map();
  register = [];
  invoiceCount = 0;
}

reset();

const fixed = (value) => (value === null || value === undefined ? null : Number(value).toFixed(2));
const indian = (value) => new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2 }).format(value);
const finding = (code, level, text, data = {}) => ({ code, level, text, data });

function orderLines(order) {
  return order.lines ?? [{ text: order.text, qty: order.qty, price: order.price, get used() { return order.usedQty; }, set used(value) { order.usedQty = value; } }];
}

function orderRow(order) {
  const lines = orderLines(order);
  const total = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const status = order.cancelled ? "cancelled" : order.usedAmount <= 0 ? "open" : order.usedAmount >= total ? "fully_invoiced" : "partially_invoiced";
  return {
    po: order.po,
    vendor: VENDORS[order.vendor]?.name ?? order.vendor,
    currency: order.currency,
    status,
    total: fixed(total),
    used: fixed(order.usedAmount),
    left: fixed(total - order.usedAmount),
    lines: lines.map((line, index) => ({ no: index + 1, text: line.text, qty: String(line.qty), used: String(line.used), price: fixed(line.price) })),
  };
}

const VENDOR_FIELDS = ["name", "country", "tax_id", "account", "bank_code", "bank", "currency"];
const LINE_FIELDS = ["text", "qty", "price"];
const missing = (loc) => ({ loc, msg: "Field required", type: "missing" });
const blank = (value) => typeof value !== "string" || value.trim() === "";
const numeric = (value) => typeof value === "number" && Number.isFinite(value);

function vendorRow(id) {
  const vendor = VENDORS[id];
  return { id, name: vendor.name, country: vendor.country, tax_id: vendor.tax_id, account: vendor.account, bank_code: vendor.ifsc, bank: vendor.bank, currency: vendor.currency, status: vendor.status, tolerance: vendor.tolerance };
}

function createVendor(body) {
  if (!body || typeof body !== "object") return [422, { detail: [{ loc: ["body"], msg: "Input should be a valid dictionary", type: "dict_type" }] }];
  const problems = VENDOR_FIELDS.filter((field) => blank(body[field])).map((field) => missing(["body", field]));
  if (body.tolerance !== undefined && body.tolerance !== null && !numeric(body.tolerance)) problems.push({ loc: ["body", "tolerance"], msg: "Input should be a valid number", type: "float_parsing" });
  if (problems.length) return [422, { detail: problems }];
  const fields = Object.fromEntries(VENDOR_FIELDS.map((field) => [field, body[field].trim()]));
  if (!/^[A-Za-z]{2}$/.test(fields.country)) return [422, { detail: "Country must be a two-letter ISO code such as IN." }];
  if (!/^[A-Za-z]{3}$/.test(fields.currency)) return [422, { detail: "Currency must be a three-letter ISO code such as INR." }];
  if (numeric(body.tolerance) && (body.tolerance < 0 || body.tolerance > 100)) return [422, { detail: "Tolerance must be between 0 and 100 percent." }];
  const taxId = fields.tax_id.toUpperCase();
  const account = fields.account.replace(/\s+/g, "");
  for (const [id, vendor] of Object.entries(VENDORS)) {
    if (vendor.tax_id.toUpperCase() === taxId) return [409, { detail: `Tax ID ${taxId} already belongs to vendor ${id} (${vendor.name}).` }];
    if (vendor.account === account) return [409, { detail: `Bank account ending ${account.slice(-4)} already belongs to vendor ${id} (${vendor.name}).` }];
  }
  const next = Math.max(...Object.keys(VENDORS).map((id) => Number(id.slice(1)))) + 1;
  const id = `V${String(next).padStart(3, "0")}`;
  VENDORS[id] = {
    name: fields.name,
    country: fields.country.toUpperCase(),
    tax_id: taxId,
    account,
    ifsc: fields.bank_code.toUpperCase(),
    bank: fields.bank,
    currency: fields.currency.toUpperCase(),
    status: "approved",
    tolerance: numeric(body.tolerance) ? body.tolerance.toFixed(2) : null,
  };
  return [201, vendorRow(id)];
}

function createOrder(body) {
  if (!body || typeof body !== "object") return [422, { detail: [{ loc: ["body"], msg: "Input should be a valid dictionary", type: "dict_type" }] }];
  const problems = [];
  if (blank(body.vendor_id)) problems.push(missing(["body", "vendor_id"]));
  if (!Array.isArray(body.lines)) problems.push(missing(["body", "lines"]));
  else
    body.lines.forEach((line, index) => {
      for (const field of LINE_FIELDS) {
        const value = line?.[field];
        if (field === "text" ? blank(value) : !numeric(value)) problems.push(field === "text" || value === undefined ? missing(["body", "lines", index, field]) : { loc: ["body", "lines", index, field], msg: "Input should be a valid number", type: "float_parsing" });
      }
    });
  if (problems.length) return [422, { detail: problems }];
  if (body.lines.length === 0) return [422, { detail: "A purchase order needs at least one line." }];
  const bad = body.lines.findIndex((line) => line.qty <= 0 || line.price <= 0);
  if (bad >= 0) return [422, { detail: `Line ${bad + 1} needs a quantity and unit price above zero.` }];
  const badTax = body.lines.findIndex((line) => line.tax !== undefined && (!numeric(line.tax) || line.tax < 0 || line.tax > 100));
  if (badTax >= 0) return [422, { detail: `Line ${badTax + 1} has a tax rate outside 0 to 100 percent.` }];
  const date = body.date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return [422, { detail: "Date must be a valid date in YYYY-MM-DD form." }];
  const vendor = VENDORS[body.vendor_id];
  if (!vendor) return [404, { detail: `Vendor ${body.vendor_id} does not exist.` }];
  if (vendor.status === "suspended") return [409, { detail: `Vendor ${body.vendor_id} (${vendor.name}) is suspended, so no purchase order can be raised for it.` }];
  const next = Math.max(...[...orders.keys()].map((po) => Number(po.slice(-4)))) + 1;
  const po = `PO-${date.slice(0, 4)}-${String(next).padStart(4, "0")}`;
  const lines = body.lines.map((line) => ({ text: line.text.trim(), qty: line.qty, unit: line.unit || "pcs", price: line.price, tax: line.tax ?? 18, used: 0 }));
  const order = { po, vendor: body.vendor_id, currency: vendor.currency, date, lines, usedAmount: 0, cancelled: false };
  orders.set(po, order);
  return [201, orderRow(order)];
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

function extraction(invoice, vendorId) {
  const vendor = VENDORS[vendorId];
  const taxable = invoice.qty * invoice.price;
  const split = invoice.split;
  const tax = taxable * 0.18;
  const order = invoice.po ?? invoice.ref;
  const description = invoice.text ?? orders.get(order)?.text ?? "Goods";
  return {
    supplier: { name: vendor.name, tax_id: vendor.tax_id, address: "Bengaluru, Karnataka", email: `accounts@${vendor.name.split(" ")[0].toLowerCase()}.in` },
    supplier_bank: { account_name: vendor.name, account_number: invoice.account ?? vendor.account, bank_code: invoice.account ? "YESB0000246" : vendor.ifsc, bank_name: invoice.account ? "Yes Bank" : vendor.bank },
    buyer: BUYER,
    invoice_number: invoice.number || null,
    invoice_date: invoice.date,
    due_date: null,
    currency: "INR",
    po_reference_text: invoice.ref || null,
    prices_include_tax: Boolean(invoice.inclusive),
    lines: [{ description, quantity: String(invoice.qty), unit: invoice.unit ?? "pcs", unit_price: fixed(invoice.inclusive ? invoice.price * 1.18 : invoice.price), line_amount: fixed(invoice.inclusive ? taxable + tax : taxable), tax_rate_pct: "18" }],
    subtotal: invoice.inclusive ? null : fixed(taxable),
    tax_lines: invoice.inclusive
      ? []
      : split
      ? [
          { label: "CGST", rate_pct: "9", amount: fixed(tax / 2) },
          { label: "SGST", rate_pct: "9", amount: fixed(tax / 2) },
        ]
      : [{ label: "IGST", rate_pct: "18", amount: fixed(tax) }],
    total: fixed(taxable + tax),
    sources: [
      ...(invoice.number ? [{ field: "invoice_number", text: `Invoice No: ${invoice.number}` }] : []),
      { field: "invoice_date", text: `Date: ${invoice.date}` },
      ...(invoice.inclusive ? [] : [{ field: "subtotal", text: `Sub Total ₹ ${indian(taxable)}` }]),
      { field: "total", text: `Grand Total ₹ ${indian(taxable + tax)}` },
      ...(invoice.ref ? [{ field: "po_reference_text", text: `Your PO: ${invoice.ref}` }] : []),
    ],
  };
}

function plan(sampleId) {
  const invoice = INVOICES[sampleId];
  const vendor = VENDORS[invoice.vendor];
  const taxable = invoice.qty * invoice.price;
  const steps = [];
  const add = (name, data, findings = [], state = "done") => steps.push({ name, state, data, findings });

  add("intake", { filename: null, media_type: "application/pdf", size_bytes: 48213, page_count: 1, encrypted: false, text_layer: !invoice.scanned, accepted: true });
  add("extraction", { extraction: extraction(invoice, invoice.vendor), usage: { input: 0, cache_read: 0, cache_write: 0, output: 0 }, mode: "recorded", model: "claude-opus-5-5", seconds: 0.8 });
  const validationFindings = [
    ...(invoice.number ? [] : [finding("MISSING_INVOICE_NUMBER", "block", "No invoice number could be read, so the invoice cannot be approved or checked for duplicates.")]),
    ...(invoice.inclusive ? [finding("TAXABLE_VALUE_DERIVED", "info", `No pre-tax subtotal is printed; the taxable value ${indian(taxable)} was derived from the total ${indian(taxable * 1.18)}.`, { taxable_value: fixed(taxable), total: fixed(taxable * 1.18) })] : []),
  ];
  add("validation", { taxable_value: fixed(taxable), tax_total: fixed(taxable * 0.18), tax_rate_pct: "18.00", derived: Boolean(invoice.inclusive) }, validationFindings);

  add("vendor", { vendor_id: invoice.vendor, legal_name: vendor.name, method: "tax_id", score: 100, candidates: [] }, []);
  const master = `****${String(vendor.account).slice(-4)}`;
  if (invoice.account) {
    add("bank", { vendor_id: invoice.vendor, state: "mismatched", invoice_account: "****1122", master_account: master }, [
      finding("BANK_ACCOUNT_MISMATCH", "block", `The invoice asks for payment to account ****1122, but the vendor master holds account ${master} for ${vendor.name}. Verify the change with the vendor by phone before paying.`, { invoice_account: "****1122", master_account: master }),
    ]);
  } else {
    add("bank", { vendor_id: invoice.vendor, state: "matched", invoice_account: master, master_account: master }, [
      finding("BANK_ACCOUNT_VERIFIED", "info", `The invoice asks for payment to account ${master}, the account the vendor master holds for ${vendor.name}.`, { invoice_account: master }),
    ]);
  }

  const poNumber = invoice.ref || invoice.po || null;
  const order = poNumber ? orders.get(poNumber) : null;
  let poData;
  let poFindings = [];
  const allocation = (method, score) => ({ line: 1, description: invoice.item ?? "Item", po_number: poNumber, po_line: 1, quantity: String(invoice.qty), method, score, suggestion: poNumber ? `${poNumber}/1` : null, probabilities: {} });
  if (sampleId === "INV-006") {
    poData = {
      po_number: null,
      method: "none",
      signals: [],
      candidates: [],
      pool: ["PO-2024-0146", "PO-2024-0145"],
      allocations: [{ line: 1, description: "Freight charges, October consignment", po_number: null, po_line: null, quantity: "1", method: "unmatched", score: 61, suggestion: "PO-2024-0146/1", probabilities: { "PO-2024-0145/1": 0.62, "PO-2024-0146/1": 0.58 } }],
      assist: { state: "answered", reason: null, mode: "recorded", digest: null, asked: [1], findings: [] },
    };
    poFindings = [finding("LINES_NOT_MATCHED", "block", "Some invoice lines could not be matched to a PO line with confidence: line 1 (Freight charges, October consignment): the code suggested PO-2024-0146/1 (score 61); Jev was unsure about PO-2024-0145/1 (0.62), PO-2024-0146/1 (0.58). Match them by hand.", {})];
  } else if (invoice.ref) {
    poData = { po_number: poNumber, method: "explicit", signals: [], candidates: [], pool: [poNumber], allocations: [allocation("code", 100)] };
    poFindings = [finding("PO_MATCHED", "info", `Matched ${poNumber} by the reference printed on the invoice.`, { po_number: poNumber })];
  } else {
    poData = { po_number: poNumber, method: "lines", signals: [], candidates: [], pool: [poNumber], allocations: [allocation("code", 100)] };
    poFindings = [finding("PO_MATCHED", "info", `No PO number is printed; matched ${poNumber} by the invoice lines.`, { po_number: poNumber })];
  }
  add("po", poData, poFindings);

  if (poData.po_number && order) {
    const total = order.qty * order.price;
    const remaining = total - order.usedAmount;
    const tolerance = Math.max(0.02 * remaining, 500);
    const variance = taxable - remaining;
    const within = variance <= tolerance;
    const qtyOk = order.usedQty + invoice.qty <= order.qty;
    const amountFindings = [];
    if (!within) {
      amountFindings.push(finding("OVER_CONSUMPTION", "block", `The invoice amount ${indian(taxable)} exceeds the ${indian(remaining)} left on ${poNumber} by ${indian(variance)}, above the ${indian(tolerance)} tolerance.`, { variance: fixed(variance) }));
    } else {
      const reach = variance > 0 ? `exceeds the ${indian(remaining)} left on ${poNumber} by ${indian(variance)}, within the ${indian(tolerance)} tolerance` : `is within tolerance of the ${indian(remaining)} left on ${poNumber}`;
      amountFindings.push(finding("AMOUNT_WITHIN_TOLERANCE", "info", `The invoice amount ${indian(taxable)} ${reach}.`));
      amountFindings.push(
        taxable >= remaining - tolerance
          ? finding("PO_FULLY_INVOICED", "info", `This invoice uses the rest of ${poNumber}.`)
          : finding("PARTIAL_DELIVERY", "info", `Partial delivery: ${indian(remaining - taxable)} will remain open on ${poNumber}.`),
      );
    }
    if (!qtyOk) {
      amountFindings.push(finding("QTY_EXCEEDS_ORDERED", "block", `Line 1 invoices ${invoice.qty} units, but ${order.usedQty} of ${order.qty} ordered are already invoiced.`));
    }
    add(
      "amounts",
      {
        basis: "taxable_value",
        invoice_amount: fixed(taxable),
        remaining_before: fixed(remaining),
        variance: fixed(variance),
        tolerance: fixed(tolerance),
        within,
        level: "line",
        lines: [{ description: order.text, po_line: 1, quantity: String(invoice.qty), ordered: String(order.qty), consumed_before: String(order.usedQty), unit_price: fixed(invoice.price), po_price: fixed(order.price), ok: qtyOk }],
      },
      amountFindings,
    );
  } else {
    add("amounts", {}, [], "skipped");
  }

  const prior = invoice.number ? register.find((entry) => entry.vendor === invoice.vendor && entry.number === invoice.number) : null;
  add(
    "duplicate",
    { verdict: prior ? "exact" : "none", prior_run: prior?.run ?? null },
    prior ? [finding("DUPLICATE_EXACT", "block", `Invoice ${invoice.number} from ${vendor.name} was already processed in an earlier run.`, { prior_run: prior.run })] : [],
  );
  return { invoice, vendor, steps, order: poData.po_number ? order : null, taxable };
}

const RANK = { block: 0, warn: 1, info: 2 };
const REJECT = new Set(["FILE_REJECTED", "VENDOR_SUSPENDED", "PO_CANCELLED", "DUPLICATE_EXACT"]);

function decide(steps) {
  const all = steps.flatMap((step) => step.findings);
  const reasons = [...all].sort((left, right) => {
    const leftRank = left.level === "block" && REJECT.has(left.code) ? -1 : RANK[left.level];
    const rightRank = right.level === "block" && REJECT.has(right.code) ? -1 : RANK[right.level];
    return leftRank - rightRank;
  });
  const outcome = all.some((item) => item.level === "block" && REJECT.has(item.code)) ? "rejected" : all.some((item) => item.level === "block") ? "needs_attention" : "approved";
  return { outcome, reasons };
}

function summaryFor(outcome, reasons, order, taxable) {
  if (outcome === "approved" && order) {
    const left = order.qty * order.price - order.usedAmount - taxable;
    return left > 0 ? `Approved as partial delivery; ${indian(left)} remains open on ${order.po}.` : `Approved; ${order.po} is now fully invoiced.`;
  }
  const first = reasons.find((item) => item.level === "block");
  return first ? `${outcome === "rejected" ? "Rejected" : "Needs attention"}: ${first.text}` : "Approved.";
}

function newRun(file, sampleId) {
  const run = {
    id: randomUUID().slice(0, 8),
    file,
    sample: sampleId,
    status: "running",
    outcome: null,
    vendor_id: null,
    vendor: null,
    po: null,
    invoice_id: null,
    number: null,
    amount: null,
    summary: null,
    tokens: null,
    mode: "recorded",
    at: new Date().toISOString(),
    ms: null,
    reasons: [],
    steps: [],
  };
  runs.set(run.id, run);
  return run;
}

function emit(run, event, data) {
  for (const response of listeners.get(run.id) ?? []) response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function play(run, steps, finish) {
  const started = Date.now();
  for (const step of steps) {
    const running = { name: step.name, state: "running", ms: null, data: {}, findings: [] };
    run.steps.push(running);
    emit(run, "step", running);
    const delay = step.name === "extraction" ? STEP_DELAY * 3 : STEP_DELAY;
    await wait(delay);
    const final = { ...step, ms: step.state === "skipped" ? 0 : delay + Math.round(Math.random() * 40) };
    run.steps[run.steps.length - 1] = final;
    emit(run, "step", final);
    if (step.state === "failed") break;
  }
  finish();
  run.ms = Date.now() - started;
  emit(run, "done", { status: run.status, outcome: run.outcome, summary: run.summary });
  for (const response of listeners.get(run.id) ?? []) response.end();
  listeners.delete(run.id);
}

function startSample(sampleId) {
  const run = newRun(null, sampleId);
  const { invoice, vendor, steps, order, taxable } = plan(sampleId);
  const { outcome, reasons } = decide(steps);
  const summary = summaryFor(outcome, reasons, order, taxable);
  const update = outcome === "approved" && order ? { po_number: order.po, amount: fixed(taxable), remaining_after: fixed(order.qty * order.price - order.usedAmount - taxable), quantities: { 1: String(invoice.qty) } } : null;
  steps.push({ name: "decision", state: "done", data: { update }, findings: [] });
  steps.push({ name: "persist", state: "done", data: { registered: true, po_updated: Boolean(update) }, findings: [] });

  Object.assign(run, { vendor_id: invoice.vendor, vendor: vendor.name, po: order?.po ?? null, invoice_id: ++invoiceCount, number: invoice.number || null, amount: fixed(taxable), tokens: { in: 0, read: 0, write: 0, out: 0 } });
  void play(run, steps, () => {
    if (update) {
      order.usedAmount += taxable;
      order.usedQty += invoice.qty;
    }
    if (outcome !== "rejected") register.push({ vendor: invoice.vendor, number: invoice.number, run: run.id });
    Object.assign(run, { status: "completed", outcome, summary, reasons });
    const sample = SAMPLES.find((item) => item.id === sampleId);
    sample.ran = true;
    sample.result = outcome;
  });
  return run;
}

function startUpload(filename) {
  const run = newRun(filename || null, null);
  run.mode = "live";
  const lower = filename.toLowerCase();
  const intake = { filename, media_type: lower.endsWith(".png") ? "image/png" : lower.match(/\.jpe?g$/) ? "image/jpeg" : "application/pdf", size_bytes: 120334, page_count: lower.endsWith(".pdf") ? 2 : null, encrypted: false, text_layer: lower.endsWith(".pdf") ? true : null, accepted: true };

  if (lower.includes("reject")) {
    const reasons = [finding("FILE_REJECTED", "block", `${filename} is encrypted and cannot be read.`)];
    const steps = [
      { name: "intake", state: "done", data: { ...intake, encrypted: true, accepted: false }, findings: reasons },
      { name: "decision", state: "done", data: { update: null }, findings: [] },
      { name: "persist", state: "done", data: {}, findings: [] },
    ];
    void play(run, steps, () => Object.assign(run, { status: "completed", outcome: "rejected", summary: "Rejected: the file could not be read.", reasons }));
    return run;
  }

  if (lower.includes("crash")) {
    const steps = [
      { name: "intake", state: "done", data: intake, findings: [] },
      { name: "extraction", state: "done", data: { extraction: extraction(INVOICES["INV-001"], "V001"), usage: { input: 3120, cache_read: 2890, cache_write: 0, output: 912 }, mode: "live", model: "claude-opus-5-5", seconds: 6.4 }, findings: [] },
      { name: "validation", state: "done", data: { taxable_value: "36000.00", tax_total: "6480.00", tax_rate_pct: "18.00", derived: false }, findings: [] },
      { name: "vendor", state: "failed", data: { error: "database is locked" }, findings: [] },
    ];
    void play(run, steps, () => Object.assign(run, { status: "error", outcome: null, summary: "The run stopped because of an unexpected error at vendor identification.", tokens: { in: 3120, read: 2890, write: 0, out: 912 } }));
    return run;
  }

  const reasons = [finding("EXTRACTION_FAILED", "block", "No recorded extraction for this file; set ANTHROPIC_API_KEY to read new documents.")];
  const summary = "Needs attention: the document could not be read.";
  const steps = [
    { name: "intake", state: "done", data: intake, findings: [] },
    { name: "extraction", state: "done", data: { extraction: null, usage: null, mode: "recorded", model: "claude-opus-5-5", seconds: 0 }, findings: reasons },
    ...["validation", "vendor", "bank", "duplicate", "po", "amounts"].map((name) => ({ name, state: "skipped", data: {}, findings: [] })),
    { name: "decision", state: "done", data: { update: null }, findings: [] },
    { name: "persist", state: "done", data: {}, findings: [] },
  ];
  void play(run, steps, () => Object.assign(run, { status: "completed", outcome: "needs_attention", summary, reasons }));
  return run;
}

const MANUAL_TEXT = ["supplier_name", "supplier_tax_id", "supplier_address", "supplier_email", "bank_account_name", "bank_account_number", "bank_code", "bank_name", "buyer_name", "buyer_tax_id", "invoice_number", "invoice_date", "due_date", "currency", "po_reference_text", "subtotal", "total"];
const MANUAL_KEYS = new Set([...MANUAL_TEXT, "prices_include_tax", "lines", "tax_lines"]);
const MANUAL_LINE_KEYS = ["description", "quantity", "unit", "unit_price", "line_amount", "tax_rate_pct"];
const MANUAL_TAX_KEYS = ["label", "rate_pct", "amount"];
const orNull = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const amountOf = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return String(value ?? "").trim() !== "" && Number.isFinite(parsed) ? parsed : null;
};

function checkManual(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return [{ loc: ["body"], msg: "Input should be a valid dictionary", type: "dict_type" }];
  const problems = Object.keys(body).filter((key) => !MANUAL_KEYS.has(key)).map((key) => ({ loc: ["body", key], msg: "Extra inputs are not permitted", type: "extra_forbidden" }));
  for (const key of MANUAL_TEXT) if (key in body && typeof body[key] !== "string") problems.push({ loc: ["body", key], msg: "Input should be a valid string", type: "string_type" });
  if ("prices_include_tax" in body && typeof body.prices_include_tax !== "boolean") problems.push({ loc: ["body", "prices_include_tax"], msg: "Input should be a valid boolean", type: "bool_type" });
  for (const [key, fields] of [["lines", MANUAL_LINE_KEYS], ["tax_lines", MANUAL_TAX_KEYS]]) {
    if (!(key in body)) continue;
    if (!Array.isArray(body[key])) {
      problems.push({ loc: ["body", key], msg: "Input should be a valid list", type: "list_type" });
      continue;
    }
    body[key].forEach((row, index) => {
      for (const extra of Object.keys(row ?? {}).filter((name) => !fields.includes(name))) problems.push({ loc: ["body", key, index, extra], msg: "Extra inputs are not permitted", type: "extra_forbidden" });
      for (const name of fields) if (row && name in row && typeof row[name] !== "string") problems.push({ loc: ["body", key, index, name], msg: "Input should be a valid string", type: "string_type" });
    });
  }
  return problems;
}

function manualExtraction(body) {
  const lines = (body.lines ?? []).map((line) => ({
    description: orNull(line.description),
    quantity: orNull(line.quantity),
    unit: orNull(line.unit),
    unit_price: orNull(line.unit_price),
    line_amount: orNull(line.line_amount),
    tax_rate_pct: orNull(line.tax_rate_pct),
  }));
  return {
    supplier: { name: orNull(body.supplier_name), tax_id: orNull(body.supplier_tax_id), address: orNull(body.supplier_address), email: orNull(body.supplier_email) },
    supplier_bank: { account_name: orNull(body.bank_account_name), account_number: orNull(body.bank_account_number), bank_code: orNull(body.bank_code), bank_name: orNull(body.bank_name) },
    buyer: { name: orNull(body.buyer_name), tax_id: orNull(body.buyer_tax_id), address: null, email: null },
    invoice_number: orNull(body.invoice_number),
    invoice_date: orNull(body.invoice_date),
    due_date: orNull(body.due_date),
    currency: orNull(body.currency),
    po_reference_text: orNull(body.po_reference_text),
    prices_include_tax: Boolean(body.prices_include_tax),
    lines,
    subtotal: orNull(body.subtotal),
    tax_lines: (body.tax_lines ?? []).map((row) => ({ label: orNull(row.label), rate_pct: orNull(row.rate_pct), amount: orNull(row.amount) })),
    total: orNull(body.total),
    sources: [],
  };
}

function manualPlan(body) {
  const extracted = manualExtraction(body);
  const steps = [];
  const add = (name, data, findings = [], state = "done") => steps.push({ name, state, data, findings });
  const lines = extracted.lines
    .map((line) => ({ ...line, qty: amountOf(line.quantity), price: amountOf(line.unit_price) }))
    .filter((line) => line.description && line.qty !== null && line.price !== null);
  const lineSum = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
  const taxable = amountOf(extracted.subtotal) ?? lineSum;
  const taxTotal = extracted.tax_lines.reduce((sum, row) => sum + (amountOf(row.amount) ?? 0), 0);
  const total = amountOf(extracted.total);

  add("intake", { reason: "Entered by hand; there is no file to check." }, [], "skipped");
  add("extraction", { extraction: extracted, usage: null, mode: "manual", model: null, seconds: 0 });

  const validationFindings = [];
  if (!extracted.invoice_number) validationFindings.push(finding("MISSING_INVOICE_NUMBER", "block", "No invoice number was entered, so the invoice cannot be approved or checked for duplicates."));
  if (Math.abs(lineSum - taxable) > 0.01) validationFindings.push(finding("SUBTOTAL_MISMATCH", "warn", `The lines add up to ${indian(lineSum)} but the subtotal is ${indian(taxable)}.`));
  if (total !== null && Math.abs(taxable + taxTotal - total) > 0.01) validationFindings.push(finding("TOTAL_MISMATCH", "warn", `Subtotal plus tax is ${indian(taxable + taxTotal)} but the total is ${indian(total)}.`));
  const rates = [...new Set(extracted.tax_lines.map((row) => row.rate_pct))];
  add("validation", { taxable_value: fixed(taxable), tax_total: fixed(taxTotal), tax_rate_pct: rates.length === 1 ? rates[0] : null, derived: false }, validationFindings);

  const taxId = (extracted.supplier.tax_id ?? "").toUpperCase();
  const match = Object.entries(VENDORS).find(([, vendor]) => taxId && vendor.tax_id.toUpperCase() === taxId);
  const vendorId = match?.[0] ?? null;
  const vendor = match?.[1] ?? null;
  const vendorFindings = [];
  if (!vendor) vendorFindings.push(finding("VENDOR_NOT_FOUND", "block", `No vendor in the master has tax ID ${taxId || "(blank)"}.`));
  else {
    if (vendor.status === "suspended") vendorFindings.push(finding("VENDOR_SUSPENDED", "block", `${vendor.name} is suspended in the vendor master.`));
  }
  add("vendor", { vendor_id: vendorId, legal_name: vendor?.name ?? null, method: vendor ? "tax_id" : "none", score: vendor ? 100 : 0, candidates: [] }, vendorFindings);
  if (!vendor) add("bank", { reason: "The vendor is unknown, so there is no master account to compare." }, [], "skipped");
  else {
    const account = (extracted.supplier_bank.account_number ?? "").replace(/\s+/g, "");
    const master = `****${vendor.account.slice(-4)}`;
    const shown = account ? `****${account.slice(-4)}` : null;
    if (!account) add("bank", { vendor_id: vendorId, state: "absent", invoice_account: null, master_account: master }, [finding("BANK_DETAILS_ABSENT", "info", `The invoice prints no bank account; payment goes to account ${master} held in the vendor master for ${vendor.name}.`, { master_account: master })]);
    else if (account !== vendor.account) add("bank", { vendor_id: vendorId, state: "mismatched", invoice_account: shown, master_account: master }, [finding("BANK_ACCOUNT_MISMATCH", "block", `The invoice asks for payment to account ${shown}, but the vendor master holds account ${master} for ${vendor.name}. Verify the change with the vendor by phone before paying.`, { invoice_account: shown, master_account: master })]);
    else add("bank", { vendor_id: vendorId, state: "matched", invoice_account: shown, master_account: master }, [finding("BANK_ACCOUNT_VERIFIED", "info", `The invoice asks for payment to account ${shown}, the account the vendor master holds for ${vendor.name}.`, { invoice_account: shown })]);
  }

  const poNumber = (extracted.po_reference_text ?? "").toUpperCase().match(/PO-\d{4}-\d{4}/)?.[0] ?? null;
  const order = poNumber ? orders.get(poNumber) ?? null : null;
  const poFindings = [];
  if (!poNumber) poFindings.push(finding("PO_NOT_FOUND", "block", "The PO reference does not contain a valid PO number (PO-YYYY-NNNN)."));
  else if (!order) poFindings.push(finding("PO_NOT_FOUND", "block", `${poNumber} is not in the purchase order master.`));
  else if (order.cancelled) poFindings.push(finding("PO_CANCELLED", "block", `${poNumber} is cancelled.`));
  else if (vendorId && order.vendor !== vendorId) poFindings.push(finding("PO_VENDOR_MISMATCH", "block", `${poNumber} belongs to ${VENDORS[order.vendor]?.name ?? order.vendor}, not ${vendor.name}.`));
  add("po", { po_number: order ? poNumber : null, method: order ? "explicit" : "none", signals: [], candidates: [] }, poFindings);

  let quantities = null;
  if (order && !order.cancelled) {
    const poLines = orderLines(order);
    const orderTotal = poLines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const remaining = orderTotal - order.usedAmount;
    const tolerance = vendor?.tolerance !== null && vendor?.tolerance !== undefined ? (Number(vendor.tolerance) / 100) * remaining : Math.max(0.02 * remaining, 500);
    const variance = taxable - remaining;
    const within = variance <= tolerance;
    const amountFindings = [];
    if (!within) amountFindings.push(finding("OVER_CONSUMPTION", "block", `The invoice amount ${indian(taxable)} exceeds the ${indian(remaining)} left on ${poNumber} by ${indian(variance)}, above the ${indian(tolerance)} tolerance.`, { variance: fixed(variance) }));
    else {
      amountFindings.push(finding("AMOUNT_WITHIN_TOLERANCE", "info", `The invoice amount ${indian(taxable)} is within tolerance of the ${indian(remaining)} left on ${poNumber}.`));
      amountFindings.push(taxable >= remaining - tolerance ? finding("PO_FULLY_INVOICED", "info", `This invoice uses the rest of ${poNumber}.`) : finding("PARTIAL_DELIVERY", "info", `Partial delivery: ${indian(remaining - taxable)} will remain open on ${poNumber}.`));
    }
    quantities = {};
    const checked = lines.map((line, index) => {
      const named = poLines.findIndex((row) => row.text.toLowerCase() === line.description.toLowerCase());
      const poIndex = named >= 0 ? named : Math.min(index, poLines.length - 1);
      const poLine = poLines[poIndex];
      const ok = poLine.used + line.qty <= poLine.qty;
      if (!ok) amountFindings.push(finding("QTY_EXCEEDS_ORDERED", "block", `Line ${index + 1} invoices ${line.qty} units, but ${poLine.used} of ${poLine.qty} ordered are already invoiced.`));
      quantities[poIndex + 1] = String((Number(quantities[poIndex + 1] ?? 0)) + line.qty);
      return { description: line.description, po_line: poIndex + 1, quantity: String(line.qty), ordered: String(poLine.qty), consumed_before: String(poLine.used), unit_price: fixed(line.price), po_price: fixed(poLine.price), ok };
    });
    add("amounts", { basis: "taxable_value", invoice_amount: fixed(taxable), remaining_before: fixed(remaining), variance: fixed(variance), tolerance: fixed(tolerance), within, level: "line", lines: checked }, amountFindings);
  } else add("amounts", {}, [], "skipped");

  const number = extracted.invoice_number;
  const prior = number && vendorId ? register.find((entry) => entry.vendor === vendorId && entry.number === number) : null;
  add("duplicate", { verdict: prior ? "exact" : "none", prior_run: prior?.run ?? null }, prior ? [finding("DUPLICATE_EXACT", "block", `Invoice ${number} from ${vendor.name} was already processed in an earlier run.`, { prior_run: prior.run })] : []);

  return { steps, vendorId, vendor, order: order && !order.cancelled ? order : null, taxable, quantities, number, extracted };
}

function startManual(body) {
  const run = newRun(null, null);
  run.mode = "manual";
  const { steps, vendorId, vendor, order, taxable, quantities, number } = manualPlan(body);
  const { outcome, reasons } = decide(steps);
  const summary = summaryFor(outcome, reasons, order ? { ...order, qty: 1, price: orderLines(order).reduce((sum, line) => sum + line.qty * line.price, 0) } : null, taxable);
  const update = outcome === "approved" && order ? { po_number: order.po, amount: fixed(taxable), remaining_after: fixed(orderLines(order).reduce((sum, line) => sum + line.qty * line.price, 0) - order.usedAmount - taxable), quantities } : null;
  steps.push({ name: "decision", state: "done", data: { update }, findings: [] });
  steps.push({ name: "persist", state: "done", data: { registered: outcome !== "rejected", po_updated: Boolean(update), remaining_after: update?.remaining_after ?? null }, findings: [] });
  Object.assign(run, { vendor_id: vendorId, vendor: vendor?.name ?? null, po: order?.po ?? null, invoice_id: ++invoiceCount, number, amount: fixed(taxable), tokens: null });
  void play(run, steps, () => {
    if (update) {
      const poLines = orderLines(order);
      order.usedAmount += taxable;
      for (const [no, qty] of Object.entries(quantities)) poLines[Number(no) - 1].used += Number(qty);
    }
    if (outcome === "approved" && number && vendorId) register.push({ vendor: vendorId, number, run: run.id });
    Object.assign(run, { status: "completed", outcome, summary, reasons });
  });
  return run;
}

function runRow(run) {
  const { reasons, steps, ...row } = run;
  return row;
}

function send(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("latin1")));
  });
}

for (const sample of SAMPLES) Object.assign(sample, { ran: false, result: null });

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = request.method ?? "GET";

  if (method === "GET" && path === "/v1/admin/meta") return send(response, 200, { mode: "recorded", model: "claude-opus-5-5" });
  if (method === "GET" && path === "/v1/admin/samples") return send(response, 200, { data: SAMPLES });
  if (method === "POST" && path === "/v1/admin/reset") {
    if (Date.now() - lastReset < 10000) return send(response, 429, { detail: "Reset at most once every 10 seconds" });
    lastReset = Date.now();
    reset();
    for (const sample of SAMPLES) Object.assign(sample, { ran: false, result: null });
    return send(response, 200, { ok: true });
  }
  if (method === "GET" && path === "/v1/orders") return send(response, 200, { data: [...orders.values()].map(orderRow) });
  if (method === "POST" && path === "/v1/orders") return send(response, ...createOrder(await readJson(request)));
  if (method === "GET" && path === "/v1/vendors") return send(response, 200, { data: Object.keys(VENDORS).map(vendorRow) });
  if (method === "POST" && path === "/v1/vendors") return send(response, ...createVendor(await readJson(request)));
  if (method === "GET" && path === "/v1/runs") {
    const outcome = url.searchParams.get("outcome");
    const rows = [...runs.values()].filter((run) => !outcome || run.outcome === outcome).map(runRow);
    return send(response, 200, { data: rows });
  }
  if (method === "POST" && path === "/v1/runs/manual") {
    const body = await readJson(request);
    const problems = checkManual(body);
    if (problems.length) return send(response, 422, { detail: problems });
    const usable = (body.lines ?? []).filter((line) => orNull(line.description) && amountOf(line.quantity) !== null && amountOf(line.unit_price) !== null);
    if (usable.length === 0) return send(response, 422, { detail: "Nothing to process: add at least one line with a description, quantity and unit price." });
    return send(response, 202, { id: startManual(body).id });
  }
  if (method === "POST" && path === "/v1/runs") {
    const body = await readBody(request);
    const match = body.match(/filename="([^"]+)"/);
    if (!match) return send(response, 422, { detail: [{ loc: ["body", "file"], msg: "Field required", type: "missing" }] });
    return send(response, 202, { id: startUpload(match[1]).id });
  }

  const sampleMatch = path.match(/^\/v1\/runs\/samples\/([^/]+)$/);
  if (method === "POST" && sampleMatch) {
    const sample = SAMPLES.find((item) => item.id === sampleMatch[1]);
    if (!sample) return send(response, 404, { detail: "Unknown sample" });
    return send(response, 202, { id: startSample(sample.id).id });
  }

  const eventsMatch = path.match(/^\/v1\/runs\/([^/]+)\/events$/);
  if (method === "GET" && eventsMatch) {
    if (process.env.MOCK_SSE_FAIL) return send(response, 503, { detail: "stream unavailable" });
    const run = runs.get(eventsMatch[1]);
    if (!run) return send(response, 404, { detail: "Run not found" });
    response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    for (const step of run.steps) response.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`);
    if (run.status !== "running") {
      response.write(`event: done\ndata: ${JSON.stringify({ status: run.status, outcome: run.outcome, summary: run.summary })}\n\n`);
      return response.end();
    }
    const open = listeners.get(run.id) ?? new Set();
    open.add(response);
    listeners.set(run.id, open);
    request.on("close", () => open.delete(response));
    return;
  }

  const runMatch = path.match(/^\/v1\/runs\/([^/]+)$/);
  if (method === "GET" && runMatch) {
    const run = runs.get(runMatch[1]);
    if (!run) return send(response, 404, { detail: "Run not found" });
    return send(response, 200, run);
  }

  send(response, 404, { detail: "Not found" });
});

server.listen(PORT, () => console.log(`mock api on http://localhost:${PORT}`));
