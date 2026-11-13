import type { ReactNode } from "react";
import { useParams, Link } from "react-router";
import { ArrowLeft, CircleCheck, CircleDashed, CircleMinus, CircleX, ExternalLink, FileText, Loader2, Sparkles, Unplug } from "lucide-react";
import { STEP_ORDER, type FindingRow, type Outcome, type RunMode, type StepName, type StepRow } from "@/lib/api";
import { duration, OUTCOME_LABEL, runLabel, timestamp, tokenTotal } from "@/lib/format";
import { bundledSample } from "@/lib/samples";
import { useDocument } from "@/lib/use-document";
import { useRun } from "@/lib/use-run";
import { useElapsed } from "@/lib/use-elapsed";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible } from "@/components/ui/collapsible";
import { FindingList } from "@/components/findings";
import { OUTCOME_ICON, OutcomeBadge } from "@/components/outcome";
import { ModeBadge } from "@/components/mode-badge";
import { ErrorNote } from "@/components/error-note";
import { Evidence, hasEvidence, type RunFacts } from "@/components/evidence";
import { cn } from "@/lib/utils";

const STEP_LABEL: Record<StepName, string> = {
  intake: "Intake",
  extraction: "Extraction (AI)",
  validation: "Validation",
  vendor: "Vendor matching",
  bank: "Bank validation",
  po: "PO matching",
  amounts: "Amount validation",
  duplicate: "Duplicate check",
  decision: "Decision",
  persist: "Saved",
};

const STEP_HINT: Record<StepName, string> = {
  intake: "File type, size, pages and text layer",
  extraction: "Read the document into structured fields",
  validation: "Required fields and arithmetic",
  vendor: "Match the supplier to the vendor master",
  bank: "Compare the payee account with the vendor master",
  po: "Match each invoice line to a PO line; Jev decides the lines the code is not sure about",
  amounts: "Compare against the PO balance and lines",
  duplicate: "Look for the same invoice in the register",
  decision: "Approve, flag or reject, with reasons",
  persist: "Record the invoice and update the PO balance",
};

type View = "pending" | "running" | "done" | "skipped" | "failed" | "not_run";

const BANNER_STYLE: Record<Outcome, string> = {
  approved: "border-emerald-300 bg-emerald-50 text-emerald-950",
  needs_attention: "border-amber-300 bg-amber-50 text-amber-950",
  rejected: "border-red-300 bg-red-50 text-red-950",
};

const BANNER_ICON: Record<Outcome, string> = {
  approved: "text-emerald-600",
  needs_attention: "text-amber-600",
  rejected: "text-red-600",
};

export function RunPage() {
  const { id = "" } = useParams();
  const { detail, steps, done, error, degraded } = useRun(id);

  const finished = done !== null || (detail !== null && detail.status !== "running");
  const outcome = done?.outcome ?? detail?.outcome ?? null;
  const summary = done?.summary ?? detail?.summary ?? null;
  const status = done?.status ?? detail?.status ?? "running";
  const extraction = steps.extraction?.data.extraction as { currency?: unknown } | null | undefined;
  const currency = typeof extraction?.currency === "string" ? extraction.currency : null;
  const reasons = detail?.reasons ?? [];
  // A document is stored only when intake accepted the file; a typed or rejected invoice has none.
  const intake = steps.intake;
  const stored = intake?.state === "done" && intake.data.accepted === true ? intake.data.media_type : null;
  const mediaType = typeof stored === "string" ? stored : null;
  const facts: RunFacts = { outcome, summary, reasons };
  // Runs stored before the bank stage existed have no bank step; show only the stages a finished run went through.
  const shown = STEP_ORDER.filter((name) => name !== "bank" || steps.bank !== undefined || !finished);
  // The backend only publishes a stage's "running" event, it never stores it, so a page that opens or reloads
  // mid-run never receives one. The pipeline walks STEP_ORDER in order, so the first stage with no stored row is
  // the one in progress; deriving it here keeps the indicator right for late subscribers and for polling.
  const activeIndex = finished ? -1 : shown.findIndex((name) => steps[name] === undefined || steps[name]?.state === "running");
  const activeName = activeIndex === -1 ? null : shown[activeIndex];
  const settled = shown.filter((name) => steps[name] !== undefined && steps[name]?.state !== "running").length;
  const runMs = useElapsed(detail?.at, !finished);

  const backLink = (
    <Link to="/dashboard" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
      <ArrowLeft className="h-3.5 w-3.5" />
      All runs
    </Link>
  );

  if (error && !detail) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorNote message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backLink}

      <ErrorNote message={error} />

      <Card className="px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <h1 className="truncate text-base font-semibold">{detail ? runLabel(detail) : "Loading run…"}</h1>
              {finished ? (
                status === "error" && !outcome ? <Badge tone="red">Error</Badge> : <OutcomeBadge outcome={outcome} />
              ) : (
                <Badge tone="blue">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeName ? STEP_LABEL[activeName] : "Processing"}
                </Badge>
              )}
            </div>
            {!finished && (
              <p className="text-sm text-slate-700">
                {activeName ? (
                  <>
                    <span className="num font-medium">
                      Step {activeIndex + 1} of {shown.length}
                    </span>{" "}
                    · {STEP_HINT[activeName]}
                  </>
                ) : (
                  "Checks are running. Results appear step by step."
                )}
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs sm:grid-cols-4">
            <HeaderFact label="Mode">{detail ? <ModeBadge mode={detail.mode} /> : "—"}</HeaderFact>
            <HeaderFact label="Duration">{finished && detail?.ms != null ? duration(detail.ms) : runMs === null ? duration(detail?.ms) : duration(Math.round(runMs / 100) * 100)}</HeaderFact>
            <HeaderFact label="Started">{detail ? timestamp(detail.at) : "—"}</HeaderFact>
            <HeaderFact label="Tokens">{tokenTotal(detail?.tokens ?? null)}</HeaderFact>
          </dl>
        </div>
        {!finished && (
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={shown.length}
            aria-valuenow={settled}
            aria-label={activeName ? `Step ${activeIndex + 1} of ${shown.length}: ${STEP_LABEL[activeName]}` : "Processing"}
          >
            <div
              className="relative h-full rounded-full bg-sky-500 transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(4, (settled / shown.length) * 100)}%` }}
            >
              <span className="absolute inset-0 animate-pulse rounded-full bg-sky-300/60 motion-reduce:animate-none" aria-hidden />
            </div>
          </div>
        )}
        {degraded && !finished && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500">
            <Unplug className="h-3.5 w-3.5" />
            Live updates disconnected; refreshing every few seconds.
          </p>
        )}
      </Card>

      {finished && outcome && (
        <section className={cn("rounded-lg border-2 px-5 py-4", BANNER_STYLE[outcome])} aria-live="polite">
          <div className="flex items-start gap-3">
            <DecisionIcon outcome={outcome} />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Decision</div>
                <div className="text-xl font-semibold">{OUTCOME_LABEL[outcome]}</div>
                {summary && <p className="text-sm">{summary}</p>}
              </div>
              <DecisionReasons reasons={reasons} outcome={outcome} />
            </div>
          </div>
        </section>
      )}

      {finished && status === "error" && !outcome && (
        <ErrorNote message={summary ?? "The run stopped because of an unexpected error. It was not approved."} />
      )}

      <div className={cn("grid items-start gap-4", mediaType && "xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]")}>
        <Card>
          <ol className="px-4 py-2">
            {shown.map((name, index) => {
              const step = steps[name];
              const active = index === activeIndex;
              const view: View = active ? "running" : step ? step.state : finished ? "not_run" : "pending";
              return (
                <TimelineItem
                  key={name}
                  name={name}
                  index={index}
                  step={step}
                  view={view}
                  last={index === shown.length - 1}
                  currency={currency}
                  run={facts}
                  mode={detail?.mode ?? null}
                />
              );
            })}
          </ol>
        </Card>
        {mediaType && <InvoiceDocument runId={id} mediaType={mediaType} sample={detail?.sample ?? null} />}
      </div>
    </div>
  );
}

function InvoiceDocument({ runId, mediaType, sample }: { runId: string; mediaType: string; sample: string | null }) {
  // A sample run shows the PDF bundled with the frontend; an upload is fetched from the backend, which stored it.
  const source = bundledSample(sample) ?? `/v1/runs/${encodeURIComponent(runId)}/document`;
  const invoice = useDocument(source);
  return (
    <Card className="overflow-hidden xl:sticky xl:top-4">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2">
        <h2 className="text-sm font-medium text-slate-900">Invoice as received</h2>
        <a href={source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900">
          <ExternalLink className="h-3.5 w-3.5" />
          Open in new tab
        </a>
      </div>
      {invoice !== "ready" ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">
          {invoice === "loading" ? "Loading invoice…" : "The invoice file could not be loaded."}
        </p>
      ) : mediaType === "application/pdf" ? (
        <iframe src={source} title="Invoice as received" className="block h-[75vh] w-full bg-slate-50" />
      ) : (
        <img src={source} alt="Invoice as received" className="block w-full" />
      )}
    </Card>
  );
}

function HeaderFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="num font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function DecisionReasons({ reasons, outcome }: { reasons: FindingRow[]; outcome: Outcome }) {
  const issues = reasons.filter((reason) => reason.level !== "info");
  const passed = reasons.filter((reason) => reason.level === "info");

  if (issues.length === 0) {
    if (passed.length === 0) return null;
    return (
      <div className="space-y-1">
        {outcome === "approved" && <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">Why</div>}
        <FindingList findings={passed} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FindingList findings={issues} />
      {passed.length > 0 && (
        <Collapsible label={`Checks passed (${passed.length})`}>
          <FindingList findings={passed} />
        </Collapsible>
      )}
    </div>
  );
}

function DecisionIcon({ outcome }: { outcome: Outcome }) {
  const Icon = OUTCOME_ICON[outcome];
  return <Icon className={cn("mt-1 h-7 w-7 shrink-0", BANNER_ICON[outcome])} />;
}

const VIEW_BADGE: Record<View, { label: string; tone: "neutral" | "green" | "amber" | "red" | "blue" | "outline" }> = {
  pending: { label: "Pending", tone: "outline" },
  running: { label: "Running", tone: "blue" },
  done: { label: "Done", tone: "green" },
  skipped: { label: "Skipped", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
  not_run: { label: "Not run", tone: "outline" },
};

function StateIcon({ view, worst }: { view: View; worst: FindingRow["level"] | null }) {
  const base = "relative z-[1] h-5 w-5 rounded-full bg-white";
  if (view === "running") {
    return (
      <span className="relative z-[1] flex h-5 w-5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-sky-400/60 motion-reduce:hidden" aria-hidden />
        <Loader2 className={cn(base, "animate-spin text-sky-600")} />
      </span>
    );
  }
  if (view === "failed") return <CircleX className={cn(base, "text-red-600")} />;
  if (view === "skipped") return <CircleMinus className={cn(base, "text-slate-400")} />;
  if (view === "pending" || view === "not_run") return <CircleDashed className={cn(base, "text-slate-300")} />;
  const tone = worst === "block" ? "text-red-600" : worst === "warn" ? "text-amber-500" : "text-emerald-600";
  return <CircleCheck className={cn(base, tone)} />;
}

/**
 * What is happening on the stage in progress.
 *
 * The pipeline reports no percentage for a stage, so the bar is indeterminate: it says "in progress" and claims
 * nothing about how far along it is. Extraction is the only stage that waits on the model, and only when a model
 * was actually called, so the thinking line is gated on the run's mode rather than shown everywhere.
 */
function ActiveStage({ name, mode }: { name: StepName; mode: RunMode | null }) {
  const thinking = name === "extraction" && (mode === "live" || mode === "recorded");

  return (
    <div className="space-y-2">
      <div className="stage-sweep relative h-1 overflow-hidden rounded-full bg-sky-100" aria-hidden />
      {thinking && (
        <div className="flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-xs text-sky-900 ring-1 ring-sky-200 ring-inset">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-sky-600" />
          <span className="font-medium">{mode === "recorded" ? "Replaying the recorded reading" : "The model is reading the document"}</span>
          <span className="flex items-center gap-0.5" aria-hidden>
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="think-dot h-1 w-1 rounded-full bg-sky-600"
                style={{ animationDelay: `${dot * 0.18}s` }}
              />
            ))}
          </span>
          <span className="text-sky-700/70">
            {mode === "recorded" ? "no request is sent in recorded mode" : "usually the longest stage"}
          </span>
        </div>
      )}
    </div>
  );
}

interface TimelineItemProps {
  name: StepName;
  index: number;
  step: StepRow | undefined;
  view: View;
  last: boolean;
  currency: string | null;
  run: RunFacts;
  mode: RunMode | null;
}

function TimelineItem({ name, index, step, view, last, currency, run, mode }: TimelineItemProps) {
  const manual = mode === "manual";
  const running = view === "running";
  const findings = step?.findings ?? [];
  const worst = findings.some((item) => item.level === "block") ? "block" : findings.some((item) => item.level === "warn") ? "warn" : findings.length ? "info" : null;
  const badge = VIEW_BADGE[view];
  const skipReason = view === "skipped" && typeof step?.data.reason === "string" ? step.data.reason : null;
  const showEvidence = step && view !== "running" && view !== "skipped" && hasEvidence(step.data);
  const quiet = view === "pending" || view === "not_run" || view === "skipped";

  return (
    <li
      className={cn(
        "relative flex gap-3 py-2.5",
        running && "-mx-2 rounded-lg bg-sky-50/80 px-2 ring-1 ring-sky-200 ring-inset",
      )}
      aria-current={running ? "step" : undefined}
    >
      {!last && <span className={cn("absolute top-8 bottom-0 w-px bg-slate-200", running ? "left-[17.5px]" : "left-[9.5px]")} aria-hidden />}
      <StateIcon view={view} worst={worst} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="num w-4 text-xs text-slate-400">{index + 1}</span>
          <span className={cn("text-sm font-medium", running ? "text-sky-900" : quiet ? "text-slate-500" : "text-slate-900")}>
            {manual && name === "extraction" ? "Extraction (manual entry)" : STEP_LABEL[name]}
          </span>
          <Badge tone={badge.tone}>
            {running && <Loader2 className="h-3 w-3 animate-spin" />}
            {badge.label}
          </Badge>
          {step && view !== "running" && view !== "skipped" && step.ms !== null && <span className="num text-xs text-slate-500">{duration(step.ms)}</span>}
          <span className={cn("hidden text-xs md:inline", running ? "text-sky-700" : "text-slate-400")}>{STEP_HINT[name]}</span>
        </div>
        {running && <ActiveStage name={name} mode={mode} />}
        {skipReason && <p className="text-[13px] text-slate-500">{skipReason}</p>}
        {findings.length > 0 && <FindingList findings={findings} />}
        {showEvidence && (
          <Collapsible label="Evidence">
            <Evidence name={name} data={step.data} currency={currency} run={run} />
          </Collapsible>
        )}
      </div>
    </li>
  );
}
