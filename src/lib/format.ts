import type { Outcome, RunRow } from "./api";

const indianMoney = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const westernMoney = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const countFormat = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 4 });
const decimalCommaForms = [/^-?\d{1,3}(\.\d{3})+,\d+$/, /^-?\d{1,3}(\.\d{3}){2,}$/, /^-?\d+,\d{1,2}$/];

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const text = value.replace(/\s/g, "");
  const decimalComma = decimalCommaForms.some((form) => form.test(text));
  const plain = decimalComma ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  const parsed = Number(plain);
  return Number.isFinite(parsed) ? parsed : null;
}

export function money(value: unknown, currency?: string | null, options?: { signed?: boolean }): string {
  const parsed = toNumber(value);
  if (parsed === null) return "—";
  const format = currency && currency !== "INR" ? westernMoney : indianMoney;
  const text = `${options?.signed && parsed > 0 ? "+" : ""}${format.format(parsed)}`;
  return currency ? `${currency} ${text}` : text;
}

export function quantity(value: unknown): string {
  const parsed = toNumber(value);
  return parsed === null ? "—" : countFormat.format(parsed);
}

export function percent(value: unknown): string {
  const parsed = toNumber(value);
  return parsed === null ? "—" : `${countFormat.format(parsed)}%`;
}

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

export function bytes(value: unknown): string {
  const parsed = toNumber(value);
  if (parsed === null) return "—";
  if (parsed < 1024) return `${parsed} B`;
  if (parsed < 1024 * 1024) return `${(parsed / 1024).toFixed(1)} KB`;
  return `${(parsed / 1024 / 1024).toFixed(2)} MB`;
}

export function timestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function tokenTotal(tokens: { in: number; read: number; write: number; out: number } | null): string {
  if (!tokens) return "—";
  return countFormat.format(tokens.in + tokens.read + tokens.write + tokens.out);
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  approved: "Approved",
  needs_attention: "Needs attention",
  rejected: "Rejected",
};

const ACRONYMS: Record<string, string> = { po: "PO", id: "ID", pct: "%", ms: "ms", url: "URL" };

export function humanise(key: string): string {
  const words = key.split(/[_\s]+/).filter(Boolean).map((word) => ACRONYMS[word.toLowerCase()] ?? word.toLowerCase());
  const spaced = words.join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function runLabel(run: Pick<RunRow, "file" | "sample" | "mode">): string {
  if (run.file) return run.file;
  if (run.mode === "manual") return "Manual entry";
  if (run.sample) return `Sample ${run.sample}`;
  return "Unnamed upload";
}
