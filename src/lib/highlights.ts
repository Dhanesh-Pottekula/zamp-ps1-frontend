// The demo cases worth pointing out, on approved samples only: each sample lists the cases it shows.
// Taken from backend/data/golden.json (outcome, codes) and the invoices' printed PO references.

export type Highlight = "international" | "partial" | "multi-po" | "no-po";

export const HIGHLIGHTS: Record<Highlight, { label: string; hint: string }> = {
  international: { label: "International", hint: "A foreign vendor billing in its own currency and formats" },
  partial: { label: "Partial invoice", hint: "Bills part of the PO; the rest stays open" },
  "multi-po": { label: "Multiple POs", hint: "One invoice split between two POs" },
  "no-po": { label: "No PO number", hint: "No PO printed; found from the invoice lines" },
};

const BY_SAMPLE: Record<string, Highlight[]> = {
  "INV-001": ["partial"],
  "INV-006": ["partial"],
  "INV-010": ["international"],
  "INV-011": ["international"],
  "INV-012": ["international"],
  "INV-027": ["no-po", "partial"],
  "INV-028": ["multi-po", "partial"],
  "INV-033": ["no-po", "multi-po", "partial"],
  "INV-034": ["partial"],
  "INV-038": ["no-po", "partial"],
  "INV-039": ["no-po", "multi-po", "partial"],
  "INV-040": ["no-po", "partial"],
};

/** The highlighted cases a sample shows, empty when it shows none. */
export function highlightsOf(id: string): Highlight[] {
  return BY_SAMPLE[id] ?? [];
}
