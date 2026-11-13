// The sample invoices are bundled with the frontend, so a preview needs no request to the backend.
// They are copies of backend/data/invoices/*.pdf; run `npm run samples` after the samples change.
const files = import.meta.glob<string>("../assets/invoices/*.pdf", { eager: true, query: "?url", import: "default" });

const BUNDLED: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".pdf".length), url]),
);

/** The address of a sample's PDF: the bundled copy, or the backend's when a sample has none. */
export function sampleDocument(id: string): string {
  return BUNDLED[id] ?? `/v1/admin/samples/${encodeURIComponent(id)}/document`;
}

/** The bundled PDF of a sample, or null when the id is not a bundled sample. */
export function bundledSample(id: string | null): string | null {
  return id ? (BUNDLED[id] ?? null) : null;
}
