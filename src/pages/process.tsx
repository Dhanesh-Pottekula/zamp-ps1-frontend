import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronRight, ExternalLink, FileUp, Keyboard, Loader2, Maximize2, Play, RotateCcw, X } from "lucide-react";
import { api, ApiError, type Meta, type SampleRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OutcomeBadge } from "@/components/outcome";
import { ModeBadge } from "@/components/mode-badge";
import { ErrorNote } from "@/components/error-note";
import { sampleDocument } from "@/lib/samples";
import { useDocument } from "@/lib/use-document";
import { Badge } from "@/components/ui/badge";
import { HIGHLIGHTS, highlightsOf, type Highlight } from "@/lib/highlights";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const ACCEPTED_EXTENSIONS = /\.(pdf|png|jpe?g)$/i;

function errorText(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return "Demo data was reset a moment ago. Please wait a few seconds and try again.";
    return error.message;
  }
  return fallback;
}

export function ProcessPage() {
  const navigate = useNavigate();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [samples, setSamples] = useState<SampleRow[] | null>(null);
  const [preview, setPreview] = useState<SampleRow | null>(null);
  const [focus, setFocus] = useState<Highlight | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadSamples = useCallback(async () => {
    try {
      setSamples(await api.samples());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorText(error, "Could not load the sample scenario."));
    }
  }, []);

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setMeta(null));
    void loadSamples();
  }, [loadSamples]);

  const start = async (key: string, launch: () => Promise<{ id: string }>) => {
    setBusy(key);
    setActionError(null);
    try {
      const { id } = await launch();
      navigate(`/runs/${id}`);
    } catch (error) {
      setActionError(errorText(error, "Could not start the run."));
      setBusy(null);
    }
  };

  const reset = async () => {
    setBusy("reset");
    setActionError(null);
    try {
      await api.reset();
      await loadSamples();
    } catch (error) {
      setActionError(errorText(error, "Could not reset the demo data."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Process an invoice</h1>
          <p className="text-sm text-slate-600">
            Upload a supplier invoice or run a prepared scenario. Each run is checked against the vendor master and open purchase orders.
          </p>
        </div>
        {meta && <ModeBadge mode={meta.mode} model={meta.model} />}
      </div>

      <ErrorNote message={actionError} />

      <UploadZone
        busy={busy === "upload"}
        disabled={busy !== null}
        onFile={(file) => void start("upload", () => api.upload(file))}
        onReject={(message) => setActionError(message)}
      />

      <Link
        to="/manual"
        className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-xs transition-colors hover:border-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          <Keyboard className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-900">No file? Enter the invoice by hand</span>
          <span className="block text-xs text-slate-500">Type the fields yourself and run the same checks without the model.</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </Link>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Demo scenario</CardTitle>
            <p className="text-xs text-slate-500">Sample invoices that tell one story when run in order after a reset. Each card shows the invoice itself; click it to enlarge. Any of them can run at any time.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void reset()} disabled={busy !== null}>
            {busy === "reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset demo data
          </Button>
        </CardHeader>
        {loadError && (
          <CardContent>
            <ErrorNote message={loadError} />
          </CardContent>
        )}
        {!samples && !loadError && <CardContent className="text-sm text-slate-500">Loading scenario…</CardContent>}
        {samples && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 px-4 pb-3 text-xs text-slate-500">
            <span className="mr-1">Highlight approved cases:</span>
            <FocusButton active={focus === null} onClick={() => setFocus(null)}>
              All samples
            </FocusButton>
            {(Object.keys(HIGHLIGHTS) as Highlight[]).map((key) => (
              <FocusButton key={key} active={focus === key} onClick={() => setFocus(focus === key ? null : key)} title={HIGHLIGHTS[key].hint}>
                {HIGHLIGHTS[key].label}
                <span className="num text-[11px] opacity-70">{samples.filter((s) => highlightsOf(s.id).includes(key)).length}</span>
              </FocusButton>
            ))}
          </div>
        )}
        {samples && (
          <ol className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {samples.filter((sample) => focus === null || highlightsOf(sample.id).includes(focus)).map((sample) => (
              <SampleItem
                key={sample.id}
                sample={sample}
                busy={busy === sample.id}
                disabled={busy !== null}
                onRun={() => void start(sample.id, () => api.runSample(sample.id))}
                onPreview={() => setPreview(sample)}
              />
            ))}
          </ol>
        )}
      </Card>

      {preview && <SamplePreview sample={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

interface SampleItemProps {
  sample: SampleRow;
  busy: boolean;
  disabled: boolean;
  onRun: () => void;
  onPreview: () => void;
}

const MISSING_NOTE = "Preview not available for this sample.";

function SampleItem({ sample, busy, disabled, onRun, onPreview }: SampleItemProps) {
  const matched = sample.result !== null && sample.result === sample.outcome;
  const invoice = useDocument(sampleDocument(sample.id));
  const highlights = highlightsOf(sample.id);

  return (
    <li
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border bg-white",
        highlights.length > 0 ? "border-sky-300 ring-2 ring-sky-200" : "border-slate-200",
      )}
    >
      <div className="relative h-56 overflow-hidden border-b border-slate-200 bg-slate-50">
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-slate-400">
          {invoice === "missing" ? MISSING_NOTE : "Loading preview…"}
        </p>
        {invoice === "ready" && (
          <>
            {/* The top of the first page, fitted to the card's width; the button on top takes every click. */}
            <iframe
              src={`${sampleDocument(sample.id)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
              title={`${sample.id} preview`}
              tabIndex={-1}
              className="pointer-events-none relative block h-[40rem] w-full"
            />
            <button
              type="button"
              onClick={onPreview}
              aria-label={`Open ${sample.id} in a larger view`}
              className="group absolute inset-0 flex items-end justify-end p-2 focus-visible:outline-2 focus-visible:outline-sky-600"
            >
              <span className="inline-flex items-center gap-1 rounded bg-white/95 px-1.5 py-1 text-xs font-medium text-slate-700 opacity-0 shadow-sm ring-1 ring-slate-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                <Maximize2 className="h-3.5 w-3.5" />
                Enlarge
              </span>
            </button>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <span
            className={cn(
              "num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              sample.ran ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600",
            )}
          >
            {sample.step}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-snug text-slate-900">{sample.title}</div>
            <code className="font-mono text-[11px] text-slate-500">{sample.id}</code>
          </div>
        </div>
        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {highlights.map((key) => (
              <Badge key={key} tone="blue" title={HIGHLIGHTS[key].hint}>
                {HIGHLIGHTS[key].label}
              </Badge>
            ))}
          </div>
        )}
        <p className="flex-1 text-[13px] leading-snug text-slate-600">{sample.expect}</p>
        <div className="space-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            Expected <OutcomeBadge outcome={sample.outcome} />
          </div>
          {sample.ran && (
            <div className="flex flex-wrap items-center gap-1.5">
              Last result <OutcomeBadge outcome={sample.result} />
              {sample.result !== null && (
                <span className={matched ? "text-emerald-700" : "text-red-700"}>{matched ? "as expected" : "differs from expected"}</span>
              )}
            </div>
          )}
        </div>
        <Button size="sm" variant={sample.ran ? "outline" : "default"} onClick={onRun} disabled={disabled} className="w-full">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {sample.ran ? "Run again" : "Run"}
        </Button>
      </div>
    </li>
  );
}

function FocusButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1 font-medium ring-1 ring-inset",
        active ? "bg-sky-600 text-white ring-sky-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}

function SamplePreview({ sample, onClose }: { sample: SampleRow; onClose: () => void }) {
  const invoice = useDocument(sampleDocument(sample.id));

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${sample.id}: ${sample.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-slate-900">{sample.title}</div>
            <code className="font-mono text-[11px] text-slate-500">{sample.id}</code>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <a href={sampleDocument(sample.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
              <ExternalLink className="h-3.5 w-3.5" />
              Open in new tab
            </a>
            <button type="button" onClick={onClose} aria-label="Close preview" autoFocus className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative flex-1 bg-slate-50">
          <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-slate-500">
            {invoice === "missing" ? MISSING_NOTE : "Loading invoice…"}
          </p>
          {invoice === "ready" && <iframe src={sampleDocument(sample.id)} title={`${sample.id} invoice`} className="relative block h-full w-full" />}
        </div>
      </div>
    </div>
  );
}

interface UploadZoneProps {
  busy: boolean;
  disabled: boolean;
  onFile: (file: File) => void;
  onReject: (message: string) => void;
}

function UploadZone({ busy, disabled, onFile, onReject }: UploadZoneProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.test(file.name)) {
      onReject(`${file.name} is not a PDF, PNG or JPG file.`);
      return;
    }
    onFile(file);
  };

  const onDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept(event.dataTransfer.files[0]);
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex w-full items-center gap-4 rounded-lg border-2 border-dashed bg-white px-5 py-5 text-left transition-colors",
          dragging ? "border-slate-900 bg-slate-50" : "border-slate-300 hover:border-slate-400",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-slate-900">{busy ? "Uploading…" : "Drop an invoice here, or click to choose a file"}</span>
          <span className="block text-xs text-slate-500">PDF, PNG or JPG. Scanned documents are read too.</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
